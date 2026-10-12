"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { adminApi, ApiError, type SiteSettings } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/FormField";
import { useApp } from "@/lib/context/AppContext";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { Panel, SectionHeading } from "@/components/admin/primitives";
import {
  SETTINGS_NUMBER_FORMATS,
  SETTINGS_TIMEZONES,
  changedFields,
  draftFrom,
  validateSettings,
  type SettingsDraft,
  type SettingsField,
  type SettingsFieldErrors,
} from "@/lib/settings-form";

/**
 * Platform-wide configuration, backed by `GET`/`PUT /api/v1/settings`.
 *
 * This panel used to be decoration: the inputs were seeded from the `SITE`
 * constant and the Save button only raised a toast, so every field looked
 * editable and stored nothing. It now reads the singleton row and writes back
 * only what changed.
 *
 * The form is remounted by key whenever a newer server value exists (see
 * `SettingsSection`), which is what re-seeds it after a save or a Retry:
 * the draft is always "the server value plus the admin's edits", never a
 * second source of truth, and a stale edit after a Retry is discarded rather
 * than merged.
 */
export function SettingsSection() {
  const { data, error, reload } = useAdminResource(() => adminApi.settings(), {
    forbiddenMessage: "You do not have permission to view site settings.",
  });

  // `data` is whatever the loader last fetched; `freshest` is the most recent
  // save's response, which is newer than any fetch. Combined as a single value
  // so the rendered form always holds the newest server truth.
  const [freshest, setFreshest] = useState<SiteSettings | null>(null);
  const current = freshest ?? data;

  if (error && !current) {
    return (
      <div className="space-y-5">
        <SectionHeading
          title="Site settings"
          description="Platform-wide configuration. These values are published by the public site."
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
          title="Site settings"
          description="Platform-wide configuration. These values are published by the public site."
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

  return (
    <SettingsForm
      key={current.updated_at}
      initial={current}
      onSaved={setFreshest}
    />
  );
}

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: SiteSettings;
  onSaved: (saved: SiteSettings) => void;
}) {
  const { showToast } = useApp();
  const [baseline, setBaseline] = useState<SiteSettings>(initial);
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFrom(initial));
  const [errors, setErrors] = useState<SettingsFieldErrors>({});
  const [saving, setSaving] = useState(false);

  const patch = useMemo(() => changedFields(draft, baseline), [draft, baseline]);
  const dirty = Object.keys(patch).length > 0;

  const update = (field: SettingsField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    // Clear this field's error as soon as it is edited, so a corrected field
    // stops shouting before the next save.
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const save = async () => {
    if (saving) return;

    const found = validateSettings(draft);
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
      const saved = await adminApi.updateSettings(patch);
      setBaseline(saved);
      setDraft(draftFrom(saved));
      onSaved(saved);
      showToast({
        variant: "success",
        title: "Settings saved",
        description: "The platform configuration was updated.",
      });
    } catch (err: unknown) {
      showToast({
        variant: "error",
        title: "Could not save settings",
        description: err instanceof ApiError ? err.message : "Could not reach the API.",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      {saving ? "Saving…" : "Save changes"}
    </Button>
  );

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Site settings"
        description="Platform-wide configuration. These values are published by the public site."
        action={saveButton}
      />

      <Panel title="Brand & contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="settings-site-name" label="Site name" error={errors.site_name}>
            <Input
              id="settings-site-name"
              value={draft.site_name}
              maxLength={120}
              error={Boolean(errors.site_name)}
              onChange={(event) => update("site_name", event.target.value)}
            />
          </Field>
          <Field id="settings-support-email" label="Support email" error={errors.support_email}>
            <Input
              id="settings-support-email"
              type="email"
              value={draft.support_email}
              error={Boolean(errors.support_email)}
              onChange={(event) => update("support_email", event.target.value)}
            />
          </Field>
          <Field id="settings-contact-phone" label="Contact phone" error={errors.contact_phone}>
            <Input
              id="settings-contact-phone"
              type="tel"
              value={draft.contact_phone}
              maxLength={30}
              error={Boolean(errors.contact_phone)}
              onChange={(event) => update("contact_phone", event.target.value)}
            />
          </Field>
          <Field
            id="settings-counselling-hours"
            label="Counselling hours"
            error={errors.counselling_hours}
          >
            <Input
              id="settings-counselling-hours"
              value={draft.counselling_hours}
              maxLength={120}
              error={Boolean(errors.counselling_hours)}
              onChange={(event) => update("counselling_hours", event.target.value)}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Preferences">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="settings-timezone" label="Default timezone" error={errors.default_timezone}>
            <Select
              id="settings-timezone"
              value={draft.default_timezone}
              error={Boolean(errors.default_timezone)}
              onChange={(event) => update("default_timezone", event.target.value)}
            >
              {SETTINGS_TIMEZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="settings-number-format"
            label="Number formatting"
            error={errors.number_formatting}
          >
            <Select
              id="settings-number-format"
              value={draft.number_formatting}
              error={Boolean(errors.number_formatting)}
              onChange={(event) => update("number_formatting", event.target.value)}
            >
              {SETTINGS_NUMBER_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <p className="text-xs text-slate-400">
        {dirty ? "Unsaved changes. " : ""}
        Last saved{" "}
        {new Date(baseline.updated_at).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </div>
  );
}

/** A labelled field with an inline, per-field error message. */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}