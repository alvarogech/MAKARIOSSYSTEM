"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { can, getAuthContext } from "@/authorization";
import { checkPrerequisites } from "@/services/prerequisites";
import { validateStudentImportRow } from "@/services/studentImport";
import { parseImportFile } from "../importParsing";
import { buildImportLookupTables } from "../importLookups";
import {
  buildPrerequisiteGraph,
  getApprovedVolumeIds,
  getExceptionVolumeIds,
} from "../prerequisiteContext";

export interface ImportRowReport {
  rowNumber: number;
  status: "success" | "error";
  fullName?: string;
  email?: string;
  errors: string[];
}

export interface ImportStudentsState {
  error?: string;
  report?: {
    fileName: string;
    totalRows: number;
    successRows: number;
    errorRows: number;
    rows: ImportRowReport[];
  };
}

/**
 * Importação de alunos por planilha (.csv/.xlsx) — doc 06 §5. Processada
 * de forma síncrona nesta fase (o volume esperado, uma única congregação,
 * cabe numa requisição); mover para a fila (AsyncTaskQueue) fica como
 * evolução se o tamanho típico de planilha crescer — ver FASE_2_RELATORIO.md.
 *
 * Cabeçalhos esperados (linha 1): nome, email, telefone, nascimento,
 * volume, temporada, turma.
 */
export async function importStudents(
  _prevState: ImportStudentsState,
  formData: FormData,
): Promise<ImportStudentsState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "imports", action: "create" })) {
    return { error: "Você não tem permissão para importar planilhas." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo .csv ou .xlsx." };
  }

  let rawRows;
  try {
    rawRows = await parseImportFile(file);
  } catch (parseError) {
    return {
      error:
        parseError instanceof Error
          ? parseError.message
          : "Não foi possível ler o arquivo.",
    };
  }

  if (rawRows.length === 0) {
    return { error: "A planilha não tem nenhuma linha de dados." };
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [lookups, graph, { data: studentRole }, { data: offeringsWithVolume }] =
    await Promise.all([
      buildImportLookupTables(supabase),
      buildPrerequisiteGraph(supabase),
      supabase.from("roles").select("id").eq("slug", "student").single(),
      supabase.from("season_volume_offerings").select("id, volume_id"),
    ]);

  const offeringVolumeById = new Map(
    (offeringsWithVolume ?? []).map((o) => [o.id, o.volume_id]),
  );

  if (!studentRole) {
    return { error: "Perfil 'Aluno' não encontrado no catálogo de perfis." };
  }

  const { data: importRow, error: importInsertError } = await supabase
    .from("imports")
    .insert({
      type: "students",
      file_name: file.name,
      status: "processing",
      total_rows: rawRows.length,
      created_by: authContext.userId,
    })
    .select("id")
    .single();

  if (importInsertError || !importRow) {
    return { error: "Não foi possível registrar a importação." };
  }

  const rowReports: ImportRowReport[] = [];
  let successCount = 0;

  for (const rawRow of rawRows) {
    const validation = validateStudentImportRow(rawRow, lookups);

    if (!validation.ok) {
      rowReports.push({
        rowNumber: validation.error.rowNumber,
        status: "error",
        errors: validation.error.errors,
      });
      continue;
    }

    const { row } = validation;
    const rowErrors: string[] = [];
    let studentId: string | null = null;

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", row.email)
      .maybeSingle();

    if (existingProfile) {
      studentId = existingProfile.id;
    } else {
      const { error: invitationError } = await supabase.from("invitations").insert({
        email: row.email,
        intended_role_id: studentRole.id,
        invited_by: authContext.userId,
      });

      if (invitationError && invitationError.code !== "23505") {
        rowErrors.push("Não foi possível registrar o convite para este e-mail.");
      } else {
        const { data: inviteResult, error: inviteError } =
          await admin.auth.admin.inviteUserByEmail(row.email, {
            data: { full_name: row.fullName },
          });

        if (inviteError || !inviteResult.user) {
          rowErrors.push(`Falha ao convidar por e-mail: ${inviteError?.message ?? "erro desconhecido"}.`);
        } else {
          studentId = inviteResult.user.id;
        }
      }
    }

    if (!studentId) {
      await supabase.from("import_rows").insert({
        import_id: importRow.id,
        row_number: row.rowNumber,
        raw_data: rawRow.raw,
        status: "error",
        errors: rowErrors,
      });
      rowReports.push({
        rowNumber: row.rowNumber,
        status: "error",
        fullName: row.fullName,
        email: row.email,
        errors: rowErrors,
      });
      continue;
    }

    const volumeId = offeringVolumeById.get(row.offeringId);
    const [approvedVolumeIds, exceptionVolumeIds] = await Promise.all([
      getApprovedVolumeIds(supabase, studentId),
      volumeId
        ? getExceptionVolumeIds(supabase, studentId, volumeId)
        : Promise.resolve(new Set<string>()),
    ]);

    if (volumeId) {
      const prerequisiteCheck = checkPrerequisites(
        volumeId,
        graph,
        approvedVolumeIds,
        exceptionVolumeIds,
      );
      if (!prerequisiteCheck.satisfied) {
        rowErrors.push(
          "Pré-requisito não concluído — regularize pela tela de Matrículas antes de reimportar esta linha.",
        );
      }
    }

    let enrollmentId: string | null = null;
    if (rowErrors.length === 0) {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("enrollments")
        .insert({
          student_id: studentId,
          season_volume_offering_id: row.offeringId,
          class_id: row.classId,
          authorized_by: authContext.userId,
        })
        .select("id")
        .single();

      if (enrollmentError) {
        rowErrors.push(
          enrollmentError.code === "23505"
            ? "Aluno já matriculado nesta oferta de volume."
            : "Não foi possível criar a matrícula.",
        );
      } else {
        enrollmentId = enrollment.id;
      }
    }

    const status = rowErrors.length === 0 ? "success" : "error";

    await supabase.from("import_rows").insert({
      import_id: importRow.id,
      row_number: row.rowNumber,
      raw_data: rawRow.raw,
      status,
      errors: rowErrors,
      created_user_id: studentId,
      created_enrollment_id: enrollmentId,
    });

    if (status === "success") {
      successCount += 1;
    }

    rowReports.push({
      rowNumber: row.rowNumber,
      status,
      fullName: row.fullName,
      email: row.email,
      errors: rowErrors,
    });
  }

  const errorCount = rowReports.length - successCount;

  await supabase
    .from("imports")
    .update({
      status: errorCount === 0 ? "completed" : "completed_with_errors",
      success_rows: successCount,
      error_rows: errorCount,
    })
    .eq("id", importRow.id);

  revalidatePath("/coordenacao/importar");
  revalidatePath("/coordenacao/matriculas");

  return {
    report: {
      fileName: file.name,
      totalRows: rawRows.length,
      successRows: successCount,
      errorRows: errorCount,
      rows: rowReports,
    },
  };
}
