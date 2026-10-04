"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

import {
  complianceApi,
  type ComplianceStatus,
  type DataRequest,
  type DataRequestType,
} from "@/lib/api";
import { gateNotice } from "@/lib/compliance-gate";
import { Button } from "@/components/ui/Button";

/**
 * The data-principal surface: what we hold, and how to make us stop.
 *
 * Two obligations meet here, and they are deliberately one panel rather than
 * two, because a user looking for "delete my data" should not have to know
 * which of the two statutes their question falls under.
 *
 * - **DPDP s.9** — a minor's consent status, and withdrawal of it. The backend
 *   endpoint takes no code and no confirmation token on purpose: s.9(5) requires
 *   withdrawal to be as easy as the grant was, and asking a child to obtain a
 *   second factor before they can *stop* processing inverts the protection.
 * - **DPDP Rules 2025** — raising a request and watching its 90-day clock.
 *   `due_at` is fixed by the server at intake, so this panel only ever renders
 *   the number it is given; recomputing it here would produce a deadline that
 *   moves whenever the page is refreshed.
 *
 * The staff queue behind `GET /compliance/admin/requests` is a separate,
 * admin-only surface and is not rendered here.
 */

type LoadState = "loading" | "ready" | "error";

const REQUEST_TYPES: ReadonlyArray<{ value: DataRequestType; label: string; hint: string }> = [
  {
    value: "access",
    label: "Give me a copy of my data",
    hint: "Everything the account holds about you, in a portable form.",
  },
  {
    value: "correction",
    label: "Correct something you hold about me",
    hint: "A name, a number, a preference that is wrong.",
  },
  {
    value: "erasure",
    label: "Delete my personal data",
    hint: "We keep the record that you asked, and the minimum needed to honour it.",
  },
  {
    value: "withdrawal",
    label: "Stop processing my data",
    hint: "Consent withdrawn — we stop, without deleting the account record.",
  },
  {
    value: "grievance",
    label: "Raise a grievance",
    hint: "Something went wrong and you want it on record with a deadline.",
  },
  {
    value: "nomination",
    label: "Nominate someone to act for me",
    hint: "A parent, guardian or advocate may exercise your rights for you.",
  },
];

const STATUS_LABEL: Record<DataRequest["status"], string> = {
  received: "Received",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Declined",
};

