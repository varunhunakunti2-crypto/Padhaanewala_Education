import type { AdminRole } from "@/lib/api";

/**
 * The decisions behind the admin console's role editor, kept out of the
 * component so they can be tested without a DOM.
 *
 * The panel this replaced had a single hardcoded "make admin" toggle. That was not
 * a gap in convenience — it was a gap in *truth*. `PATCH /users/{id}` accepts any
 * subset of the seeded role catalogue and enforces a privilege ceiling over it,
 * so thirteen roles were reachable through the API and exactly one through the
 * console.
 *
 * Naively replacing the toggle with a checkbox per role reproduces the original
 * defect in a new place: the browser would offer `super_admin` to a plain admin
 * and the write would come back 403. So the ordering lives on the server only.
 * `GET /roles` returns every role with a `grantable` flag computed by the same
 * `outranks()` call that the write path enforces, and this module only renders
 * that answer. It never ranks roles itself.
 */

/** Roles this module will not let an admin end up with. */
export type RoleSelection =
  | { ok: true; ids: number[] }
  | { ok: false; error: string };

/**
 * Turn a set of role *names* into the `role_ids` the API accepts.
 *
 * Two guards, both of which prevent a successful-looking request that quietly
 * does the wrong thing:
 *
 *  - An empty set is refused. `PATCH /users/{id}` rejects it (a user with no roles
 *    cannot authenticate, since the role claim is empty), so sending it would
 *    spend a round trip to learn something the console already knows.
 *  - A name that does not resolve is refused. `role_ids` is a replacement, not a
 *    merge: if one name failed to resolve and we sent the rest, every other role
 *    on the account would be *stripped* while the UI reported success. Losing a
 *    role is the same outcome as the silently-dropped-unknown-id bug R5.2 was
 *    written to prevent, reached from the other direction.
 */
export function roleIdsFor(
  names: Iterable<string>,
  catalogue: readonly AdminRole[],
): RoleSelection {
  const wanted = [...new Set(names)];

  if (wanted.length === 0) {
    return {
      ok: false,
      error: "An account with no roles cannot sign in. Pick at least one role.",
    };
  }

  const byName = new Map(catalogue.map((r) => [r.name, r]));
  const ids: number[] = [];
  const unresolved: string[] = [];

  for (const name of wanted) {
    const role = byName.get(name);
    if (role) ids.push(role.id);
    else unresolved.push(name);
  }

  if (unresolved.length > 0) {
    return {
      ok: false,
      error: `Could not resolve ${unresolved.join(", ")}. Reload the console and try again — nothing was changed.`,
    };
  }

  return { ok: true, ids };
}

/**
 * Whether a role's checkbox is disabled in the editor.
 *
 * A role the caller cannot *grant* stays editable when the account already holds
 * it, because unchecking it is a **revocation**, which R4.8's removal ceiling
 * governs separately from granting (`can_revoke` is deliberately looser than
 * `outranks`). Disabling a held role would make it impossible to remove, which is
 * the opposite of what the ceiling intends.
 *
 * Everything else is disabled. Showing the row rather than hiding it is
 * deliberate: a hidden role reads as "this account has never held this", and an
 * admin would draw the wrong conclusion about the account's history.
 */
export function isRoleCheckboxDisabled(
  role: AdminRole,
  heldByAccount: readonly string[],
): boolean {
  return !role.grantable && !heldByAccount.includes(role.name);
}

/** Human-readable reason shown under a disabled role. */
export function roleLockedReason(role: AdminRole, heldByAccount: readonly string[]): string | null {
  if (!isRoleCheckboxDisabled(role, heldByAccount)) return null;
  return "Above your privilege level — it cannot be granted from here.";
}

/**
 * A `+role` / `−role` summary of a pending change, or `null` when nothing differs.
 *
 * The backend audits this as a single `update_user_roles` row, so the toast has
 * to name the whole delta — a summary that said only "Roles updated" would hide
 * the one thing the audit trail exists to record.
 */
export function describeRoleDelta(
  current: readonly string[],
  next: Iterable<string>,
): string[] | null {
  const wanted = new Set(next);
  const currentSet = new Set(current);
  const added = [...wanted].filter((r) => !currentSet.has(r));
  const removed = [...currentSet].filter((r) => !wanted.has(r));
  if (added.length === 0 && removed.length === 0) return null;
  return [...added.map((r) => `+${r}`), ...removed.map((r) => `−${r}`)];
}

/**
 * The result range for a paged listing, e.g. `Showing 1–25 of 312`.
 *
 * This exists because the panel it replaced reported nothing at all: it rendered
 * whatever single unfiltered request returned and left the admin to assume that
 * was every account on the platform. With more accounts than fit in one page,
 * that assumption is silently wrong.
 *
 * Returns `No accounts match` for an empty result rather than "Showing 1–0 of 0",
 * which is what naive arithmetic produces and which reads as a bug.
 */
export function describePageRange(
  total: number,
  offset: number,
  limit: number,
): string {
  if (total <= 0) return "No accounts match";
  const start = Math.min(offset, total - 1) + 1;
  const end = Math.min(offset + limit, total);
  return `Showing ${start}–${end} of ${total}`;
}