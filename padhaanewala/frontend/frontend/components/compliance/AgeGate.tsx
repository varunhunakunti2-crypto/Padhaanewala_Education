"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  Loader2,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  UserRound,
} from "lucide-react";

import { complianceApi, type AgeBand, type ComplianceStatus, type GuardianConsent } from "@/lib/api";
import { deriveGatePhase, type GatePhase } from "@/lib/compliance-gate";
import { useApp } from "@/lib/context/AppContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * DPDP Act s.9 — the age gate and the verifiable parental-consent flow.
 *
 * ## Why this exists at all
 *
 * Registration asks for an age band (`schemas/auth.py:28`), so every account
 * created after Phase 9 already answers it. This gate exists for the accounts
 * that came first, where `users.age_band` is NULL — and an unanswered band is
 * deliberately *not* read as "adult" (`models/user.py:60`). Treating silence as
 * consent is the exact failure the ₹200 crore children's-data penalty is for.
 *
 * ## What it is, and is not
 *
 * It is a blocking prompt. It is not the security boundary: the server is.
 * `require_processing_consent` refuses every personal-data write with a 403 and
 * a machine-readable `code`, so a user who dismisses, reloads or bypasses this
 * dialog still cannot save a college, post a review or edit their profile. The
 * same reasoning is written down at `RequireAdmin.tsx:8-19`.
 *
 * ## Why it cannot be dismissed
 *
 * The age question has two answers and both of them lift the gate — there is no
 * third option that means "ask me later", because deferring is the state the
 * backend already treats as blocked. `Modal` is not used here precisely because
 * it binds Escape and the backdrop to `onClose`; a gate whose close control does
 * nothing is worse than one that has no close control.
 */

/** `GatePhase` plus the two states that have no payload behind them. */
type Phase = "idle" | GatePhase | "unavailable";

interface FieldError {
  name?: string;
  contact?: string;
  code?: string;
}

export function AgeGate() {
  const { isAuthenticated, authReady, logout } = useApp();

  // Returning `null` here rather than hiding the flow behind a boolean is the
  // reset mechanism: an unmounted child loses its state, so signing out and
  // signing in as someone else cannot inherit the previous session's step. The
  // alternative — clearing state in an effect — is what
  // `react-hooks/set-state-in-effect` exists to stop.
  if (!authReady || !isAuthenticated) return null;
  return <AgeGateFlow onSignOut={logout} />;
}

