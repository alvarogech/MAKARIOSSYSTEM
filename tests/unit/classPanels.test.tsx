import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { StudentsList, type StudentRowView } from "@/modules/teaching/components/StudentsList";
import { ClassJourneyPanel } from "@/modules/learning/components/ClassJourneyPanel";
import type { ClassJourney } from "@/modules/learning/classJourney";

afterEach(cleanup);

const row = (key: string, name: string, over: Partial<StudentRowView> = {}): StudentRowView => ({
  key,
  name,
  waiting: false,
  hoursLabel: "2h de 2h realizadas · 16h no total",
  attention: false,
  situationLabel: "Em dia",
  situationClass: "bg-green-50 text-green-700",
  situationTitle: "",
  ...over,
});

describe("StudentsList", () => {
  const students = [
    row("1", "Ana Paula"),
    row("2", "Bruno Lima", { attention: true, situationLabel: "Atenção" }),
    row("3", "Carla Dias", { waiting: true }),
    row("4", "Álvaro Souza"),
  ];

  it("resumo usa a mesma contagem: ativos, aguardando e em atenção", () => {
    render(<StudentsList students={students} />);
    expect(screen.getByText(/3 ativos · 1 aguardando acesso · 1 em atenção/)).toBeTruthy();
  });

  it("busca ignora acento e maiúsculas, sem botão de filtrar", async () => {
    const user = userEvent.setup();
    render(<StudentsList students={students} />);
    await user.type(screen.getByLabelText("Buscar aluno pelo nome"), "alvaro");
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Álvaro Souza")).toBeTruthy();
  });

  it("filtros: em atenção e aguardando acesso", async () => {
    const user = userEvent.setup();
    render(<StudentsList students={students} />);
    await user.click(screen.getByRole("button", { name: /Em atenção \(1\)/ }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([expect.stringContaining("Bruno Lima")]);
    await user.click(screen.getByRole("button", { name: /Aguardando acesso \(1\)/ }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([expect.stringContaining("Carla Dias")]);
  });

  it("aluno aguardando acesso não mostra situação de frequência", () => {
    render(<StudentsList students={[row("3", "Carla Dias", { waiting: true })]} />);
    expect(screen.getByText("aguardando acesso")).toBeTruthy();
    expect(screen.queryByText("Em dia")).toBeNull();
  });
});

describe("ClassJourneyPanel", () => {
  const journey: ClassJourney = {
    students: 18,
    modules: [
      { moduleId: "m1", name: "Fé", activitiesPublished: 1, activitiesPending: 0, challengesPublished: 1, challengesPending: 0, studentsDoneActivity: 9, studentsDonePractice: 3 },
      { moduleId: "m2", name: "Evangelismo", activitiesPublished: 0, activitiesPending: 1, challengesPublished: 0, challengesPending: 1, studentsDoneActivity: 0, studentsDonePractice: 0 },
    ],
    doubts: [{ questionId: "q1", prompt: "O que é fé?", moduleName: "Fé", answered: 9, wrong: 5 }],
  };

  it("mostra participação em contagens (sem nomes), dúvida recorrente e o que aguarda publicação", () => {
    render(<ClassJourneyPanel journey={journey} />);
    expect(screen.getByText("9 de 18")).toBeTruthy();
    expect(screen.getByText("O que é fé?")).toBeTruthy();
    expect(screen.getByText(/5 de 9 erraram na primeira resposta/)).toBeTruthy();
    expect(screen.getByText(/Conteúdos a retomar:/)).toBeTruthy();
    expect(screen.getByText(/Aguardando publicação pela coordenação:.*Evangelismo/)).toBeTruthy();
    // matéria sem nada publicado não aparece na participação
    expect(screen.queryByText("Concluíram o desafio de fixação", { selector: "span" })).toBeTruthy();
  });

  it("sem dados: diz 'Sem dados' em vez de inventar", () => {
    render(<ClassJourneyPanel journey={{ students: 0, modules: [], doubts: [] }} />);
    expect(screen.getByText(/Sem dados — ainda não há desafio publicado ou aluno ativo/)).toBeTruthy();
    expect(screen.getByText(/Sem dados suficientes — aparecem quando pelo menos 5 alunos/)).toBeTruthy();
  });

  it("sem acesso ou falha: Sem dados", () => {
    render(<ClassJourneyPanel journey={null} />);
    expect(screen.getByText("Sem dados no momento.")).toBeTruthy();
  });
});
