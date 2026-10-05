/** Shared types for the mock-test runner. */

export const MAX_VIOLATIONS = 3;

export type Stage = "setup" | "running" | "result";

/**
 * State of one focus-mode capability.
 *
 * `unavailable` is separate from `denied` because they need different words.
 * "Blocked" means the user or their browser refused a prompt; "Unavailable"
 * means there is no such API on this device at all — no camera, no
 * `getDisplayMedia`, an insecure origin. The exam must start either way, so
 * neither state is allowed to gate it; they only decide which sentence the
 * setup screen prints.
 */
export type PermState = "pending" | "granted" | "denied" | "unavailable";

export interface PermissionStatus {
  camera: PermState;
  mic: PermState;
  screen: PermState;
  fullscreen: PermState;
}

export interface Violation {
  reason: string;
  at: Date;
  remaining: number;
}

/**
 * What the student has entered for one question, locally.
 *
 * `selected` is an *option index*, not an answer. The server stores the option's
 * text, because a paper with option randomisation shuffles the list on every
 * request and an index would mean something different each time. The conversion
 * between the two lives in `@/lib/attempt-session`, in `answerTextFor` and
 * `seedAnswers`.
 */
export interface AnswerState {
  /** Index of the chosen MCQ option. Stays null for numeric questions. */
  selected: number | null;
  marked: boolean;
  /** Raw text typed into a numeric-answer field. */
  numeric?: string;
}

/*
 * `BuildResult` used to live here: the runner's own scorecard, computed from the
 * answer map against each question's `correctIndex`. It is gone, and deliberately.
 * The grade comes from `POST /mock-tests/{ref}/attempts/{id}/submit` as
 * `ResultSummary` (see `@/lib/attempt-session`), and an `AttemptQuestion` has no
 * answer key in it to compute anything from. Keeping the type would only invite
 * something to build one again.
 */
