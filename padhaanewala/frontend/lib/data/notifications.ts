import type { NotificationItem } from "@/lib/types";

/**
 * Bundled notifications — intentionally empty.
 *
 * These were five hand-written "news" items with invented dates and invented
 * deadlines (a Reliance Foundation scholarship closing date, VITEEE
 * registrations). Real notifications come from the backend `notifications`
 * table via the admin API.
 */
export const DEFAULT_NOTIFICATIONS: NotificationItem[] = [];

/**
 * Prompt suggestions. Empty because they used to advertise courses and features
 * that have no data behind them.
 */
export const AI_SUGGESTED_QUESTIONS: string[] = [];

/**
 * There is no language model wired up to this route.
 *
 * `getAiResponse` used to be a keyword matcher over a hardcoded table of
 * confident-sounding answers. It answered "which colleges offer B.Sc Nursing"
 * with a list of institutions (AIIMS, JIPMER, CMC Vellore, AFMC) that were never
 * verified against any dataset, and it answered as if it were a live assistant.
 * Inventing facts and presenting them as an AI's answer is exactly what the rest
 * of this cleanup removes, so the matcher and its answer table are gone.
 *
 * Point the user at real content instead of inventing an answer.
 */
export function getAiResponse(): string {
  return (
    "The assistant isn't available right now — it isn't connected to a language " +
    "model, so it can't answer questions without making things up. Browse the " +
    "college directory, exam calendar and scholarship pages for verified " +
    "information instead."
  );
}
