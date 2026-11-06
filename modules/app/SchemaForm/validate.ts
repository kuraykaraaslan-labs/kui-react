import type { FieldSchema } from './types';
import { resolveVariants, shouldShow } from './types';
import { zodFromSchema } from './zod-from-schema';
import { DEFAULT_SCHEMA_FORM_MESSAGES, type SchemaFormMessages } from './messages';

/**
 * Pure validation for a SchemaForm: the Zod issues from `zodFromSchema` plus the
 * `required` flag (which `zodFromSchema` deliberately leaves out because a stored
 * settings blob may be unconfigured). Hidden (`showIf` false) fields are skipped. A field typed by a sibling's value (`variants`) is
 * checked as its case for that value (`resolveVariants`): not at all while the sibling is empty or when the case takes no value.
 * Returns `{ [fieldKey]: message }`; empty means valid. `messages.required` words the required message.
 */
export function validateSchemaValues(
  schema: Record<string, FieldSchema>,
  values: Record<string, unknown>,
  messages: Pick<SchemaFormMessages, 'required'> = DEFAULT_SCHEMA_FORM_MESSAGES,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const drawn = resolveVariants(schema, values);
  const parsed = zodFromSchema(drawn).safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !errors[key]) errors[key] = issue.message;
    }
  }
  for (const [key, field] of Object.entries(drawn)) {
    if (!shouldShow(field, values)) { delete errors[key]; continue; }
    const v = values[key];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (field.required && empty) errors[key] = messages.required(field.label);
  }
  return errors;
}
