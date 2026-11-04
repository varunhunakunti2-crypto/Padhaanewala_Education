"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Trash2,
  Zap,
} from "lucide-react";

import {
  adminApi,
  ApiError,
  type AiSettings,
  type AiSettingsTestResult,
  type AiTarget,
} from "@/lib/api";
import {
  AI_PROVIDERS,
  changedFields,
  draftFrom,
  keySourceLabel,
  matchProvider,
  providerPreset,
  validateAiSettings,
  type AiSettingsDraft,
  type AiSettingsFieldErrors,
  type AiSettingsKeyField,
} from "@/lib/ai-settings-form";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/FormField";
import { useApp } from "@/lib/context/AppContext";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { Panel, SectionHeading } from "@/components/admin/primitives";

/**
 * Super-admin AI provider configuration.
 *
 * Two providers live here because the product uses two, for different jobs:
 * the student assistant (any OpenAI-compatible endpoint) and the PDF question
 * importer (native Gemini). They are one panel but two independent
 * credentials, so a super admin can rotate one without touching the other.
 *
 * The server never sends a key back. The input therefore starts empty and says
 * "leave blank to keep" when one is stored; the hint beside it is the only way
 * to recognise *which* key is active. "Clear key" is a deliberate second action
 * because an empty field and an intentional clear must not look the same on the
 * wire -- see `changedFields`.
 */
export function AiSettingsSection() {
  const { roles, rolesReady } = useApp();
  const isSuperAdmin = roles.includes("super_admin");

  const { data, error, reload } = useAdminResource(() => adminApi.aiSettings(), {
    forbiddenMessage: "Super admin access is required to manage AI settings.",
  });

  const [freshest, setFreshest] = useState<AiSettings | null>(null);
  const current = freshest ?? data;

  // The nav entry is already filtered, but a bookmarked `?section=aisettings`
  // reaches here for a plain admin too. Saying so is friendlier than an empty
  // form that 403s on save.
  if (rolesReady && !isSuperAdmin) {
    return (
      <div className="space-y-5">
        <SectionHeading
          title="AI settings"
          description="Change the model provider and API keys used by the site."
        />
        <Panel title="Super admin only">
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            Only a super admin can view or change provider credentials. Ask a
            super admin if this needs updating.
          </p>
        </Panel>
      </div>
    );
  }

  if (error && !current) {
    return (
      <div className="space-y-5">
        <SectionHeading
          title="AI settings"
          description="Change the model provider and API keys used by the site."
        />
        <Panel title="Settings unavailable">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              {error}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={reload}>
              Retry
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="space-y-5">
        <SectionHeading
          title="AI settings"
          description="Change the model provider and API keys used by the site."
        />
        <Panel title="Loading settings">
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the current configuration…
          </p>
        </Panel>
      </div>
    );
  }

  return <AiSettingsForm key={current.updated_at} initial={current} onSaved={setFreshest} />;
}

