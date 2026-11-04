import type { AiSettings, AiSettingsUpdate } from "@/lib/api";

/**
 * AI provider settings, as pure data.
 *
 * Three failure modes live behind this panel and none of them is visible to a
 * type check:
 *
 *  1. **`PUT /settings/ai` is a partial update.** Sending the whole form on
 *     every save would re-encrypt an unchanged key, bump `updated_at` and fill
 *     the audit log with changes nobody made. `changedFields` sends a diff.
 *  2. **An empty key field means two different things.** "I did not touch the
 *     masked field" must leave the key alone, while "Clear key" must actually
 *     remove it. The empty string is the wire signal for clearing, so it can
 *     only be sent when the admin asked for it -- never as a side effect of the
 *     field being blank.
 *  3. **The base URL is not free text.** `https://api.openai.com/v1/` and
 *     `.../v1` must behave the same, a missing scheme is a 422 at the server,
 *     and a typo is invisible until the first student asks a question.
 */

/** One OpenAI-compatible provider the panel can prefill. */
export interface AiProviderPreset {
  id: string;
  label: string;
  /** Base URL including the `/v1` segment, or `""` for Custom. */
  baseUrl: string;
  /** A sensible starting model, or `""` for Custom. */
  model: string;
  /** Shown under the selector; no secrets here. */
  hint: string;
}

/**
 * The presets are shortcuts, not a closed set: "Custom OpenAI-compatible" and
 * the two free-text fields accept anything that speaks the OpenAI chat
 * completions shape. That is what makes "any model API" true without a new
 * adapter per vendor.
 */
export const AI_PROVIDERS: readonly AiProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "platform.openai.com - keys start with sk-",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    hint: "Very low latency; free tier available.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    hint: "One key for many vendors; model names are vendor/model.",
  },
  {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    hint: "Open-weight models, OpenAI-compatible endpoint.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    hint: "Low-cost general models.",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "llama-3.3-70b",
    hint: "Fast inference on Cerebras hardware.",
  },
  {
    id: "mistral",
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-large-latest",
    hint: "La Plateforme API.",
  },
  {
    id: "xai",
    label: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-2-latest",
    hint: "xAI's OpenAI-compatible endpoint.",
  },
  {
    id: "gemini-compat",
    label: "Google Gemini (OpenAI-compatible)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    hint: "Gemini's compatibility layer; the native Gemini key below is used by PDF import.",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2",
    hint: "No key needed locally; put any placeholder in the key field if your server requires one.",
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    baseUrl: "http://localhost:1234/v1",
    model: "local-model",
    hint: "Enable the local server in LM Studio first.",
  },
  {
    id: "vllm",
    label: "vLLM / self-hosted",
    baseUrl: "http://localhost:8000/v1",
    model: "your-model",
    hint: "Any vLLM, TGI, LiteLLM or gateway that exposes /chat/completions.",
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    baseUrl: "",
    model: "",
    hint: "Enter the provider's base URL and exact model id.",
  },
] as const;

export function providerPreset(id: string): AiProviderPreset | undefined {
  return AI_PROVIDERS.find((provider) => provider.id === id);
}

/**
 * The preset whose base URL matches, or ``custom``.
 *
 * Used to seed the dropdown from the saved row: a super admin who chose Groq
 * last month should see "Groq" selected, not "Custom" with a URL that happens
 * to be Groq's.
 */
export function matchProvider(baseUrl: string): string {
  const normalised = normaliseUrl(baseUrl);
  const found = AI_PROVIDERS.find(
    (provider) => provider.baseUrl && normaliseUrl(provider.baseUrl) === normalised,
  );
  return found?.id ?? "custom";
}

/** The editable text fields, in render order. Keys are handled separately. */
export const AI_SETTINGS_FIELDS = [
  "chat_base_url",
  "chat_model",
  "gemini_model",
] as const;

export type AiSettingsTextField = (typeof AI_SETTINGS_FIELDS)[number];
export type AiSettingsKeyField = "chat_api_key" | "gemini_api_key";

/** The form's shape: every field a string, including the two key fields. */
export type AiSettingsDraft = {
  chat_base_url: string;
  chat_model: string;
  chat_api_key: string;
  gemini_model: string;
  gemini_api_key: string;
};

