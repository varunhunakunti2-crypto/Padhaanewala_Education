import type { ComplianceStatus, GuardianConsent } from "@/lib/api";

/**
 * Pure decision logic for the DPDP s.9 age gate.
 *
 * Split out of `AgeGate.tsx` for the same reason every `lib/*-form.ts` in this
 * repo is: the branch that decides *which screen a statutory gate shows* is the
 * part worth testing, and it is the part a component test cannot reach without
 * mounting, fetching and poking at state.
 *
 * The backend counterpart is `app/services/compliance_service.decide_processing`.
 * This does not re-implement its rules — it only maps the payload that function
 * already produced onto a screen. The only judgement call it makes is whether a
 * pending consent means "wait for the code" rather than "ask for a guardian".
 */

/** Which screen the gate renders. `idle` and `unavailable` are the component's
 *  own — "no payload yet" and "the fetch failed" — and never come from here. */
export type GatePhase = "age" | "guardian-request" | "guardian-verify" | "clear";

/**
 * Reasons `decide_processing` can return that are about the guardian, not about
 * the age question. Mirrors the `code=` literals in `compliance_service.py`.
 *
 * `age_verification_required` is deliberately absent: it is resolved by the
 * `!age_answered` branch before this list is ever consulted, and including it
 * would let a payload that is both unanswered *and* claiming an age reason
 * masquerade as a consent problem.
 */
export const PARENTAL_CONSENT_REASONS = [
  "parental_consent_required",
  "parental_consent_pending",
  "parental_consent_expired",
  "parental_consent_withdrawn",
] as const;

export type ParentalConsentReason = (typeof PARENTAL_CONSENT_REASONS)[number];

export function isParentalConsentReason(reason: string | null | undefined): boolean {
  return (
    typeof reason === "string" &&
    (PARENTAL_CONSENT_REASONS as readonly string[]).includes(reason)
  );
}

/**
 * Which screen to show for a loaded gate.
 *
 * Order matters and is not interchangeable:
 *
 * 1. Unanswered age first. A minor whose consent is also missing still has to
 *    answer the age question, because the answer is what decides whether a
 *    guardian is needed at all.
 * 2. `processing_allowed` second, so a satisfied gate short-circuits before any
 *    consent reasoning runs.
 * 3. A *pending* consent shows the code entry rather than the guardian form.
 *    Re-asking for guardian details when the code is already in flight would
 *    supersede the live request (`compliance.py:236-242` does exactly that) and
 *    burn a send from the OTP cap for no reason.
 */
export function deriveGatePhase(
  status: ComplianceStatus,
  consent: GuardianConsent | null,
): GatePhase {
  if (!status.age_answered) return "age";
  if (status.processing_allowed) return "clear";
  return consent?.status === "pending" ? "guardian-verify" : "guardian-request";
}

/**
 * Human copy for a blocked state, so the same reason never renders two
 * different sentences on two different pages.
 */
export function gateNotice(status: ComplianceStatus | null): string | null {
  if (!status) return null;
  // Unanswered age is checked before `processing_allowed`, not after: the two
  // agree in every payload the backend produces today, but if they ever
  // disagree the user still needs to be told the age question is outstanding,
  // and "everything is fine" is the one answer that would hide it.
  if (!status.age_answered) {
    return "We need to know whether you are under 18 before we can save anything to your account.";
  }
  if (status.processing_allowed) return null;
  if (status.blocked_reason === "parental_consent_pending") {
    return "Waiting for your parent or guardian to enter the code we sent them.";
  }
  if (status.blocked_reason === "parental_consent_expired") {
    return "Your parental consent has expired. We need it confirming again.";
  }
  if (status.blocked_reason === "parental_consent_withdrawn") {
    return "Consent to process your data was withdrawn, so your account is read-only.";
  }
  if (isParentalConsentReason(status.blocked_reason)) {
    return "Your account is read-only until a parent or guardian confirms your age.";
  }
  // An unknown code is a backend change, not a user error. Say nothing rather
  // than rendering a message the product cannot act on.
  return null;
}
