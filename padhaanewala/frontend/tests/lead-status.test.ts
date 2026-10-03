import { describe, expect, it } from "vitest";

import { LEAD_STATUSES } from "@/lib/api";
import {
  TERMINAL_LEAD_STATUSES,
  canAdvanceLead,
  nextLeadStatus,
} from "@/lib/lead-status";

/**
 * The lead quick-action ladder.
 *
 * This exists because the button was wrong for a long time and nothing
 * noticed. `LeadsSection` advanced a lead with
 *
 *     (s) => (s === "new" ? "contacted" : "converted")
 *
 * and `converted` is not in `LEAD_STATUSES` — the server's `LEAD_STATUSES` in
 * `backend/app/schemas/engagement.py` has no such member, so
 * `PATCH /leads/{id}/status` answered 422. The first click worked; every
 * click after it silently did nothing. Lint, type check and build all passed,
 * because `"converted"` is a perfectly good `string`.
 *
 * The strongest assertion here is therefore the negative one: nothing this
 * module can return may be a value the server would reject.
 */

describe("nextLeadStatus", () => {
  it("never returns a status the server does not accept", () => {
    // The bug in one assertion. If anyone reintroduces a hardcoded step
    // (including "converted"), this fails.
    for (const status of LEAD_STATUSES) {
      const next = nextLeadStatus(status);
      if (next !== null) expect(LEAD_STATUSES).toContain(next);
    }
  });

  it("never returns the string 'converted'", () => {
    for (const status of LEAD_STATUSES) {
      expect(nextLeadStatus(status)).not.toBe("converted");
    }
  });

  it("walks the funnel in order from the start", () => {
    expect(nextLeadStatus("new")).toBe("contacted");
    expect(nextLeadStatus("contacted")).toBe("qualified");
    expect(nextLeadStatus("qualified")).toBe("proposal");
  });

  it("stops at every terminal status", () => {
    for (const status of TERMINAL_LEAD_STATUSES) {
      expect(nextLeadStatus(status)).toBeNull();
    }
  });

  it("treats won, lost and closed as terminal", () => {
    // Spelled out rather than derived from the set, so that dropping a status
    // from TERMINAL_LEAD_STATUSES is a test failure and not a silent behaviour
    // change for a lead that is already won.
    expect(nextLeadStatus("won")).toBeNull();
    expect(nextLeadStatus("lost")).toBeNull();
    expect(nextLeadStatus("closed")).toBeNull();
  });

  it("returns null for a status it does not recognise", () => {
    // A status the backend adds ahead of this list must produce no request
    // rather than a guessed value that 422s.
    expect(nextLeadStatus("converted")).toBeNull();
    expect(nextLeadStatus("nonsense")).toBeNull();
    expect(nextLeadStatus("")).toBeNull();
  });

  it("is case sensitive, so a stray capitalisation is not silently accepted", () => {
    expect(nextLeadStatus("New")).toBeNull();
    expect(nextLeadStatus("NEW")).toBeNull();
  });
});

describe("canAdvanceLead", () => {
  it("agrees with nextLeadStatus", () => {
    for (const status of LEAD_STATUSES) {
      expect(canAdvanceLead(status)).toBe(nextLeadStatus(status) !== null);
    }
  });

  it("hides the button for a finished lead", () => {
    expect(canAdvanceLead("won")).toBe(false);
    expect(canAdvanceLead("closed")).toBe(false);
  });

  it("shows the button for a lead still in play", () => {
    expect(canAdvanceLead("new")).toBe(true);
    expect(canAdvanceLead("qualified")).toBe(true);
  });
});