function AiSettingsForm({
  initial,
  onSaved,
}: {
  initial: AiSettings;
  onSaved: (saved: AiSettings) => void;
}) {
  const { showToast } = useApp();
  const [baseline, setBaseline] = useState<AiSettings>(initial);
  const [draft, setDraft] = useState<AiSettingsDraft>(() => draftFrom(initial));
  const [cleared, setCleared] = useState<AiSettingsKeyField[]>([]);
  const [errors, setErrors] = useState<AiSettingsFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<AiTarget | null>(null);
  const [tests, setTests] = useState<Partial<Record<AiTarget, AiSettingsTestResult>>>({});
  const [showChatKey, setShowChatKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [providerId, setProviderId] = useState(() =>
    matchProvider(initial.chat_base_url),
  );

  const patch = useMemo(
    () => changedFields(draft, baseline, cleared),
    [draft, baseline, cleared],
  );
  const dirty = Object.keys(patch).length > 0;

  const update = (field: keyof AiSettingsDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const chooseProvider = (id: string) => {
    setProviderId(id);
    const preset = providerPreset(id);
    if (!preset || !preset.baseUrl) return;
    // Only the wiring changes. A typed key is left alone: the admin may have
    // pasted the provider's key before choosing its preset.
    setDraft((current) => ({
      ...current,
      chat_base_url: preset.baseUrl,
      chat_model: preset.model || current.chat_model,
    }));
  };

  const toggleClear = (field: AiSettingsKeyField) => {
    setCleared((current) =>
      current.includes(field) ? current.filter((entry) => entry !== field) : [...current, field],
    );
    // A clear supersedes anything typed in the box.
    setDraft((current) => ({ ...current, [field]: "" }));
  };

  const save = async () => {
    if (saving) return;

    const found = validateAiSettings(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      showToast({
        variant: "error",
        title: "Nothing was saved",
        description: "Fix the highlighted fields and try again.",
      });
      return;
    }

    setSaving(true);
    try {
      const saved = await adminApi.updateAiSettings(patch);
      setBaseline(saved);
      setDraft(draftFrom(saved));
      setCleared([]);
      onSaved(saved);
      showToast({
        variant: "success",
        title: "AI settings saved",
        description: "The new configuration takes effect on the next request.",
      });
    } catch (err: unknown) {
      showToast({
        variant: "error",
        title: "Could not save AI settings",
        description: err instanceof ApiError ? err.message : "Could not reach the API.",
      });
    } finally {
      setSaving(false);
    }
  };

  const test = async (target: AiTarget) => {
    if (testing) return;
    setTesting(target);
    try {
      const result = await adminApi.testAiSettings(
        target === "chat"
          ? {
              target,
              base_url: draft.chat_base_url.trim(),
              model: draft.chat_model.trim(),
              // Undefined means "use the saved key"; the server treats an
              // absent field and an empty string differently.
              api_key: draft.chat_api_key.trim() || undefined,
            }
          : {
              target,
              model: draft.gemini_model.trim(),
              api_key: draft.gemini_api_key.trim() || undefined,
            },
      );
      setTests((current) => ({ ...current, [target]: result }));
      showToast({
        variant: result.ok ? "success" : "error",
        title: result.ok ? "Connection successful" : "Connection failed",
        description: result.message,
      });
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Could not reach the API.";
      setTests((current) => ({
        ...current,
        [target]: {
          ok: false,
          target,
          model: target === "chat" ? draft.chat_model : draft.gemini_model,
          message,
          latency_ms: 0,
        },
      }));
      showToast({ variant: "error", title: "Could not run the test", description: message });
    } finally {
      setTesting(null);
    }
  };

  const saveButton = (
    <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      {saving ? "Saving…" : "Save changes"}
    </Button>
  );

  return (
    <div className="space-y-5">
      <SectionHeading
        title="AI settings"
        description="Super-admin only. Keys are encrypted at rest and are never sent back to the browser."
        action={saveButton}
      />

      <Panel
        title="Student assistant"
        description="Any OpenAI-compatible chat endpoint: OpenAI, Groq, OpenRouter, Together, DeepSeek, a local model, or your own gateway."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="ai-provider" label="Provider preset" className="sm:col-span-2">
            <Select
              id="ai-provider"
              value={providerId}
              onChange={(event) => chooseProvider(event.target.value)}
            >
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-400">
              {providerPreset(providerId)?.hint ??
                "Enter the provider's base URL and exact model id."}
            </p>
          </Field>

          <Field id="ai-chat-base-url" label="Base URL" error={errors.chat_base_url}>
            <Input
              id="ai-chat-base-url"
              value={draft.chat_base_url}
              maxLength={500}
              placeholder="https://api.openai.com/v1"
              error={Boolean(errors.chat_base_url)}
              onChange={(event) => update("chat_base_url", event.target.value)}
            />
          </Field>

          <Field id="ai-chat-model" label="Model" error={errors.chat_model}>
            <Input
              id="ai-chat-model"
              value={draft.chat_model}
              maxLength={120}
              placeholder="gpt-4o-mini"
              error={Boolean(errors.chat_model)}
              onChange={(event) => update("chat_model", event.target.value)}
            />
          </Field>

          <Field id="ai-chat-key" label="API key" error={errors.chat_api_key} className="sm:col-span-2">
            <SecretInput
              id="ai-chat-key"
              value={draft.chat_api_key}
              visible={showChatKey}
              onToggleVisible={() => setShowChatKey((value) => !value)}
              error={Boolean(errors.chat_api_key)}
              onChange={(value) => update("chat_api_key", value)}
              placeholder={
                baseline.chat_api_key_set
                  ? "Leave blank to keep the saved key"
                  : "Paste the provider API key"
              }
              hint={baseline.chat_api_key_hint}
            />
            <KeyStatus
              isSet={baseline.chat_api_key_set}
              hint={baseline.chat_api_key_hint}
              source={baseline.chat_api_key_source}
              clearing={cleared.includes("chat_api_key")}
              onClear={() => toggleClear("chat_api_key")}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => test("chat")}
            disabled={testing !== null}
          >
            {testing === "chat" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Test connection
          </Button>
          <span className="text-xs text-slate-400">
            Uses the values above; nothing is saved by testing.
          </span>
        </div>
        <TestResult result={tests.chat} />
      </Panel>

      <Panel
        title="PDF question import"
        description="Native Gemini key and model, used when an admin uploads a question paper."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="ai-gemini-model" label="Gemini model" error={errors.gemini_model}>
            <Input
              id="ai-gemini-model"
              value={draft.gemini_model}
              maxLength={120}
              placeholder="gemini-2.5-flash"
              error={Boolean(errors.gemini_model)}
              onChange={(event) => update("gemini_model", event.target.value)}
            />
          </Field>

          <Field id="ai-gemini-key" label="Gemini API key" error={errors.gemini_api_key}>
            <SecretInput
              id="ai-gemini-key"
              value={draft.gemini_api_key}
              visible={showGeminiKey}
              onToggleVisible={() => setShowGeminiKey((value) => !value)}
              error={Boolean(errors.gemini_api_key)}
              onChange={(value) => update("gemini_api_key", value)}
              placeholder={
                baseline.gemini_api_key_set
                  ? "Leave blank to keep the saved key"
                  : "Paste the Gemini API key"
              }
              hint={baseline.gemini_api_key_hint}
            />
          </Field>
        </div>

        <div className="mt-2">
          <KeyStatus
            isSet={baseline.gemini_api_key_set}
            hint={baseline.gemini_api_key_hint}
            source={baseline.gemini_api_key_source}
            clearing={cleared.includes("gemini_api_key")}
            onClear={() => toggleClear("gemini_api_key")}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => test("gemini")}
            disabled={testing !== null}
          >
            {testing === "gemini" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Test connection
          </Button>
          <span className="text-xs text-slate-400">
            Leave a key blank to use GEMINI_API_KEY from the server environment.
          </span>
        </div>
        <TestResult result={tests.gemini} />
      </Panel>

      <p className="text-xs text-slate-400">
        {dirty ? "Unsaved changes. " : ""}
        Last saved{" "}
        {new Date(baseline.updated_at).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        {baseline.updated_by ? ` by user #${baseline.updated_by}` : ""}.
      </p>
    </div>
  );
}

/** A password-style field with a show/hide toggle. */
function SecretInput({
  id,
  value,
  visible,
  error,
  placeholder,
  hint,
  onToggleVisible,
  onChange,
}: {
  id: string;
  value: string;
  visible: boolean;
  error: boolean;
  placeholder: string;
  hint: string | null;
  onToggleVisible: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        maxLength={500}
        autoComplete="off"
        spellCheck={false}
        placeholder={hint ? `${placeholder} (${hint})` : placeholder}
        error={error}
        className="pr-11"
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? "Hide API key" : "Show API key"}
        title={visible ? "Hide API key" : "Show API key"}
        className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** "Active key ****a1b2 (saved in console)" plus the optional Clear action. */
function KeyStatus({
  isSet,
  hint,
  source,
  clearing,
  onClear,
}: {
  isSet: boolean;
  hint: string | null;
  source: AiSettings["chat_api_key_source"];
  clearing: boolean;
  onClear: () => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      <KeyRound className="h-3.5 w-3.5 text-slate-400" />
      {clearing ? (
        <span className="font-medium text-amber-600">
          Will be cleared when you save.{" "}
          <button type="button" className="underline" onClick={onClear}>
            Undo
          </button>
        </span>
      ) : (
        <span className="text-slate-500">
          {isSet
            ? `Active key ${hint ?? "set"} (${keySourceLabel(source)})`
            : "No key saved — the server environment is used if one is set."}
        </span>
      )}
      {isSet && !clearing && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 font-semibold text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear key
        </button>
      )}
    </div>
  );
}

function TestResult({ result }: { result?: AiSettingsTestResult }) {
  if (!result) return null;
  return (
    <p
      className={
        result.ok
          ? "mt-3 flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700"
          : "mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
      }
    >
      {result.ok ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <span>
        {result.message}{" "}
        <span className="opacity-70">({result.latency_ms} ms)</span>
      </span>
    </p>
  );
}

/** A labelled field with an inline, per-field error message. */
function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
