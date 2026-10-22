import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { isAnnouncementActive, splitStudentAnnouncements, type StudentAnnouncement } from "@/modules/academic/announcements";
import { UrgentAnnouncements } from "@/modules/academic/components/UrgentAnnouncements";
import { createAnnouncementSchema } from "@/modules/academic/schemas";

afterEach(cleanup);

const ann = (id: string, over: Partial<StudentAnnouncement> = {}): StudentAnnouncement => ({
  id,
  title: `Aviso ${id}`,
  body: "Texto",
  published_at: "2026-10-20T12:00:00Z",
  is_urgent: false,
  expires_at: null,
  ...over,
});

describe("splitStudentAnnouncements", () => {
  const now = new Date("2026-10-22T15:00:00Z");

  it("importantes vão para o destaque, comuns para a lista (os 4 mais recentes)", () => {
    const rows = [
      ann("c1", { published_at: "2026-10-01T00:00:00Z" }),
      ann("u1", { is_urgent: true, published_at: "2026-10-21T00:00:00Z" }),
      ann("c2", { published_at: "2026-10-05T00:00:00Z" }),
      ann("c3", { published_at: "2026-10-06T00:00:00Z" }),
      ann("c4", { published_at: "2026-10-07T00:00:00Z" }),
      ann("c5", { published_at: "2026-10-08T00:00:00Z" }),
    ];
    const { urgent, regular } = splitStudentAnnouncements(rows, now);
    expect(urgent.map((a) => a.id)).toEqual(["u1"]);
    expect(regular.map((a) => a.id)).toEqual(["c5", "c4", "c3", "c2"]);
  });

  it("aviso vencido não aparece; o que vence no futuro continua", () => {
    const rows = [
      ann("vencido", { is_urgent: true, expires_at: "2026-10-22T14:59:59Z" }),
      ann("vigente", { is_urgent: true, expires_at: "2026-10-25T02:59:00Z" }),
      ann("sem-data", { is_urgent: true }),
      ann("comum-vencido", { expires_at: "2026-10-01T00:00:00Z" }),
    ];
    const { urgent, regular } = splitStudentAnnouncements(rows, now);
    expect(urgent.map((a) => a.id).sort()).toEqual(["sem-data", "vigente"]);
    expect(regular).toEqual([]);
  });

  it("no instante exato do vencimento o aviso já saiu do ar", () => {
    expect(isAnnouncementActive({ expires_at: "2026-10-22T15:00:00Z" }, now)).toBe(false);
    expect(isAnnouncementActive({ expires_at: null }, now)).toBe(true);
  });

  it("vários importantes: todos aparecem, do mais novo ao mais antigo", () => {
    const rows = [ann("a", { is_urgent: true, published_at: "2026-10-10T00:00:00Z" }), ann("b", { is_urgent: true, published_at: "2026-10-20T00:00:00Z" })];
    expect(splitStudentAnnouncements(rows, now).urgent.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("UrgentAnnouncements", () => {
  it("mostra título e texto em destaque, com o selo 'Aviso importante'", () => {
    render(<UrgentAnnouncements items={[{ id: "1", title: "Sábado, 24/10: NÃO HAVERÁ AULA", body: "Feriado em Goiânia." }]} />);
    expect(screen.getByRole("heading", { name: "Sábado, 24/10: NÃO HAVERÁ AULA" })).toBeTruthy();
    expect(screen.getByText("Feriado em Goiânia.")).toBeTruthy();
    expect(screen.getByText("Aviso importante")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("sem avisos importantes não renderiza nada", () => {
    const { container } = render(<UrgentAnnouncements items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("createAnnouncementSchema", () => {
  const base = { title: "T", body: "B", classId: "", moduleId: "", audience: "students" as const };

  it("aceita aviso importante com data de saída", () => {
    const parsed = createAnnouncementSchema.safeParse({ ...base, urgent: true, expiresOn: "2026-10-29" });
    expect(parsed.success).toBe(true);
  });

  it("recusa data de saída em formato errado e aceita vazio", () => {
    expect(createAnnouncementSchema.safeParse({ ...base, urgent: true, expiresOn: "29/10/2026" }).success).toBe(false);
    expect(createAnnouncementSchema.safeParse({ ...base, urgent: false, expiresOn: "" }).success).toBe(true);
  });
});
