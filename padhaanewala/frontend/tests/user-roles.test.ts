import { describe, expect, it } from "vitest";

import type { AdminRole } from "@/lib/api";
import {
  describePageRange,
  describeRoleDelta,
  isRoleCheckboxDisabled,
  roleIdsFor,
  roleLockedReason,
} from "@/lib/user-roles";

/**
 * The admin console's role-management rules.
 *
 * The panel this replaced shipped a single hardcoded "make admin" toggle. Every
 * one of these assertions exists because that toggle encoded a policy guess in
 * the client: it checked `roles.includes("super_admin")` — a second copy of the
 * privilege ordering in `app/roles.py` — to decide whether to show one button,
 * and offered nothing for the other thirteen roles the write path fully supports.
 *
 * A client-side copy of a server policy is the failure mode this suite is about
 * elsewhere too (BUG-05's `PAGE_SIZE`, the audit log's `user_email`): it is
 * correct on the day it is written and silently wrong the day the policy moves.
 * So the ordering now has exactly one implementation, on the server, and these
 * tests pin the console's obligation to obey it rather than re-derive it.
 */

function role(name: string, grantable: boolean, id = name.length): AdminRole {
  return { id, name, description: null, grantable };
}

const CATALOGUE: AdminRole[] = [
  role("super_admin", false, 1),
  role("admin", true, 2),
  role("counsellor", true, 3),
  role("student", true, 4),
];

describe("roleIdsFor", () => {
  it("resolves names to the ids the API accepts", () => {
    const result = roleIdsFor(["counsellor", "student"], CATALOGUE);
    expect(result).toEqual({ ok: true, ids: [3, 4] });
  });

  it("refuses an empty selection, because such an account cannot sign in", () => {
    // `PATCH /users/{id}` rejects an empty `role_ids` for exactly this reason.
    // The console knows it already, so it should not spend a round trip.
    const result = roleIdsFor([], CATALOGUE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least one role/i);
  });

  it("refuses to send a partial set when a name does not resolve", () => {
    // `role_ids` replaces the account's roles rather than merging into them. If
    // `ghost_role` silently dropped out of the request, the account would lose
    // every other role *and* the toast would report success. This is R5.2's
    // dropped-unknown-id bug reached from the other direction.
    const result = roleIdsFor(["counsellor", "ghost_role"], CATALOGUE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ghost_role/);
  });

  it("does not silently drop a duplicate selection", () => {
    // The backend de-duplicates with `dict.fromkeys`; matching that keeps the
    // payload identical to what the server will store.
    const result = roleIdsFor(["counsellor", "counsellor", "student"], CATALOGUE);
    expect(result).toEqual({ ok: true, ids: [3, 4] });
  });
});

describe("a role the caller cannot grant", () => {
  it("is disabled when the account does not hold it", () => {
    expect(isRoleCheckboxDisabled(role("super_admin", false), ["student"])).toBe(true);
  });

  it("stays editable when the account already holds it, so it can be revoked", () => {
    // Unchecking is a *removal*, governed by `can_revoke`, which is deliberately
    // looser than `outranks` so a peer at the caller's own level can be demoted.
    // Disabling held roles would make them impossible to remove — the opposite
    // of what the ceiling intends.
    expect(isRoleCheckboxDisabled(role("super_admin", false), ["super_admin"])).toBe(false);
  });

  it("explains why it is locked, and says nothing when it is not", () => {
    expect(roleLockedReason(role("super_admin", false), ["student"])).toMatch(
      /privilege level/i,
    );
    expect(roleLockedReason(role("counsellor", true), ["student"])).toBeNull();
    expect(roleLockedReason(role("super_admin", false), ["super_admin"])).toBeNull();
  });

  it("never derives grantability from the role's own name", () => {
    // The whole point of `grantable` being server-computed. A test that only
    // passed because the name happens to match the ordering would keep passing
    // after the ordering changed and the console went back to lying.
    expect(isRoleCheckboxDisabled(role("admin", false), ["student"])).toBe(true);
    expect(isRoleCheckboxDisabled(role("student", true), [])).toBe(false);
  });
});

describe("describeRoleDelta", () => {
  it("names additions and removals, because that is the audit trail's content", () => {
    expect(describeRoleDelta(["student"], ["student", "counsellor"])).toEqual([
      "+counsellor",
    ]);
    expect(describeRoleDelta(["student", "counsellor"], ["student"])).toEqual([
      "−counsellor",
    ]);
    expect(describeRoleDelta(["student"], ["counsellor", "student"])).toEqual([
      "+counsellor",
    ]);
  });

  it("reports no change rather than inventing one", () => {
    expect(describeRoleDelta(["student", "counsellor"], ["counsellor", "student"])).toBeNull();
    expect(describeRoleDelta([], [])).toBeNull();
  });
});

describe("describePageRange", () => {
  it("states the full total instead of implying the page is everything", () => {
    // The panel this replaced rendered one unfiltered request and said nothing
    // about truncation, so an admin with 312 accounts had no way to know.
    expect(describePageRange(312, 0, 25)).toBe("Showing 1–25 of 312");
    expect(describePageRange(312, 25, 25)).toBe("Showing 26–50 of 312");
    expect(describePageRange(312, 300, 25)).toBe("Showing 301–312 of 312");
  });

  it("does not overshoot the end on a partial final page", () => {
    expect(describePageRange(30, 25, 25)).toBe("Showing 26–30 of 30");
  });

  it("says so when nothing matches, instead of rendering 'Showing 1–0 of 0'", () => {
    expect(describePageRange(0, 0, 25)).toBe("No accounts match");
  });

  it("clamps a stale offset rather than printing a backwards range", () => {
    // Filters shrink the result set while a request is in flight, so the offset
    // that comes back can exceed the new total. Naive arithmetic would render
    // "Showing 101–100 of 100".
    expect(describePageRange(100, 500, 25)).toBe("Showing 100–100 of 100");
  });
});