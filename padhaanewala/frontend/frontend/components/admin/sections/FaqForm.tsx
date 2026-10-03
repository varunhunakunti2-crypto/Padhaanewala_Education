"use client";

import { useEffect, useMemo, useState } from "react";
import { Input, Select } from "@/components/ui/FormField";
import { Field, FieldSet, NoneOption, Textarea } from "@/components/admin/fields";
import { ENTITY_LOADERS, MEDIA_ENTITY_TYPES, entityTypeLabel } from "@/lib/entity-options";
import type { FaqFormValues } from "@/lib/faq-form";
import type { MediaEntityOption } from "@/lib/media-form";

/** The three states the entity list can be in. See the derivation note below. */
type LoadState =
  | { status: "loading" }
  | { status: "ready"; rows: MediaEntityOption[] }
  | { status: "error"; rows: MediaEntityOption[] };

/**
 * The field set for creating and editing an FAQ.
 *
 * ## The attachment picker is create-only, and the reason is the API
 *
 * `FAQCreate` declares `entity_type` and `entity_id`. `FAQUpdate` does **not** —
 * it has `question`, `answer`, `display_order` and `is_active`, and nothing else.
 * Pydantic ignores unknown keys, so a form that sent the pair on edit would get a
 * 200, show "FAQ updated", and change nothing at all: a success signal with
 * nothing behind it.
 *
 * So on edit the attachment is displayed as read-only text and the controls are
 * not rendered. An FAQ attached to the wrong college has to be deleted and
 * recreated, which is a genuine limitation of the endpoint rather than of this
 * panel — and it is said here, in the form, rather than left for an admin to
 * discover after a save that appeared to work.
 *
 * ## The picker is the safeguard, because there is no foreign key
 *
 * `create_faq` stores the pair unchecked: no FK, no existence test, and the
 * router's own docstring says validating it would need a registry of entity types
 * the schema does not have. Choosing from a real list is therefore the *only*
 * thing standing between an admin and an id that points at nothing. That is why
 * this component uses `ENTITY_LOADERS` — the same module the media panel uses —
 * rather than a free-text box.
 */
export function FaqFormFields({
  values,
  onChange,
  mode,
  disabled,
}: {
  values: FaqFormValues;
  onChange: (next: FaqFormValues) => void;
  mode: "create" | "update";
  disabled?: boolean;
}) {
  const [loaded, setLoaded] = useState<Record<string, LoadState>>({});
  const key = values.entity_type;
  const loader = ENTITY_LOADERS[key];

  /**
   * Derived during render, not set in the effect.
   *
   * "Loading", "nothing to attach to" and "this type has no list" are three
   * different states, and writing them as `setOptions` calls inside the effect
   * body would be a cascading render on every open. Only the *fetch* needs an
   * effect; everything else follows from whether a loader exists and whether a
   * result has arrived.
   */
  const current: LoadState = loaded[key] ?? (loader ? { status: "loading" } : { status: "ready", rows: [] });

  // Only on create: the four loaders are paged walks, and nothing on an edit
  // needs them because the attachment cannot be changed there.
  useEffect(() => {
    if (!loader || loaded[key]) return;
    let ignore = false;
    loader()
      .then((rows) => {
        if (ignore) return;
        setLoaded((s) => ({ ...s, [key]: { status: "ready", rows } }));
      })
      .catch(() => {
        if (ignore) return;
        // Deliberately does *not* fall back to a free-text box. A typed id that
        // resolves to nothing produces a write that succeeds and a row that is
        // then invisible everywhere — a silent failure, which is the exact thing
        // this picker exists to prevent. So the field is disabled and the reason
        // is shown.
        setLoaded((s) => ({ ...s, [key]: { status: "error", rows: [] } }));
      });
    return () => {
      ignore = true;
    };
  }, [loader, key, loaded]);

  // Switching type invalidates the chosen id, and the two are only ever meaningful
  // together — an id from one list is meaningless in another.
  const setEntityType = (next: string) =>
    onChange({ ...values, entity_type: next, entity_id: "" });

  const optionsError =
    current.status === "error"
      ? "This list could not be loaded, so the attachment cannot be set safely."
      : null;
  const options = current.status === "ready" ? current.rows : null;

  const selected = useMemo(
    () => options?.find((o) => String(o.id) === values.entity_id) ?? null,
    [options, values.entity_id],
  );

  return (
    <div className="space-y-6">
      <FieldSet legend="Question" disabled={disabled}>
        <Field id="faq-question" label="Question">
          <Input
            id="faq-question"
            value={values.question}
            onChange={(e) => onChange({ ...values, question: e.target.value })}
            placeholder="What is the application deadline?"
            required
            aria-required="true"
          />
        </Field>
        <div>
          <label htmlFor="faq-answer" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
            Answer
          </label>
          <Textarea
            id="faq-answer"
            rows={5}
            value={values.answer}
            onChange={(v) => onChange({ ...values, answer: v })}
            placeholder="Applications close on 30 April."
          />
        </div>
        <Field
          id="faq-order"
          label="Display order"
          hint="Lower numbers appear first."
        >
          <Input
            id="faq-order"
            value={values.display_order}
            onChange={(e) => onChange({ ...values, display_order: e.target.value })}
            inputMode="numeric"
          />
        </Field>
      </FieldSet>

      <FieldSet
        legend="Attachment"
        disabled={disabled}
        note={
          mode === "update"
            ? "The attachment cannot be changed after an FAQ is created — the update endpoint does not accept it. To move this FAQ to a different record, delete it and create it again."
            : undefined
        }
      >
        {mode === "update" ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Attached to <span className="font-semibold">{entityTypeLabel(values.entity_type)}</span>{" "}
            #{values.entity_id}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="faq-entity-type" label="Applies to">
                <Select
                  id="faq-entity-type"
                  value={values.entity_type}
                  onChange={(e) => setEntityType(e.target.value)}
                >
                  {MEDIA_ENTITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                id="faq-entity-id"
                label={entityTypeLabel(values.entity_type)}
                hint={
                  optionsError ??
                  (options === null
                    ? "Loading…"
                    : options.length === 0
                      ? "Nothing to attach to yet."
                      : `${options.length.toLocaleString("en-IN")} available.`)
                }
              >
                <Select
                  id="faq-entity-id"
                  value={values.entity_id}
                  disabled={optionsError !== null || options === null || options.length === 0}
                  onChange={(e) => onChange({ ...values, entity_id: e.target.value })}
                >
                  <NoneOption
                    label={optionsError ? "Unavailable" : options === null ? "Loading…" : "Choose one"}
                  />
                  {options?.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {optionsError && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {optionsError} The API does not check this reference, so a value typed by
                hand would be stored and then appear nowhere.
              </p>
            )}
            {selected && (
              <p className="text-xs text-slate-500">Selected: {selected.label}</p>
            )}
          </>
        )}
      </FieldSet>
    </div>
  );
}
