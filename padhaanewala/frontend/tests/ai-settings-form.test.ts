import { describe, expect, it } from "vitest";

import type { AiSettings } from "@/lib/api";
import {
  AI_PROVIDERS,
  changedFields,
  draftFrom,
  keySourceLabel,
  matchProvider,
  providerPreset,
  validateAiSettings,
} from "@/lib/ai-settings-form";

/**
 * The pure half of the AI settings panel.
 *
 * Three behaviours here are invisible to a type check and expensive to get
 * wrong in production:
 *
 *  1. a save sends a *diff*, so it does not re-encrypt an unchanged key or
 *     write changes nobody made;
 *  2. a blank key field means "keep the saved key", while an explicit clear
 *     means "remove it" -- the difference is an API key that still works;
 *  3. a malformed base URL is caught before it becomes a provider 404 that
 *     reads like a bad credential.
 */

const SERVER: AiSettings = {
  chat_base_url: "https://api.openai.com/v1",
  chat_model: "gpt-4o-mini",
  chat_api_key_set: true,
  chat_api_key_hint: "****a1b2",
  chat_api_key_source: "database",
  gemini_model: "gemini-2.5-flash",
  gemini_api_key_set: false,
  gemini_api_key_hint: null,
  gemini_api_key_source: "none",
  updated_at: "2026-11-05T00:00:00+00:00",
  updated_by: 7,
};

describe("draftFrom", () => {
  it("copies the editable fields and leaves both key fields empty", () => {
    const draft = draftFrom(SERVER);
    expect(draft).toEqual({
      chat_base_url: "https://api.openai.com/v1",
      chat_model: "gpt-4o-mini",
      chat_api_key: "",
      gemini_model: "gemini-2.5-flash",
      gemini_api_key: "",
    });
  });

  it("never seeds a key from the response, because the response has none", () => {
    expect(draftFrom(SERVER).chat_api_key).toBe("");
    expect(draftFrom(SERVER).gemini_api_key).toBe("");
  });
});

describe("changedFields", () => {
  it("is empty for an untouched form, so Save stays disabled", () => {
    expect(changedFields(draftFrom(SERVER), SERVER)).toEqual({});
  });

  it("sends only the edited text field", () => {
    const draft = { ...draftFrom(SERVER), chat_model: "gpt-4.1-mini" };
    expect(changedFields(draft, SERVER)).toEqual({ chat_model: "gpt-4.1-mini" });
  });

  it("does not treat surrounding whitespace as a change", () => {
    const draft = { ...draftFrom(SERVER), chat_model: "  gpt-4o-mini  " };
    expect(changedFields(draft, SERVER)).toEqual({});
  });

  it("does not treat a trailing slash on the base URL as a change", () => {
    const draft = { ...draftFrom(SERVER), chat_base_url: "https://api.openai.com/v1/" };
    expect(changedFields(draft, SERVER)).toEqual({});
  });

  it("sends a typed key as a replacement", () => {
    const draft = { ...draftFrom(SERVER), chat_api_key: "  sk-new-key  " };
    expect(changedFields(draft, SERVER)).toEqual({ chat_api_key: "sk-new-key" });
  });

  it("does not clear the saved key just because the field is blank", () => {
    // This is the regression that would rotate a working key out of existence
    // the first time a super admin changed only the model.
    expect(changedFields(draftFrom(SERVER), SERVER).chat_api_key).toBeUndefined();
  });

  it("sends an empty string only when a clear was requested", () => {
    expect(changedFields(draftFrom(SERVER), SERVER, ["chat_api_key"])).toEqual({
      chat_api_key: "",
    });
    expect(changedFields(draftFrom(SERVER), SERVER, ["gemini_api_key"])).toEqual({
      gemini_api_key: "",
    });
  });

  it("lets a typed key win over a pending clear", () => {
    const draft = { ...draftFrom(SERVER), chat_api_key: "sk-typed" };
    expect(changedFields(draft, SERVER, ["chat_api_key"])).toEqual({
      chat_api_key: "sk-typed",
    });
  });

  it("can send a URL and a model in one save", () => {
    const draft = {
      ...draftFrom(SERVER),
      chat_base_url: "https://api.groq.com/openai/v1/",
      chat_model: "llama-3.3-70b-versatile",
    };
    expect(changedFields(draft, SERVER)).toEqual({
      chat_base_url: "https://api.groq.com/openai/v1",
      chat_model: "llama-3.3-70b-versatile",
    });
  });
});

describe("validateAiSettings", () => {
  it("accepts the stored configuration unchanged", () => {
    expect(validateAiSettings(draftFrom(SERVER))).toEqual({});
  });

  it("accepts a local provider, because self-hosting is a first-class case", () => {
    const draft = {
      ...draftFrom(SERVER),
      chat_base_url: "http://localhost:11434/v1",
      chat_model: "llama3.2",
    };
    expect(validateAiSettings(draft)).toEqual({});
  });

  it("requires a base URL and both model names", () => {
    const errors = validateAiSettings({
      chat_base_url: "",
      chat_model: "",
      chat_api_key: "",
      gemini_model: "   ",
      gemini_api_key: "",
    });
    expect(errors.chat_base_url).toMatch(/required/i);
    expect(errors.chat_model).toMatch(/required/i);
    expect(errors.gemini_model).toMatch(/required/i);
  });

  it("rejects a URL without a scheme", () => {
    const draft = { ...draftFrom(SERVER), chat_base_url: "api.openai.com/v1" };
    expect(validateAiSettings(draft).chat_base_url).toMatch(/http/i);
  });

  it("rejects a non-http scheme", () => {
    const draft = { ...draftFrom(SERVER), chat_base_url: "ftp://example.com/v1" };
    expect(validateAiSettings(draft).chat_base_url).toMatch(/http/i);
  });

  it("reports an over-long model name", () => {
    const draft = { ...draftFrom(SERVER), chat_model: "x".repeat(121) };
    expect(validateAiSettings(draft).chat_model).toMatch(/120/);
  });

  it("rejects the placeholder that ships in .env.example", () => {
    const draft = { ...draftFrom(SERVER), chat_api_key: "change-me" };
    expect(validateAiSettings(draft).chat_api_key).toMatch(/placeholder/i);
  });

  it("does not require a key, because the environment can supply it", () => {
    const draft = { ...draftFrom(SERVER), chat_api_key: "", gemini_api_key: "" };
    expect(validateAiSettings(draft)).toEqual({});
  });
});

describe("provider presets", () => {
  it("offers a custom option, so any OpenAI-compatible endpoint is reachable", () => {
    const custom = providerPreset("custom");
    expect(custom?.baseUrl).toBe("");
    expect(AI_PROVIDERS.length).toBeGreaterThan(5);
  });

  it("matches a stored base URL to its preset", () => {
    expect(matchProvider("https://api.openai.com/v1")).toBe("openai");
    expect(matchProvider("https://api.groq.com/openai/v1")).toBe("groq");
  });

  it("ignores a trailing slash when matching", () => {
    expect(matchProvider("https://api.openai.com/v1/")).toBe("openai");
  });

  it("falls back to custom for an endpoint it does not know", () => {
    expect(matchProvider("https://llm.internal.example/v1")).toBe("custom");
  });
});

describe("keySourceLabel", () => {
  it("distinguishes a console key, an environment key and no key", () => {
    expect(keySourceLabel("database")).toMatch(/console/);
    expect(keySourceLabel("environment")).toMatch(/environment/);
    expect(keySourceLabel("none")).toMatch(/not configured/);
  });
});
