import type { AnswerFeedback } from "../../actions/activityAttempt";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface AnswerState {
  selected: string[];
  save: SaveState;
  feedback: AnswerFeedback | null;
}
