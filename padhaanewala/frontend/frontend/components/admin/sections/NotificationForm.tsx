"use client";

import { Input, Select } from "@/components/ui/FormField";
import { Field, FieldSet, Textarea } from "@/components/admin/fields";
import type { CrudMode } from "@/components/admin/useCatalogCrud";
import {
  NOTIFICATION_TYPES,
  type NotificationFormValues,
} from "@/lib/notification-form";

/**
 * The field set for creating and editing a notification.
 *
 * ## One form, two audiences
 *
 * Creating sends to every active student; editing changes a message that is
 * already in their inboxes. The fields are identical, but the consequence is
 * not, so the `note` above them says which one this dialog is doing. The section
 * passes the recipient count of the send being edited so "Applies to 14
 * students" is a fact from the server rather than an implication.
 *
 * ## No recipient picker
 *
 * This panel is the broadcast console. Sending to one account is supported by
 * the API (`user_id`) and used by server-side flows, but a free-text user id box
 * would be a way to type a number that belongs to nobody and get a 404, or worse
 * to the wrong student. If a single-recipient compose is ever needed it should
 * be a searchable picker over real accounts, not an id field.
 */
export function NotificationFormFields({
  values,
  onChange,
  mode,
  audience,
  disabled,
}: {
  values: NotificationFormValues;
  onChange: (values: NotificationFormValues) => void;
  mode: CrudMode;
  /** Who will receive it, e.g. "every active student" or "14 students". */
  audience: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      <FieldSet
        legend="Message"
        disabled={disabled}
        note={
          mode === "create"
            ? `Sends to ${audience}. This cannot be unsent from an inbox that has already opened it — but it can be retracted from the log afterwards.`
            : `Changes the wording for ${audience}. The recipients stay the same — an edit is not a re-send.`
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="notification-type" label="Type">
            <Select
              id="notification-type"
              value={values.type}
              onChange={(e) => onChange({ ...values, type: e.target.value })}
            >
              {NOTIFICATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field id="notification-title" label="Title">
              <Input
                id="notification-title"
                value={values.title}
                onChange={(e) => onChange({ ...values, title: e.target.value })}
                placeholder="JEE Main registration opens"
                required
                aria-required="true"
                maxLength={255}
              />
            </Field>
          </div>
        </div>

        <div>
          <label
            htmlFor="notification-message"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            Message
          </label>
          <Textarea
            id="notification-message"
            rows={4}
            value={values.message}
            onChange={(message) => onChange({ ...values, message })}
            placeholder="Registration for JEE Main 2027 opens on 1 March."
          />
        </div>
      </FieldSet>
    </div>
  );
}
