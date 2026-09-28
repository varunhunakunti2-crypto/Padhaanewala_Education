/** Shared types for the mock-test runner. */

export const MAX_VIOLATIONS = 3;

export type Stage = "setup" | "running" | "result";

export type PermState = "pending" | "granted" | "denied";

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

export interface AnswerState {
  /** Index of the chosen MCQ option. Stays null for numeric questions. */
  selected: number | null;
  marked: boolean;
  /** Raw text typed into a numeric-answer field. */
  numeric?: string;
}

export interface BuildResult {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeTakenSec: number;
  topicPerf: Record<string, { correct: number; total: number }>;
}
