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
  /** Nome do volume — a reposição só vale entre turmas do mesmo volume. */
  volume: string;
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
  const [makeup, setMakeup] = useState(false);
  const [personKey, setPersonKey] = useState("");

  const cls = classes.find((c) => c.id === classId);

  // Lista de quem pode ser lançado: na turma escolhida (presença normal) ou, na reposição,
  // nas OUTRAS turmas do mesmo volume (o aluno assistiu aqui no lugar da turma dele).
  const people = useMemo(() => {
    if (!cls) return [];
    const sources = makeup ? classes.filter((c) => c.id !== cls.id && c.volume === cls.volume) : [cls];
    const q = search.trim().toLowerCase();
    return sources
      .flatMap((c) => c.roster.map((p) => ({ ...p, ownClassId: c.id, ownClassLabel: c.label })))
      .filter(
        (p) => !q || p.name.toLowerCase().includes(q) || (p.cpfLast4 ?? "").includes(q.replace(/\D/g, "") || "#"),
      );
  }, [cls, classes, makeup, search]);

  const meeting = cls?.meetings.find((m) => m.id === meetingId);
  const chosen = people.find((p) => p.key === personKey);
  const ownClass = makeup && chosen ? classes.find((c) => c.id === chosen.ownClassId) : undefined;

  return (
    <form action={action} className="flex flex-col gap-4" key={state.success ? "ok" : "form"}>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Presença lançada. Ela já aparece nos relatórios.</Alert> : null}

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-800">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={makeup}
          onChange={(e) => {
            setMakeup(e.target.checked);
            setPersonKey("");
          }}
        />
        É reposição (o aluno assistiu a aula em outra turma do mesmo volume)
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="manual-class">{makeup ? "Turma em que ele assistiu" : "Turma"}</Label>
          <select
            id="manual-class"
            className={selectClass}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setMeetingId("");
              setPersonKey("");
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
          <Label htmlFor="manual-person">{makeup ? "Aluno (de outra turma do volume)" : "Aluno"}</Label>
          <select
            id="manual-person"
            name="person"
            className={selectClass}
            required
            value={personKey}
            onChange={(e) => setPersonKey(e.target.value)}
          >
            <option value="" disabled>
              {people.length} encontrado(s), escolha
            </option>
            {people.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
                {p.cpfLast4 ? ` · CPF final ${p.cpfLast4}` : ""}
                {makeup ? ` · ${p.ownClassLabel}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="manual-meeting">{makeup ? "Encontro a que ele assistiu" : "Encontro"}</Label>
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
        {makeup ? (
          <div className="sm:col-span-2">
            <Label htmlFor="manual-replaces">Reposição de qual encontro da turma dele?</Label>
            <select id="manual-replaces" name="replaces" className={selectClass} required defaultValue="" key={ownClass?.id ?? "none"}>
              <option value="" disabled>
                {ownClass ? "Escolha o encontro que ele perdeu" : "Escolha primeiro o aluno"}
              </option>
              {ownClass?.meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
        {makeup ? "Lançar reposição" : "Lançar presença"}
      </Button>
    </form>
  );
}
