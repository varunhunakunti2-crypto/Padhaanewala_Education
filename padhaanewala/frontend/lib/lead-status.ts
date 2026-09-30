import { LEAD_STATUSES, type LeadStatus } from "@/lib/api";

/**
 * The lead funnel as a walkable ladder.
 *
 * ## Why this module exists
 *
 * `LeadsSection` shipped a quick-action button that advanced a lead with
 * `nextStatus = (s) => (s === "new" ? "contacted" : "converted")`. `converted`
 * is not a status on this server — `PATCH /leads/{id}/status` validates against
 * `LEAD_STATUSES` in `backend/app/schemas/engagement.py` — so every click after
 * the first returned a 422 and left the lead exactly where it was. The button
 * looked like it worked, and the failure was only visible to someone who
 * happened to click it twice.
 *
 * Type checking could not catch it, because both values were `string`. So the
 * ladder lives here, next to the constant that defines it, and is covered by
 * `tests/lead-status.test.ts`.
 */

/** End states: a lead in one of these has nowhere left to advance to. */
export const TERMINAL_LEAD_STATUSES: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  "won",
  "lost",
  "closed",
]);

/**
 * The next rung of the funnel, or `null` when the lead is finished.
 *
 * Derived from `LEAD_STATUSES` by index rather than restated, so the two cannot
 * drift: if the backend adds or reorders a status, the ladder follows. A status
 * the backend knows and this list does not yields `null` (the caller then issues
 * no request) rather than an invented value the server would reject.
 */
export function nextLeadStatus(current: string): LeadStatus | null {
  if (!LEAD_STATUSES.includes(current as LeadStatus)) return null;
  if (TERMINAL_LEAD_STATUSES.has(current as LeadStatus)) return null;
  const at = LEAD_STATUSES.indexOf(current as LeadStatus);
  return at >= 0 && at < LEAD_STATUSES.length - 1 ? LEAD_STATUSES[at + 1] : null;
}

/**
 * True when the lead has somewhere to go. Drives whether the quick-action
 * button renders at all, so a won/lost/closed lead shows none rather than a
 * control that cannot succeed.
 */
export function canAdvanceLead(current: string): boolean {
  return nextLeadStatus(current) !== null;
}
