import { describe, expect, it } from "vitest";
import { isContentReleased, type ReleaseRule } from "@/services/contentRelease";

const baseContext = {
  now: new Date("2026-10-15T12:00:00Z"),
  completedContentIds: new Set<string>(),
  submittedActivityIds: new Set<string>(),
  pastMeetingIds: new Set<string>(),
};

describe("isContentReleased", () => {
  it("libera imediatamente quando não há nenhuma regra cadastrada", () => {
    expect(isContentReleased([], baseContext)).toBe(true);
  });

  it("regra immediate sempre libera", () => {
    const rules: ReleaseRule[] = [{ type: "immediate" }];
    expect(isContentReleased(rules, baseContext)).toBe(true);
  });

  it("regra manual só libera quando released_manually = true", () => {
    expect(isContentReleased([{ type: "manual", releasedManually: false }], baseContext)).toBe(false);
    expect(isContentReleased([{ type: "manual", releasedManually: true }], baseContext)).toBe(true);
  });

  it("regra de data libera só a partir da data configurada", () => {
    const future: ReleaseRule = { type: "date", releaseAt: new Date("2026-11-01T00:00:00Z") };
    const past: ReleaseRule = { type: "date", releaseAt: new Date("2026-01-01T00:00:00Z") };

    expect(isContentReleased([future], baseContext)).toBe(false);
    expect(isContentReleased([past], baseContext)).toBe(true);
  });

  it("regra after_content exige o conteúdo pré-requisito concluído", () => {
    const rule: ReleaseRule = { type: "after_content", requiredContentId: "content-1" };

    expect(isContentReleased([rule], baseContext)).toBe(false);
    expect(
      isContentReleased([rule], {
        ...baseContext,
        completedContentIds: new Set(["content-1"]),
      }),
    ).toBe(true);
  });

  it("regra after_activity exige a atividade enviada", () => {
    const rule: ReleaseRule = { type: "after_activity", requiredActivityId: "activity-1" };

    expect(isContentReleased([rule], baseContext)).toBe(false);
    expect(
      isContentReleased([rule], {
        ...baseContext,
        submittedActivityIds: new Set(["activity-1"]),
      }),
    ).toBe(true);
  });

  it("regra after_meeting exige o encontro já ter ocorrido", () => {
    const rule: ReleaseRule = { type: "after_meeting", requiredMeetingId: "meeting-1" };

    expect(isContentReleased([rule], baseContext)).toBe(false);
    expect(
      isContentReleased([rule], {
        ...baseContext,
        pastMeetingIds: new Set(["meeting-1"]),
      }),
    ).toBe(true);
  });

  it("múltiplas regras no mesmo conteúdo usam OR — qualquer uma satisfeita libera", () => {
    const rules: ReleaseRule[] = [
      { type: "after_content", requiredContentId: "content-1" },
      { type: "manual", releasedManually: true },
    ];

    // after_content não satisfeita, mas manual sim -> libera
    expect(isContentReleased(rules, baseContext)).toBe(true);
  });
});