export type AiSettingsFieldErrors = Partial<Record<keyof AiSettingsDraft, string>>;

/**
 * `draftFrom` deliberately starts both key fields empty: the server never sends
 * a key, so there is nothing to seed them with. An empty key field means "leave
 * the saved key alone" (see `changedFields`); the masked hint beside it is how
 * the admin knows one exists.
 */
export function draftFrom(settings: AiSettings): AiSettingsDraft {
  return {
    chat_base_url: settings.chat_base_url,
    chat_model: settings.chat_model,
    chat_api_key: "",
    gemini_model: settings.gemini_model,
    gemini_api_key: "",
  };
}

/** URLs are compared without a trailing slash, matching the server. */
function normaliseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** The subset of `draft` that differs from the saved configuration. */
export function changedFields(
  draft: AiSettingsDraft,
  baseline: AiSettings,
  clearedKeys: readonly AiSettingsKeyField[] = [],
): AiSettingsUpdate {
  const patch: AiSettingsUpdate = {};

  const baseUrl = normaliseUrl(draft.chat_base_url);
  if (baseUrl !== normaliseUrl(baseline.chat_base_url)) patch.chat_base_url = baseUrl;

  const chatModel = draft.chat_model.trim();
  if (chatModel !== baseline.chat_model) patch.chat_model = chatModel;

  const geminiModel = draft.gemini_model.trim();
  if (geminiModel !== baseline.gemini_model) patch.gemini_model = geminiModel;

  // A typed key replaces the saved one. A blank field is *not* a clear unless
  // the admin pressed "Clear key", because on first render the field is always
  // blank and a save of the URL would otherwise wipe the credential.
  const chatKey = draft.chat_api_key.trim();
  if (chatKey) patch.chat_api_key = chatKey;
  else if (clearedKeys.includes("chat_api_key")) patch.chat_api_key = "";

  const geminiKey = draft.gemini_api_key.trim();
  if (geminiKey) patch.gemini_api_key = geminiKey;
  else if (clearedKeys.includes("gemini_api_key")) patch.gemini_api_key = "";

  return patch;
}

const PLACEHOLDER_KEYS = new Set(["change-me", "changeme", "none"]);

/**
 * Per-field messages that mirror `AiSettingsUpdate`'s validators.
 *
 * A missing key is not an error: the resolver falls back to the environment, so
 * a deployment that has `OPENAI_API_KEY` set must still be able to save a base
 * URL. The key checks are about format, not presence.
 */
export function validateAiSettings(draft: AiSettingsDraft): AiSettingsFieldErrors {
  const errors: AiSettingsFieldErrors = {};

  const baseUrl = normaliseUrl(draft.chat_base_url);
  if (!baseUrl) {
    errors.chat_base_url = "Base URL is required.";
  } else if (!/^https?:\/\//i.test(baseUrl)) {
    errors.chat_base_url = "Use an http:// or https:// URL.";
  } else {
    try {
      // Rejects `http://` with no host and other shapes the server's urlparse
      // check would reject, without a network call.
      const parsed = new URL(baseUrl);
      if (!parsed.hostname) errors.chat_base_url = "Include a host name.";
    } catch {
      errors.chat_base_url = "Enter a valid URL, e.g. https://api.openai.com/v1.";
    }
  }

  const chatModel = draft.chat_model.trim();
  if (!chatModel) errors.chat_model = "Model is required.";
  else if (chatModel.length > 120) errors.chat_model = "Keep it to 120 characters.";

  const geminiModel = draft.gemini_model.trim();
  if (!geminiModel) errors.gemini_model = "Gemini model is required.";
  else if (geminiModel.length > 120) errors.gemini_model = "Keep it to 120 characters.";

  for (const field of ["chat_api_key", "gemini_api_key"] as const) {
    const value = draft[field].trim();
    if (!value) continue;
    if (value.length > 500) {
      errors[field] = "Keep it to 500 characters.";
    } else if (PLACEHOLDER_KEYS.has(value.toLowerCase())) {
      errors[field] = "That is a placeholder, not a real API key.";
    }
  }

  return errors;
}

/** Human label for where a key came from, for the panel's status line. */
export function keySourceLabel(source: AiSettings["chat_api_key_source"]): string {
  if (source === "database") return "saved in console";
  if (source === "environment") return "from server environment";
  return "not configured";
}
