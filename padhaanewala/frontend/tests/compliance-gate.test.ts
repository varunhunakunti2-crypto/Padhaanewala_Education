import { describe, expect, it } from "vitest";

import type { ComplianceStatus, GuardianConsent } from "@/lib/api";
import {
  PARENTAL_CONSENT_REASONS,
  deriveGatePhase,
  gateNotice,
  isParentalConsentReason,
} from "@/lib/compliance-gate";

/**
 * The DPDP s.9 age gate.
 *
 * The backend already decided everything (`compliance_service.decide_processing`
 * returns `age_band`, `processing_allowed` and one of five `code`s). What this
 * module decides is *which screen* a user sees, and that is where the risk is:
 * a mapping that puts a minor with expired consent onto the age question, or
 * that shows a consent prompt to an adult, is silent — it compiles, lints and
 * passes a build, and simply asks the wrong person the wrong question.
 *
 * The strongest assertions here are therefore about *order*: age before
 * consent, allowed before blocked, pending before re-request.
 */

function status(overrides: Partial<ComplianceStatus> = {}): ComplianceStatus {
  return {
    age_band: "18_plus",
    is_minor: false,
    age_answered: true,
    processing_allowed: true,
    blocked_reason: null,
    blocked_message: null,
    parental_consent: null,
    sla_days: 90,
    ...overrides,
  };
}

function consent(overrides: Partial<GuardianConsent> = {}): GuardianConsent {
  return {
    id: 1,
    status: "pending",
    verification_channel: "sms",
    requested_at: "2026-10-01T10:00:00Z",
    verified_at: null,
    withdrawn_at: null,
    expires_at: "2027-10-01T10:00:00Z",
    consent_version: "1.0",
    ...overrides,
  };
}

const minor = (overrides: Partial<ComplianceStatus> = {}) =>
  status({
    age_band: "under_18",
    is_minor: true,
    processing_allowed: false,
    blocked_reason: "parental_consent_required",
    ...overrides,
  });

describe("deriveGatePhase", () => {
  it("asks the age question when the band was never answered", () => {
    expect(deriveGatePhase(status({ age_answered: false, age_band: null }), null)).toBe("age");
  });

  it("asks the age question even when a consent row exists", () => {
    // Order, not preference: a legacy account cannot have a consent row without
    // an age band, but if the two ever disagree the age answer is what decides
    // whether a guardian is needed at all.
    const result = deriveGatePhase(
      status({ age_answered: false, age_band: null }),
      consent({ status: "verified" }),
    );
    expect(result).toBe("age");
  });

  it("clears an adult with no outstanding requirement", () => {
    expect(deriveGatePhase(status(), null)).toBe("clear");
  });

  it("clears a minor whose consent is verified", () => {
    const result = deriveGatePhase(
      minor({ processing_allowed: true, blocked_reason: null }),
      consent({ status: "verified" }),
    );
    expect(result).toBe("clear");
  });

  it("does not consult consent while the age is unanswered", () => {
    // The age branch runs first, so a payload that is both unanswered and
    // carrying a consent-shaped reason still lands on the age question —
    // which is the only question whose answer decides whether a guardian is
    // needed at all.
    const result = deriveGatePhase(
      status({
        age_answered: false,
        age_band: null,
        processing_allowed: false,
        blocked_reason: "age_verification_required",
      }),
      consent({ status: "verified" }),
    );
    expect(result).toBe("age");
    expect(result).not.toBe("clear");
  });

  it("asks for a guardian when a minor has no consent at all", () => {
    expect(deriveGatePhase(minor(), null)).toBe("guardian-request");
  });

  it("asks for a guardian when consent was withdrawn", () => {
    const result = deriveGatePhase(
      minor({ blocked_reason: "parental_consent_withdrawn" }),
      consent({ status: "withdrawn" }),
    );
    expect(result).toBe("guardian-request");
  });

  it("asks for a guardian when consent expired", () => {
    const result = deriveGatePhase(
      minor({ blocked_reason: "parental_consent_expired" }),
      consent({ status: "expired" }),
    );
    expect(result).toBe("guardian-request");
  });

  it("asks for a guardian when consent was denied", () => {
    expect(deriveGatePhase(minor(), consent({ status: "denied" }))).toBe("guardian-request");
  });

  it("waits for the code while a consent request is pending", () => {
    // Re-showing the guardian form here would supersede the live request
    // (compliance.py:236-242) and burn a send from the OTP cap.
    const result = deriveGatePhase(
      minor({ blocked_reason: "parental_consent_pending" }),
      consent({ status: "pending" }),
    );
    expect(result).toBe("guardian-verify");
  });

  it("never returns a phase the component cannot render", () => {
    const phases = ["age", "guardian-request", "guardian-verify", "clear"];
    const inputs: Array<[ComplianceStatus, GuardianConsent | null]> = [
      [status(), null],
      [status({ age_answered: false, age_band: null }), null],
      [minor(), null],
      [minor(), consent()],
      [minor(), consent({ status: "verified" })],
      [minor(), consent({ status: "withdrawn" })],
      [minor(), consent({ status: "expired" })],
    ];
    for (const [s, c] of inputs) {
      expect(phases).toContain(deriveGatePhase(s, c));
    }
  });
});

describe("isParentalConsentReason", () => {
  it("accepts every reason the backend can actually return", () => {
    for (const reason of PARENTAL_CONSENT_REASONS) {
      expect(isParentalConsentReason(reason)).toBe(true);
    }
  });

  it("rejects the age reasons and the success code", () => {
    expect(isParentalConsentReason("age_verification_required")).toBe(false);
    expect(isParentalConsentReason("ok")).toBe(false);
  });

  it("rejects null, undefined and anything unknown", () => {
    expect(isParentalConsentReason(null)).toBe(false);
    expect(isParentalConsentReason(undefined)).toBe(false);
    expect(isParentalConsentReason("parental_consent")).toBe(false);
    expect(isParentalConsentReason("parental_consent_REQUIRED")).toBe(false);
  });
});

describe("gateNotice", () => {
  it("says nothing when there is nothing wrong", () => {
    expect(gateNotice(null)).toBeNull();
    expect(gateNotice(status())).toBeNull();
  });

  it("explains an unanswered age", () => {
    expect(gateNotice(status({ age_answered: false, age_band: null }))).toMatch(/under 18/i);
  });

  it("says consent is on its way while it is pending", () => {
    expect(
      gateNotice(minor({ blocked_reason: "parental_consent_pending" })),
    ).toMatch(/code/i);
  });

  it("says consent expired", () => {
    expect(gateNotice(minor({ blocked_reason: "parental_consent_expired" }))).toMatch(
      /expired/i,
    );
  });

  it("says consent was withdrawn", () => {
    expect(gateNotice(minor({ blocked_reason: "parental_consent_withdrawn" }))).toMatch(
      /withdrawn/i,
    );
  });

  it("covers the plain required case", () => {
    expect(gateNotice(minor())).toMatch(/read-only/i);
  });

  it("invents no copy for a reason it does not know", () => {
    // A code from a future backend version must not render a sentence about
    // parental consent that may no longer be what it means.
    expect(gateNotice(minor({ blocked_reason: "something_new" }))).toBeNull();
  });
});
