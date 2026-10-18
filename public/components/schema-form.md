# SchemaForm

- **id:** `schema-form`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/SchemaForm/SchemaForm.tsx`
- **status:** beta
- **since:** 2026-10

Schema-driven form on the FieldSchema vocabulary (moved from next-boilerplate, OD-16). Field types: text, url, textarea, number, boolean, select, multi-select, json, color, date, datetime and repeater; showIf hides a field until another value matches, group folds fields into sections, defaults seed values and power the reset button, writes are debounced. App-bound types (media, remote-select, symbol, color-token, icon, background) are plugged in through the fieldOverrides registry and degrade to a plain input when none is given. A remote-select with searchKey (and lookupKey to resolve the label of a stored value) describes a searchable picker for the host override. zodFromSchema / validateSchemaValues validate the result; fromJsonSchema (subset) and fromFormBuilder convert other schemas. React only.

## Used by

- `widget-kit`

## Accessibility

- WCAG: AA
- ARIA patterns: group, alert
- Keyboard:
  - `Tab` — Move between fields; every control has a visible focus ring
  - `Enter / Space` — Toggle group sections, repeater item panels and checkboxes

Each control is bound to its label with htmlFor/id. Validation messages use role="alert" and aria-describedby; invalid controls set aria-invalid.

## Design tokens consumed

- `--surface-raised`
- `--surface-overlay`
- `--text-primary`
- `--text-secondary`
- `--text-disabled`
- `--border`
- `--border-strong`
- `--border-focus`
- `--primary`
- `--error`

## Variants

### Widget settings (all field types, groups, showIf)

```tsx
<SchemaForm schema={schema} values={values} defaults={{ refresh: 30 }} onChange={setValues} />
```

### Validation (zod + required)

```tsx
const errors = validateSchemaValues(schema, values);
<SchemaForm schema={schema} values={values} onChange={setValues} errors={errors} />
```

### fieldOverrides (app-bound fields)

```tsx
<SchemaForm schema={schema} values={values} onChange={setValues}
  fieldOverrides={{ media: MediaLibraryField }} />
```

### Adapters (JSON Schema, FormBuilder)

```tsx
<SchemaForm schema={fromJsonSchema(jsonSchema)} values={a} onChange={setA} />
<SchemaForm schema={fromFormBuilder(formSchema)} values={b} onChange={setB} />
```

## Full source

```tsx
import { SchemaForm, type FieldSchema } from '@/modules/app/SchemaForm';

const schema: Record<string, FieldSchema> = {
  title: { label: 'Title', type: 'text', required: true },
  live:  { label: 'Live updates', type: 'boolean' },
  at:    { label: 'At', type: 'datetime', showIf: { live: false } },
};

<SchemaForm schema={schema} values={values} onChange={setValues} />
```
