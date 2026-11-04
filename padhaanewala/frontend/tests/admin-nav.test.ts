import { describe, expect, it } from "vitest";

import { NAV } from "@/components/admin/nav";

/**
 * The admin sidebar's privilege marks.
 *
 * `AdminDashboard` filters this list for the current role, and the backend
 * enforces the same rule. This file pins the one part a type check cannot: that
 * the AI settings entry is *marked* as super-admin-only. Losing that flag would
 * show a plain admin a nav item whose every request 403s.
 */

const visible = (isSuperAdmin: boolean) =>
  NAV.filter((item) => !item.superAdminOnly || isSuperAdmin);

describe("admin navigation", () => {
  it("exposes exactly one entry for AI settings", () => {
    const entries = NAV.filter((item) => item.key === "aisettings");
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("AI Settings");
  });

  it("marks AI settings as super-admin-only", () => {
    expect(NAV.find((item) => item.key === "aisettings")?.superAdminOnly).toBe(true);
  });

  it("hides it from a plain admin but shows it to a super admin", () => {
    expect(visible(false).some((item) => item.key === "aisettings")).toBe(false);
    expect(visible(true).some((item) => item.key === "aisettings")).toBe(true);
  });

  it("leaves ordinary settings visible to every admin", () => {
    const entry = NAV.find((item) => item.key === "settings");
    expect(entry?.superAdminOnly).toBeUndefined();
    expect(visible(false).some((item) => item.key === "settings")).toBe(true);
  });

  it("keeps AI settings adjacent to those ordinary settings", () => {
    const keys = NAV.map((item) => item.key);
    const settingsAt = keys.indexOf("settings");
    expect(keys[settingsAt - 1]).toBe("aisettings");
  });
});