function AgeGateFlow({ onSignOut }: { onSignOut: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [consent, setConsent] = useState<GuardianConsent | null>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<FieldError>({});

  // Guardian form
  const [guardianName, setGuardianName] = useState("");
  const [guardianMobile, setGuardianMobile] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [code, setCode] = useState("");

  /**
   * Fetch the gate, without touching state.
   *
   * Kept separate from the effect for the same reason `useAdminResource` chains
   * off a loader: `react-hooks/set-state-in-effect` rejects a function that both
   * runs in an effect and writes state, because the write would be synchronous
   * on the first tick. The writes below live in `.then` callbacks instead.
   */
  const loadGate = useCallback(async () => {
    const next = await complianceApi.status();
    const latest = next.age_answered && next.is_minor ? await complianceApi.parentalConsent() : null;
    return { next, latest };
  }, []);

  /**
   * Recompute the phase from a fresh status payload.
   *
   * The whole decision lives in `lib/compliance-gate.ts` so it can be tested
   * without mounting anything; this only stores the consent alongside it.
   */
  const applyGate = useCallback((next: ComplianceStatus, latest: GuardianConsent | null) => {
    setConsent(latest);
    setPhase(deriveGatePhase(next, latest));
  }, []);

  const onLoaded = useCallback(
    ({ next, latest }: { next: ComplianceStatus; latest: GuardianConsent | null }) =>
      applyGate(next, latest),
    [applyGate],
  );

  const onLoadFailed = useCallback(() => {
    // Fail *open on reads*, not on writes. The server refuses the write
    // regardless, so blocking the whole site because one GET failed would
    // trade a working site for a gate that protects nothing.
    setPhase("unavailable");
  }, []);

  useEffect(() => {
    let ignore = false;
    loadGate()
      .then((result) => {
        if (!ignore) onLoaded(result);
      })
      .catch(() => {
        if (!ignore) onLoadFailed();
      });
    return () => {
      ignore = true;
    };
  }, [loadGate, onLoaded, onLoadFailed]);

  /** Re-read the gate after an action. Event handlers only, never an effect. */
  const refresh = useCallback(async () => {
    try {
      onLoaded(await loadGate());
    } catch {
      onLoadFailed();
    }
  }, [loadGate, onLoaded, onLoadFailed]);

  const busy = () => {
    setPending(true);
    setError("");
    setFieldError({});
  };

  const fail = (err: unknown, fallback: string) => {
    setError(err instanceof Error && err.message ? err.message : fallback);
    setPending(false);
  };

  /* ------------------------------------------------------------- the age step */

  const onAge = async (band: AgeBand) => {
    busy();
    try {
      const declared = await complianceApi.declareAge(band);
      if (declared.processing_allowed) {
        setPhase("clear");
        return;
      }
      await refresh();
    } catch (err) {
      fail(err, "We could not save that. Please try again.");
    } finally {
      // Reaching the guardian step must not leave the spinner latched: the
      // next control the user touches would be disabled with no visible cause.
      setPending(false);
    }
  };

  /* ------------------------------------------------- the guardian consent steps */

  const onGuardianRequest = async (e: FormEvent) => {
    e.preventDefault();
    const mobile = guardianMobile.replace(/\D/g, "");
    const name = guardianName.trim();

    if (name.length < 2) {
      setFieldError({ name: "Please enter your parent's or guardian's full name." });
      return;
    }
    // Mirror the backend validator rather than inventing a second rule: it
    // strips a 91 prefix and then demands 10 digits starting 6-9.
    if (!mobile && !guardianEmail.trim()) {
      setFieldError({ contact: "A mobile number or an email address is required, so we can verify they agreed." });
      return;
    }
    if (mobile && !/^(91)?[6-9]\d{9}$/.test(mobile)) {
      setFieldError({ contact: "Enter a valid 10-digit Indian mobile number." });
      return;
    }
    if (
      guardianEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())
    ) {
      setFieldError({ contact: "Enter a valid email address." });
      return;
    }

    busy();
    try {
      const created = await complianceApi.requestParentalConsent({
        guardian_name: name,
        guardian_mobile: mobile || null,
        guardian_email: guardianEmail.trim() || null,
      });
      setConsent(created);
      setPhase("guardian-verify");
      setPending(false);
    } catch (err) {
      fail(err, "We could not send the code. Please try again.");
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (value.length < 4) {
      setFieldError({ code: "Enter the code your guardian received." });
      return;
    }
    busy();
    try {
      await complianceApi.verifyParentalConsent(value);
      await refresh();
      setPending(false);
      setError("");
    } catch (err) {
      setFieldError({ code: err instanceof Error && err.message ? err.message : "That code is not correct." });
      setPending(false);
    }
  };

  /* ------------------------------------------------------------------ render */

  if (phase === "idle" || phase === "clear" || phase === "unavailable") return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-desc"
    >
      {/* No backdrop action: the backdrop is visual only, so there is no
          onClick here to wire to a close that must not happen. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
      <div className="relative z-10 max-h-[92vh] w-full overflow-auto rounded-t-3xl bg-white px-5 py-6 shadow-2xl sm:max-w-md sm:rounded-2xl sm:px-7 sm:py-7 dark:bg-slate-900 dark:border dark:border-slate-800 animate-fade-up">
        {phase === "age" && (
          <AgeStep pending={pending} error={error} onAnswer={onAge} />
        )}

        {phase === "guardian-request" && (
          <GuardianRequestStep
            pending={pending}
            error={error}
            fieldError={fieldError}
            guardianName={guardianName}
            guardianMobile={guardianMobile}
            guardianEmail={guardianEmail}
            onName={setGuardianName}
            onMobile={setGuardianMobile}
            onEmail={setGuardianEmail}
            onSubmit={onGuardianRequest}
            onSignOut={onSignOut}
          />
        )}

        {phase === "guardian-verify" && (
          <GuardianVerifyStep
            pending={pending}
            error={error}
            fieldError={fieldError}
            consent={consent}
            code={code}
            onCode={(v) => {
              setCode(v);
              setFieldError({});
            }}
            onSubmit={onVerify}
            onResend={() => {
              setCode("");
              setPhase("guardian-request");
              setError("");
              setFieldError({});
            }}
            onSignOut={onSignOut}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 1 */

function StepShell({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  tone: "purple" | "amber";
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="text-center">
      <span
        className={cn(
          "mx-auto grid h-14 w-14 place-items-center rounded-full",
          tone === "purple"
            ? "bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-300"
            : "bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-300",
        )}
      >
        {icon}
      </span>
      <h2
        id="age-gate-title"
        className="font-display mt-4 text-xl font-extrabold tracking-tight text-purple-950 dark:text-white"
      >
        {title}
      </h2>
      <div id="age-gate-desc" className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-slate-400">
        {description}
      </div>
      <div className="mt-5 text-left">{children}</div>
    </div>
  );
}

function InlineError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function FieldErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
      {children}
    </p>
  );
}

function AgeStep({
  pending,
  error,
  onAnswer,
}: {
  pending: boolean;
  error: string;
  onAnswer: (band: AgeBand) => void;
}) {
  return (
    <StepShell
      icon={<ShieldQuestion className="h-7 w-7" aria-hidden="true" />}
      tone="purple"
      title="Before you continue"
      description={
        <>
          Indian law requires us to know whether you are under 18 before we
          process your personal data. Your answer is saved to your account and
          you can correct it later.
        </>
      }
    >
      {error && <InlineError>{error}</InlineError>}

      <fieldset className="space-y-2.5" disabled={pending}>
        <legend className="sr-only">Are you 18 years of age or older?</legend>

        {(
          [
            {
              band: "18_plus" as AgeBand,
              label: "I am 18 or older",
              hint: "You can use every feature straight away.",
            },
            {
              band: "under_18" as AgeBand,
              label: "I am under 18",
              hint: "We will ask a parent or guardian to confirm before we save anything to your account.",
            },
          ]
        ).map((option) => (
          <label
            key={option.band}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 px-4 py-3.5 transition hover:border-purple-300 hover:bg-purple-50/60 dark:border-slate-700 dark:hover:border-purple-700 dark:hover:bg-purple-950/40"
          >
            <input
              type="radio"
              name="age-band"
              value={option.band}
              className="mt-1 h-4 w-4 shrink-0 border-gray-300 text-purple-600 accent-purple-600 focus:ring-purple-500"
              onChange={() => onAnswer(option.band)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900 dark:text-slate-100">
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="mt-4 text-xs leading-relaxed text-gray-400 dark:text-slate-500">
        Why we ask:{" "}
        <a
          href="/legal/dpdp-notice"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-purple-600 hover:underline dark:text-purple-400"
        >
          our DPDP notice
        </a>{" "}
        explains what we collect and why.
      </p>
    </StepShell>
  );
}

/* ------------------------------------------------------------------ step 2 */

function GuardianRequestStep({
  pending,
  error,
  fieldError,
  guardianName,
  guardianMobile,
  guardianEmail,
  onName,
  onMobile,
  onEmail,
  onSubmit,
  onSignOut,
}: {
  pending: boolean;
  error: string;
  fieldError: FieldError;
  guardianName: string;
  guardianMobile: string;
  guardianEmail: string;
  onName: (v: string) => void;
  onMobile: (v: string) => void;
  onEmail: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onSignOut: () => void;
}) {
  return (
    <StepShell
      icon={<ShieldAlert className="h-7 w-7" aria-hidden="true" />}
      tone="amber"
      title="Parental consent needed"
      description={
        <>
          Because you told us you are under 18, we need a parent or guardian to
          agree before we save anything to your account. We will send them a
          one-time code — nothing else happens until they enter it.
        </>
      }
    >
      {error && <InlineError>{error}</InlineError>}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="guardian-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Parent or guardian full name
          </label>
          <input
            id="guardian-name"
            type="text"
            autoComplete="name"
            value={guardianName}
            onChange={(e) => onName(e.target.value)}
            placeholder="Sunita Sharma"
            aria-invalid={Boolean(fieldError.name)}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-purple-950"
          />
          <FieldErrorText>{fieldError.name}</FieldErrorText>
        </div>

        <div>
          <label htmlFor="guardian-mobile" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Their mobile number
          </label>
          <input
            id="guardian-mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            autoComplete-national
            value={guardianMobile}
            onChange={(e) => onMobile(e.target.value)}
            placeholder="98765 43210"
            aria-invalid={Boolean(fieldError.contact)}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-purple-950"
          />
          <p className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
            Preferred — the code arrives by SMS.
          </p>
        </div>

        <div>
          <label htmlFor="guardian-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Their email address
          </label>
          <input
            id="guardian-email"
            type="email"
            autoComplete="email"
            value={guardianEmail}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="parent@example.com"
            aria-invalid={Boolean(fieldError.contact)}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-purple-950"
          />
          <FieldErrorText>{fieldError.contact}</FieldErrorText>
          <p className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
            Used only if a mobile number cannot be given.
          </p>
        </div>

        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </span>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send consent request
            </>
          )}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-400 dark:text-slate-500">
        <p className="leading-relaxed">Until this is done, your account is read-only.</p>
        <button
          type="button"
          onClick={onSignOut}
          className="shrink-0 font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </StepShell>
  );
}

/* ------------------------------------------------------------------ step 3 */

function GuardianVerifyStep({
  pending,
  error,
  fieldError,
  consent,
  code,
  onCode,
  onSubmit,
  onResend,
  onSignOut,
}: {
  pending: boolean;
  error: string;
  fieldError: FieldError;
  consent: GuardianConsent | null;
  code: string;
  onCode: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onResend: () => void;
  onSignOut: () => void;
}) {
  const channel = consent?.verification_channel === "sms" ? "mobile" : "email";

  return (
    <StepShell
      icon={<ShieldCheck className="h-7 w-7" aria-hidden="true" />}
      tone="purple"
      title="Enter the code we sent"
      description={
        <>
          We sent a one-time code to your guardian&apos;s {channel}. Ask them to
          read it to you, then enter it below. Codes expire and can only be used
          once.
        </>
      }
    >
      {error && <InlineError>{error}</InlineError>}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="guardian-code" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Consent code
          </label>
          <input
            id="guardian-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            value={code}
            onChange={(e) => onCode(e.target.value)}
            placeholder="123456"
            aria-invalid={Boolean(fieldError.code)}
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-center font-mono text-lg tracking-[0.35em] text-gray-900 shadow-sm transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-purple-950"
          />
          <FieldErrorText>{fieldError.code}</FieldErrorText>
        </div>

        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Verifying…
            </span>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Confirm consent
            </>
          )}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-400 dark:text-slate-500">
        <button
          type="button"
          onClick={onResend}
          className="font-medium text-purple-600 underline-offset-2 hover:underline dark:text-purple-400"
        >
          Send a different code
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="shrink-0 font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </StepShell>
  );
}

/**
 * Small status banner for pages that want to explain *why* an action is
 * refused without re-implementing the gate. Renders nothing when there is
 * nothing to say.
 */
export function ConsentNotice({ blockedReason }: { blockedReason?: string | null }) {
  if (!blockedReason) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      <UserRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Your account cannot save changes yet — we still need a parent or guardian to
        confirm your age. Finish the prompt that appeared when you signed in.
      </span>
    </div>
  );
}