const CLOSED: ReadonlyArray<DataRequest["status"]> = ["completed", "rejected"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function PrivacyPanel() {
  const [state, setState] = useState<LoadState>("loading");
  const [status, setStatus] = useState<ComplianceStatus | null>(null);
  const [requests, setRequests] = useState<DataRequest[]>([]);

  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<DataRequestType>("access");
  const [details, setDetails] = useState("");
  const [formError, setFormError] = useState("");
  const [raised, setRaised] = useState<DataRequest | null>(null);

  const load = useCallback(
    () =>
      Promise.all([complianceApi.status(), complianceApi.myRequests()]).then(
        ([nextStatus, nextRequests]) => {
          setStatus(nextStatus);
          setRequests(nextRequests);
          setState("ready");
        },
      ),
    [],
  );

  useEffect(() => {
    let ignore = false;
    load().catch(() => {
      if (!ignore) setState("error");
    });
    return () => {
      ignore = true;
    };
  }, [load]);

  const withdraw = async () => {
    setBusy(true);
    setNotice("");
    try {
      await complianceApi.withdrawParentalConsent();
      await load();
      setNotice("Consent withdrawn. We have stopped processing your data.");
    } catch (err) {
      setNotice(err instanceof Error && err.message ? err.message : "We could not do that.");
    } finally {
      setBusy(false);
    }
  };

  const raise = async (e: FormEvent) => {
    e.preventDefault();
    const text = details.trim();
    if (text.length < 10) {
      setFormError("Please describe the request in a sentence or two (at least 10 characters).");
      return;
    }
    setFormError("");
    setBusy(true);
    setNotice("");
    try {
      const created = await complianceApi.createRequest({ request_type: type, details: text });
      setRaised(created);
      setDetails("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error && err.message ? err.message : "We could not log that.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="mt-5 flex items-center gap-2.5 px-6 py-8 text-[14px] text-[#8A96A9] dark:text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading your privacy settings…
      </div>
    );
  }

  if (state === "error" || !status) {
    return (
      <div className="mt-5 px-6 py-8 text-center">
        <p className="text-[14px] text-[#55637B] dark:text-slate-400">
          We could not load your privacy settings.
        </p>
        <button
          type="button"
          onClick={() => {
            setState("loading");
            load().catch(() => setState("error"));
          }}
          className="mt-2 text-[13px] font-bold text-[#3159C9] hover:underline dark:text-indigo-400"
        >
          Try again
        </button>
      </div>
    );
  }

  const consent = status.parental_consent;
  /** Why the account is read-only, from the shared decision in `compliance-gate`. */
  const blocked = gateNotice(status);

  return (
    <div className="divide-y divide-[#EEE9E2] dark:divide-slate-800">
      {/* -------------------------------------------------------- the state */}
      <div className="px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#8A96A9] dark:text-slate-500">
              Age and consent
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-[15px] font-semibold text-[#16204A] dark:text-white">
              {status.age_band === null ? (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  Not answered
                </>
              ) : status.is_minor ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
                  Under 18 —{" "}
                  {consent?.status === "verified" ? "consent confirmed" : "consent outstanding"}
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  18 or older
                </>
              )}
            </p>

            {blocked ? (
              <p className="mt-1.5 text-[14px] text-[#55637B] dark:text-slate-400">{blocked}</p>
            ) : consent && consent.status === "verified" && consent.verified_at ? (
              <p className="mt-1.5 text-[14px] text-[#55637B] dark:text-slate-400">
                Confirmed by your guardian on {formatDate(consent.verified_at)}.
                Valid until {formatDate(consent.expires_at)}.
              </p>
            ) : status.is_minor ? (
              <p className="mt-1.5 text-[14px] text-[#55637B] dark:text-slate-400">
                Until a parent or guardian confirms, we cannot save anything to your
                account. The prompt reappears when you sign in.
              </p>
            ) : null}
          </div>

          {consent && consent.status !== "withdrawn" ? (
            <button
              type="button"
              onClick={withdraw}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#EEE9E2] px-3.5 py-2 text-[13px] font-bold text-[#55637B] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-800 dark:hover:text-red-400"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldOff className="h-4 w-4" aria-hidden="true" />
              )}
              Withdraw consent
            </button>
          ) : null}
        </div>

        {notice ? (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-xl bg-[#EEF1FF] px-3.5 py-2.5 text-[13px] text-[#3159C9] dark:bg-indigo-500/15 dark:text-indigo-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        ) : null}

        <p className="mt-4 text-[13px] leading-relaxed text-[#8A96A9] dark:text-slate-500">
          We record only whether you are under 18, never your date of birth — that is
          the only distinction the law turns on.{" "}
          <a
            href="/legal/dpdp-notice"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#3159C9] hover:underline dark:text-indigo-400"
          >
            Read the full notice
          </a>
          .
        </p>
      </div>

      {/* ------------------------------------------------- raise a request */}
      <form onSubmit={raise} className="px-6 py-5" noValidate>
        <p className="text-[13px] font-bold uppercase tracking-wide text-[#8A96A9] dark:text-slate-500">
          Exercise your rights
        </p>
        <p className="mt-1.5 text-[14px] text-[#55637B] dark:text-slate-400">
          Every request is logged with a statutory deadline of{" "}
          <strong>{status.sla_days} days</strong> from the day we receive it.
        </p>

        {raised ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Request <strong>#{raised.id}</strong> logged on {formatDate(raised.received_at)}.
              It is due by <strong>{formatDate(raised.due_at)}</strong>. We will email you
              when it moves.
            </span>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {REQUEST_TYPES.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 transition ${
                type === option.value
                  ? "border-indigo-400 bg-[#EEF1FF] dark:border-indigo-500 dark:bg-indigo-500/15"
                  : "border-[#EEE9E2] hover:border-indigo-300 dark:border-slate-700 dark:hover:border-indigo-700"
              }`}
            >
              <input
                type="radio"
                name="dsr-type"
                value={option.value}
                checked={type === option.value}
                onChange={() => {
                  setType(option.value);
                  setFormError("");
                }}
                className="mt-1 h-4 w-4 shrink-0 border-gray-300 accent-indigo-600"
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[#16204A] dark:text-white">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-[#8A96A9] dark:text-slate-500">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label
            htmlFor="dsr-details"
            className="mb-1.5 block text-sm font-medium text-[#55637B] dark:text-slate-300"
          >
            What do you need?
          </label>
          <textarea
            id="dsr-details"
            rows={3}
            value={details}
            onChange={(e) => {
              setDetails(e.target.value);
              setFormError("");
            }}
            placeholder="Describe what you are asking for, and any detail we need to find the right records."
            aria-invalid={Boolean(formError)}
            className="w-full rounded-xl border border-[#EEE9E2] bg-white px-3.5 py-2.5 text-sm text-[#16204A] outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-950"
          />
          {formError ? (
            <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="mt-3"
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Log this request
        </Button>
      </form>

      {/* ------------------------------------------------------ my requests */}
      <div className="px-6 py-5">
        <p className="text-[13px] font-bold uppercase tracking-wide text-[#8A96A9] dark:text-slate-500">
          Your requests
        </p>

        {requests.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-[#8A96A9] dark:text-slate-500">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Nothing logged yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((r) => {
              const closed = CLOSED.includes(r.status);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[#FAF9F6] px-4 py-3 dark:bg-slate-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#16204A] dark:text-white">
                      #{r.id} ·{" "}
                      {REQUEST_TYPES.find((t) => t.value === r.request_type)?.label ??
                        r.request_type}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-[#55637B] dark:text-slate-400">
                      {r.details}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#8A96A9] dark:text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Received {formatDate(r.received_at)} · due {formatDate(r.due_at)}
                      {closed ? null : r.overdue ? (
                        <span className="font-bold text-red-600 dark:text-red-400">
                          · {Math.abs(r.days_remaining)} days overdue
                        </span>
                      ) : (
                        <span className="font-bold text-[#3159C9] dark:text-indigo-400">
                          · {r.days_remaining} day{r.days_remaining === 1 ? "" : "s"} left
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                      closed
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : r.overdue
                          ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                          : "bg-[#EEF1FF] text-[#3159C9] dark:bg-indigo-500/15 dark:text-indigo-300"
                    }`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
