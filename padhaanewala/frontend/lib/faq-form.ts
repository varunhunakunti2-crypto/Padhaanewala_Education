import {
  optionalInt,
  optionalText,
  requiredInt,
  requiredText,
  type FormResult,
} from "@/lib/form-parts";
import { entityTypeLabel } from "@/lib/entity-options";

/**
 * The FAQ admin form.
 *
 * ## `entity_type` and `entity_id` cannot be changed after creation
 *
 * `FAQCreate` declares both. `FAQUpdate` does **not** — it has `question`,
 * `answer`, `display_order` and `is_active`, and nothing else. Pydantic ignores
 * unknown keys, so a form that sent the pair on edit would get a 200 back, show
 * "FAQ updated", and change nothing. That is a success signal with nothing behind
 * it: the same shape as BUG-01 and BUG-05, and the reason `lib/college-form.ts`
 * exists at all.
 *
 * So the builder genuinely returns a *different* field set per mode, and the
 * create dialog offers the picker while the edit dialog shows the attachment as
 * read-only text. An FAQ attached to the wrong college has to be deleted and
 * recreated — which is a real limitation of the API, not of this panel, and is
 * said so in the dialog rather than left for the admin to discover after saving.
 *
 * ## `is_active` is omitted for the usual reason
 *
 * `list_faqs` filters `where(FAQ.is_active)`, and so does `get_faq`. A toggle here
 * would remove the row from the table with no way back through the UI.
 *
 * `FAQUpdate.is_active` and `FAQCreate.is_active` do not line up either — the
 * create schema has no `is_active` at all, so the column defaults true — which is
 * the second half of the reason this form does not offer it in either direction.
 *
 * ## The attachment is a soft reference
 *
 * No foreign key, same as `media`: `create_faq` stores the pair unchecked. The
 * entity picker in `lib/entity-options.ts` is the safeguard, and it is the same
 * one the media panel uses, for the same reason.
 */
export interface FaqFormValues {
  question: string;
  answer: string;
  entity_type: string;
  entity_id: string;
  display_order: string;
}

export const EMPTY_FAQ_FORM: FaqFormValues = {
  question: "",
  answer: "",
  entity_type: "college",
  entity_id: "",
  display_order: "0",
};

/** `String(50)` on `FAQ.entity_type`. */
export const FAQ_ENTITY_TYPE_MAX = 50;

/** The subset of `FAQResponse` this form reads. */
export interface FaqDetail {
  id: number;
  question: string;
  answer: string | null;
  entity_type: string;
  entity_id: number;
  display_order: number;
}

export function faqFormFromDetail(detail: FaqDetail): FaqFormValues {
  return {
    question: detail.question,
    answer: detail.answer ?? "",
    // Carried through so the edit dialog can *display* the attachment. Not sent
    // back — see the note at the top of this file.
    entity_type: detail.entity_type,
    entity_id: String(detail.entity_id),
    display_order: String(detail.display_order),
  };
}

/** `GET/POST/PUT/DELETE /faqs/{faq_id}` takes a plain integer, not a ref. */
export function faqIdFor(row: { id: number }): string {
  return String(row.id);
}

export type FaqPayload = Record<string, unknown>;

export function buildFaqPayload(
  values: FaqFormValues,
  mode: "create" | "update",
): FormResult<FaqPayload> {
  // `FAQCreate.question` declares no bounds, so neither bound is invented here.
  // 255 is not enforced because the column is not: `question` is a plain
  // `Mapped[str]` with no `String(n)`.
  const question = requiredText(values.question, "The question");
  if (!question.ok) return question;

  const answer = optionalText(values.answer, "The answer");
  if (!answer.ok) return answer;

  const order = optionalInt(values.display_order, "The display order", { min: 0 });
  if (!order.ok) return order;

  if (mode === "update") {
    // Exactly `FAQUpdate`'s field set. Adding the entity pair here would produce
    // a silent no-op write.
    return {
      ok: true,
      value: {
        question: question.value,
        answer: answer.value,
        display_order: order.value ?? 0,
      },
    };
  }

  const entityType = requiredText(values.entity_type, "The entity type", {
    min: 1,
    max: FAQ_ENTITY_TYPE_MAX,
  });
  if (!entityType.ok) return entityType;

  // `min: 1` so a zero cannot be written into a column nothing will ever join on.
  const entityId = requiredInt(values.entity_id, `The ${entityTypeLabel(entityType.value).toLowerCase()} id`, {
    min: 1,
  });
  if (!entityId.ok) return entityId;

  return {
    ok: true,
    value: {
      question: question.value,
      answer: answer.value,
      entity_type: entityType.value,
      entity_id: entityId.value,
      display_order: order.value ?? 0,
    },
  };
}
