"use client";

import { useActionState, useMemo, useState } from "react";
import { addManualAttendance, type SimpleState } from "../actions/manageAttendance";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export interface ManualClassOption {
  id: string;
  label: string;
  roster: { key: string; name: string; cpfLast4: string | null }[];
  meetings: { id: string; label: string; lessons: { number: number; start: string; end: string; block: 1 | 2 }[] }[];
}

const selectClass =
  "w-full rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800";

export function ManualAttendanceForm({ classes }: { classes: ManualClassOption[] }) {
  const [state, action, pending] = useActionState(addManualAttendance, {} as SimpleState);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [meetingId, setMeetingId] = useState("");

  const cls = classes.find((c) => c.id === classId);
  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!cls) return [];
    if (!q) return cls.roster;
    return cls.roster.filter((p) => p.name.toLowerCase().includes(q) || (p.cpfLast4 ?? "").includes(q.replace(/\D/g, "") || "#"));
  }, [cls, search]);
  const meeting = cls?.meetings.find((m) => m.id === meetingId);

  return (
    <form action={action} className="flex flex-col gap-4" key={state.success ? "ok" : "form"}>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Presença lançada. Ela já aparece nos relatórios.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="manual-class">Turma</Label>
          <select
            id="manual-class"
            className={selectClass}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setMeetingId("");
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="manual-search">Buscar aluno (nome ou final do CPF)</Label>
          <Input id="manual-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex.: Maria ou 4725" />
        </div>
        <div>
          <Label htmlFor="manual-person">Aluno</Label>
          <select id="manual-person" name="person" className={selectClass} required defaultValue="">
            <option value="" disabled>
              {roster.length} encontrado(s), escolha
            </option>
            {roster.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
                {p.cpfLast4 ? ` · CPF final ${p.cpfLast4}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="manual-meeting">Encontro</Label>
          <select
            id="manual-meeting"
            name="meeting"
            className={selectClass}
            required
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
          >
            <option value="" disabled>
              Escolha a data
            </option>
            {cls?.meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {meeting ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-neutral-800">Aulas em que esteve presente</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[1, 2].map((block) => (
              <div key={block} className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-neutral-100 p-2">
                <p className="text-xs font-semibold text-neutral-500">{block === 1 ? "Antes do intervalo" : "Depois do intervalo"}</p>
                {meeting.lessons
                  .filter((l) => l.block === block)
                  .map((l) => (
                    <label key={l.number} className="flex items-center gap-2 text-sm text-neutral-800">
                      <input type="checkbox" name="lessons" value={l.number} defaultChecked className="h-4 w-4" />
                      Aula {l.number}: {l.start} às {l.end}
                    </label>
                  ))}
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div>
        <Label htmlFor="manual-note">Observação (opcional)</Label>
        <Input id="manual-note" name="note" placeholder="Ex.: assinou a lista de papel, saiu às 11h" />
      </div>

      <Button type="submit" isLoading={pending} className="self-start">
        Lançar presença
      </Button>
    </form>
  );
}
