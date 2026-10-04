import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { complianceApi, type ComplianceStatus, type GuardianConsent } from "@/lib/api";

/**
 * Request shapes for the DPDP compliance surface.
 *
 * `lib/api.ts` is mostly a declaration table: ~100 arrow functions whose whole
 * body is `apiFetch(path, init)`. Nothing type-checks the *path* or the *method*
 * — a method could post to the wrong URL, or send `PUT` where the router only
 * declares `PATCH`, and `tsc`, lint and a production build would all pass.
 *
 * The backend models behind this surface are also `extra="forbid"`, so a body
 * carrying an unrecognised key is a 422 rather than a silently dropped field.
 * That makes the body shape part of the contract too, and it is the half that
 * a required-field check (see `request-contract.test.ts`) does not reach: that
 * test proves the client *declares* what the server needs; this one proves it
 * actually *sends* it.
 */

let calls: Array<{ url: string; method: string; body: unknown }>;

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: (init?.method ?? "GET").toUpperCase(),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ?? null,
      });
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const last = () => {
  const call = calls.at(-1);
  expect(call, "expected at least one fetch").toBeDefined();
  return call!;
};

/**
 * The request path, without the base.
 *
 * `API_BASE` is `/api/v1` (relative) unless `NEXT_PUBLIC_API_URL` is set, and
 * `new URL()` on a path with no base throws — so the path is taken literally
 * when there is no origin to parse.
 */
const path = () => {
  const raw = last().url.split("?")[0];
  return raw.startsWith("http") ? new URL(raw).pathname : raw;
};

describe("complianceApi paths", () => {
  it("reads the gate from a single status endpoint", async () => {
    await complianceApi.status();
    expect(path()).toBe("/api/v1/compliance/status");
    expect(last().method).toBe("GET");
  });

  it("declares an age band with POST to /age", async () => {
    await complianceApi.declareAge("under_18");
    expect(path()).toBe("/api/v1/compliance/age");
    expect(last().method).toBe("POST");
    expect(last().body).toEqual({ age_band: "under_18" });
  });

  it("reads parental consent from its own endpoint", async () => {
    await complianceApi.parentalConsent();
    expect(path()).toBe("/api/v1/compliance/parental-consent");
    expect(last().method).toBe("GET");
  });

  it("requests consent at the documented nested path", async () => {
    await complianceApi.requestParentalConsent({
      guardian_name: "Sunita Sharma",
      guardian_mobile: "9876543210",
      guardian_email: null,
    });
    expect(path()).toBe("/api/v1/compliance/parental-consent/request");
    expect(last().method).toBe("POST");
  });

  it("verifies consent with the code alone", async () => {
    await complianceApi.verifyParentalConsent("123456");
    expect(path()).toBe("/api/v1/compliance/parental-consent/verify");
    expect(last().body).toEqual({ code: "123456" });
  });

  it("withdraws consent without a body argument", async () => {
    // s.9(5): withdrawal must be as easy as the grant was. No code, no
    // confirmation token — and the request must still carry a JSON body, since
    // `apiFetch` only omits Content-Type for FormData.
    await complianceApi.withdrawParentalConsent();
    expect(path()).toBe("/api/v1/compliance/parental-consent/withdraw");
    expect(last().method).toBe("POST");
    expect(last().body).toEqual({});
  });

  it("lists and raises data-principal requests on the same collection", async () => {
    await complianceApi.myRequests();
    expect(path()).toBe("/api/v1/compliance/requests");
    expect(last().method).toBe("GET");

    await complianceApi.createRequest({ request_type: "erasure", details: "Please delete my data." });
    expect(path()).toBe("/api/v1/compliance/requests");
    expect(last().method).toBe("POST");
    expect(last().body).toEqual({
      request_type: "erasure",
      details: "Please delete my data.",
    });
  });

  it("keeps the requester's own collection separate from the staff queue", async () => {
    // The two are the difference between a data principal seeing only their
    // requests and an admin seeing everyone's. Getting the path wrong in either
    // direction is an authorisation bug, not a typo.
    await complianceApi.adminRequests();
    expect(path()).toBe("/api/v1/compliance/admin/requests");
    expect(last().method).toBe("GET");

    await complianceApi.updateAdminRequest(42, { status: "acknowledged" });
    expect(path()).toBe("/api/v1/compliance/admin/requests/42");
    expect(last().method).toBe("PATCH");
    expect(last().body).toEqual({ status: "acknowledged" });
  });
});

describe("complianceApi bodies", () => {
  it("never sends an optional field that the caller left out", async () => {
    // `extra="forbid"` on the server means an invented key is a 422. Building
    // the body by spreading the caller's object (rather than picking keys)
    // would eventually send something the schema does not know.
    await complianceApi.createRequest({ request_type: "access", details: "x" });
    expect(Object.keys(last().body as object).sort()).toEqual(["details", "request_type"]);
  });

  it("omits null guardian contacts rather than inventing them", async () => {
    await complianceApi.requestParentalConsent({ guardian_name: "A B", guardian_email: "a@b.c" });
    const body = last().body as Record<string, unknown>;
    expect(body.guardian_email).toBe("a@b.c");
    expect(body.guardian_name).toBe("A B");
    expect(body).not.toHaveProperty("guardian_mobile");
  });
});

describe("complianceApi response decoding", () => {
  const statusPayload: ComplianceStatus = {
    age_band: "under_18",
    is_minor: true,
    age_answered: true,
    processing_allowed: false,
    blocked_reason: "parental_consent_required",
    blocked_message: "Consent needed",
    parental_consent: null,
    sla_days: 90,
  };

  it("decodes a full gate payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(statusPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await complianceApi.status();
    expect(result).toEqual(statusPayload);
    expect(result.sla_days).toBe(90);
  });

  it("decodes `null` consent as null rather than throwing", async () => {
    // A minor with no consent row gets the literal JSON `null` — valid JSON,
    // but only if the caller does not assume an object. This is the case that
    // a `nullableGet` special case would have been written for, and does not
    // need one.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }),
      ),
    );

    await expect(complianceApi.parentalConsent()).resolves.toBeNull();
  });

  it("surfaces a server rejection as an error carrying the detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "Parental consent is only collected from users declared under 18" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(complianceApi.requestParentalConsent({ guardian_name: "A B" })).rejects.toThrow(
      /only collected from users declared under 18/,
    );
  });

  it("decodes the shape a consent row actually has", async () => {
    const consent: GuardianConsent = {
      id: 9,
      status: "pending",
      verification_channel: "sms",
      requested_at: "2026-10-01T10:00:00Z",
      verified_at: null,
      withdrawn_at: null,
      expires_at: "2027-10-01T10:00:00Z",
      consent_version: "1.0",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(consent), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await complianceApi.requestParentalConsent({ guardian_name: "A B" });
    expect(result.status).toBe("pending");
    expect(result.verification_channel).toBe("sms");
  });
});
