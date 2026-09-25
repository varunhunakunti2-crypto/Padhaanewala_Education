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
  selected: number | null;
  marked: boolean;
}

export interface BuildResult {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeTakenSec: number;
  percentile: number;
  topicPerf: Record<string, { correct: number; total: number }>;
}
