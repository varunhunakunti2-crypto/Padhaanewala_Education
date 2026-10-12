import { describe, expect, it } from "vitest";

import type { SiteSettings } from "@/lib/api";
import { changedFields, draftFrom, validateSettings } from "@/lib/settings-form";

/**
 * The pure half of the Settings panel.
 *
 * `tests/api-endpoints.test.ts` already holds `adminApi.settings` /
 * `adminApi.updateSettings` against the backend's declared routes. What it
 * cannot see is the two behaviours here: that a save sends a *diff* (so it does
 * not rewrite untouched values or fill the audit log) and that the values are
 * validated before they reach a table the public site reads.
 */

const SERVER: SiteSettings = {
  site_name: "padhaanewala",
  support_email: "hello@padhaanewala.in",
  contact_phone: "+91 98765 43210",
  counselling_hours: "Mon\u2013Sat, 9 AM \u2013 8 PM IST",
  default_timezone: "Asia/Kolkata",
  number_formatting: "indian",
  updated_at: "2026-10-12T00:00:00+00:00",
};

describe("draftFrom", () => {
  it("copies every editable field and drops the read-only one", () => {
    const draft = draftFrom(SERVER);
    expect(Object.keys(draft).sort()).toEqual([
      "contact_phone",
      "counselling_hours",
      "default_timezone",
      "number_formatting",
      "site_name",
      "support_email",
    ]);
    expect(draft.site_name).toBe("padhaanewala");
  });
});

describe("changedFields", () => {
  it("is empty when nothing changed, so Save can stay disabled", () => {
    expect(changedFields(draftFrom(SERVER), SERVER)).toEqual({});
  });

  it("returns only the edited field", () => {
    const draft = { ...draftFrom(SERVER), contact_phone: "+91 90000 00000" };
    expect(changedFields(draft, SERVER)).toEqual({ contact_phone: "+91 90000 00000" });
  });

  it("does not treat surrounding whitespace as a change", () => {
    const draft = { ...draftFrom(SERVER), site_name: "  padhaanewala  " };
    expect(changedFields(draft, SERVER)).toEqual({});
  });

  it("trims the value it does send", () => {
    const draft = { ...draftFrom(SERVER), site_name: "  New Name  " };
    expect(changedFields(draft, SERVER)).toEqual({ site_name: "New Name" });
  });

  it("reports a multi-field edit as a multi-field diff", () => {
    const draft = {
      ...draftFrom(SERVER),
      site_name: "Renamed",
      number_formatting: "international",
    };
    expect(changedFields(draft, SERVER)).toEqual({
      site_name: "Renamed",
      number_formatting: "international",
    });
  });
});

describe("validateSettings", () => {
  it("accepts the seeded values", () => {
    expect(validateSettings(draftFrom(SERVER))).toEqual({});
  });

  it("requires a non-blank site name", () => {
    expect(validateSettings({ ...draftFrom(SERVER), site_name: "   " })).toHaveProperty(
      "site_name",
    );
  });

  it("rejects a site name beyond the column width", () => {
    expect(validateSettings({ ...draftFrom(SERVER), site_name: "x".repeat(121) })).toHaveProperty(
      "site_name",
    );
  });

  it("rejects a malformed support email", () => {
    expect(validateSettings({ ...draftFrom(SERVER), support_email: "nope" })).toHaveProperty(
      "support_email",
    );
  });

  it("rejects a phone number containing letters", () => {
    expect(validateSettings({ ...draftFrom(SERVER), contact_phone: "call me" })).toHaveProperty(
      "contact_phone",
    );
  });

  it("rejects a timezone outside the offered set", () => {
    expect(
      validateSettings({ ...draftFrom(SERVER), default_timezone: "Mars/Olympus" }),
    ).toHaveProperty("default_timezone");
  });

  it("rejects a number format outside the offered set", () => {
    expect(
      validateSettings({ ...draftFrom(SERVER), number_formatting: "roman" }),
    ).toHaveProperty("number_formatting");
  });
});
