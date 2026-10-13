import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NextClassDayCard } from "@/modules/academic/components/NextClassDayCard";
import type { NextClassDay, UpcomingMeeting } from "@/modules/academic/nextClassDay";

afterEach(cleanup);

const meeting = (over: Partial<UpcomingMeeting> = {}): UpcomingMeeting => ({
  meetingId: "m1",
  classId: "class-1",
  className: "Essência — Turma (sábado)",
  sequence: 2,
  date: "2026-10-17",
  start: "08:00",
  end: "12:30",
  teachers: ["Alvaro Ferreira", "Pr. Vinicius Motta"],
  subjects: ["Deus: Trindade, Atributos e Nomes", "Criação e Queda"],
  volumeName: "Essência",
  scheduleLabel: "Turma sábado",
  status: "scheduled",
  classStatus: "open",
  timeState: "upcoming",
  ...over,
});

const day = (meetings: UpcomingMeeting[], over: Partial<NextClassDay> = {}): NextClassDay => ({ date: "2026-10-17", isToday: false, meetings, ...over });

describe("NextClassDayCard", () => {
  it("mostra a data por extenso uma vez, as turmas, matérias, professores e o link para a turma", () => {
    render(
      <NextClassDayCard
        todayKey="2026-10-13"
        day={day([meeting(), meeting({ meetingId: "m2", classId: "class-2", className: "Voz — Turma (sábado)", volumeName: "Voz", subjects: ["7 esferas"], teachers: ["Thais Borges"] })])}
      />,
    );
    const region = screen.getByRole("region", { name: "Próximo dia de aula" });
    expect(within(region).getAllByText("Sábado, 17 de outubro")).toHaveLength(1);
    expect(within(region).getByText("2 turmas")).toBeTruthy();
    expect(within(region).getByText("Deus: Trindade, Atributos e Nomes")).toBeTruthy();
    expect(within(region).getByText("Pr. Vinicius Motta")).toBeTruthy();
    expect(within(region).getByText("Essência · Turma sábado · Encontro 2")).toBeTruthy();
    const links = within(region).getAllByRole("link", { name: /Ver turma/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/coordenacao/turmas/class-1", "/coordenacao/turmas/class-2"]);
    expect(within(region).queryByText("Hoje")).toBeNull();
  });

  it("indica 'Hoje' e 'Em andamento' quando aplicável", () => {
    render(<NextClassDayCard todayKey="2026-10-17" day={day([meeting({ timeState: "ongoing" })], { isToday: true })} />);
    expect(screen.getByText("Hoje")).toBeTruthy();
    expect(screen.getByText("Em andamento")).toBeTruthy();
  });

  it("matéria ou professor ausente: textos de apoio e link para atribuir, sem quebrar", () => {
    render(<NextClassDayCard todayKey="2026-10-13" day={day([meeting({ subjects: [], teachers: [] })])} />);
    expect(screen.getByText("Matéria não informada")).toBeTruthy();
    expect(screen.getByText("Professor não definido")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Atribuir" }).getAttribute("href")).toBe("/coordenacao/turmas/class-1/escala");
  });

  it("sem curso/modalidade cadastrados cai para o nome da turma", () => {
    render(<NextClassDayCard todayKey="2026-10-13" day={day([meeting({ volumeName: null, scheduleLabel: null })])} />);
    expect(screen.getByText("Essência — Turma (sábado) · Encontro 2")).toBeTruthy();
  });

  it("estado vazio amigável", () => {
    render(<NextClassDayCard todayKey="2026-10-13" day={null} />);
    expect(screen.getByText("Nenhuma aula programada no momento.")).toBeTruthy();
  });

  it("falha na consulta: aviso discreto com 'Tentar novamente' (não confunde com 'sem aulas')", () => {
    render(<NextClassDayCard todayKey="2026-10-13" day={null} failed />);
    expect(screen.getByText("Não foi possível carregar o próximo dia de aula agora.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tentar novamente" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByText("Nenhuma aula programada no momento.")).toBeNull();
  });

  it("virada de ano mostra o ano no título", () => {
    render(<NextClassDayCard todayKey="2026-12-31" day={day([meeting({ date: "2027-01-02" })], { date: "2027-01-02" })} />);
    expect(screen.getByText("Sábado, 2 de janeiro de 2027")).toBeTruthy();
  });
});
