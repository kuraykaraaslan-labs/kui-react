'use client';
import { useState } from 'react';
import {
  SchemaForm,
  fromFormBuilder,
  fromJsonSchema,
  validateSchemaValues,
  type FieldSchema,
  type SchemaFieldOverrideProps,
} from '@/modules/app/SchemaForm';
import type { ShowcaseComponent } from '../showcase.types';

const WIDGET_SCHEMA: Record<string, FieldSchema> = {
  title: { label: 'Title', type: 'text', required: true, placeholder: 'Widget title' },
  link: { label: 'Docs URL', type: 'url', placeholder: 'https://' },
  note: { label: 'Note', type: 'textarea', description: 'Shown under the title.' },
  refresh: { label: 'Refresh (s)', type: 'number', min: 1, max: 3600, step: 1, value: 30 },
  live: { label: 'Live updates', type: 'boolean', placeholder: 'Stream values' },
  mode: { label: 'Mode', type: 'select', options: ['compact', 'full'], value: 'compact' },
  tags: { label: 'Tags', type: 'multi-select', options: ['cpu', 'memory', 'disk'] },
  accent: { label: 'Accent', type: 'color', value: '#2563eb', group: 'Appearance' },
  since: { label: 'Since', type: 'date', group: 'Appearance' },
  at: { label: 'At', type: 'datetime', group: 'Appearance', showIf: { live: false } },
  thresholds: {
    label: 'Thresholds', type: 'repeater', group: 'Advanced',
    fields: {
      name: { label: 'Name', type: 'text' },
      limit: { label: 'Limit', type: 'number' },
      critical: { label: 'Critical', type: 'boolean' },
    },
  },
  raw: { label: 'Raw options', type: 'json', group: 'Advanced' },
};

function Output({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 text-xs p-3 rounded-md border border-border bg-surface-raised text-text-primary overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function FullDemo() {
  const [values, setValues] = useState<Record<string, unknown>>({ title: 'CPU load', live: true });
  return (
    <div className="w-full max-w-xl">
      <SchemaForm schema={WIDGET_SCHEMA} values={values} onChange={setValues} defaults={{ refresh: 30, mode: 'compact' }} />
      <Output value={values} />
    </div>
  );
}

function ValidationDemo() {
  const [values, setValues] = useState<Record<string, unknown>>({ refresh: 99999 });
  const errors = validateSchemaValues(WIDGET_SCHEMA, values);
  return (
    <div className="w-full max-w-xl">
      <SchemaForm schema={WIDGET_SCHEMA} values={values} onChange={setValues} errors={errors} debounceMs={0} />
    </div>
  );
}

function MediaOverride({ value, onChange, id }: SchemaFieldOverrideProps) {
  const options = ['logo.png', 'hero.jpg'];
  return (
    <select id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-md text-sm bg-surface-raised text-text-primary border border-border">
      <option value="">Pick from media library...</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function OverrideDemo() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const schema: Record<string, FieldSchema> = {
    title: { label: 'Title', type: 'text' },
    cover: { label: 'Cover (app-bound media field)', type: 'media' },
    sym: { label: 'Symbol (no override: degrades to text)', type: 'symbol' },
  };
  return (
    <div className="w-full max-w-xl">
      <SchemaForm schema={schema} values={values} onChange={setValues} fieldOverrides={{ media: MediaOverride }} />
      <Output value={values} />
    </div>
  );
}

const JSON_SCHEMA = {
  type: 'object',
  required: ['host'],
  properties: {
    host: { type: 'string', description: 'Broker host name' },
    port: { type: 'integer', minimum: 1, maximum: 65535, default: 1883 },
    protocol: { type: 'string', enum: ['mqtt', 'mqtts'], default: 'mqtt' },
    retain: { type: 'boolean' },
    channels: { type: 'array', items: { type: 'string', enum: ['a', 'b', 'c'] } },
  },
};

function AdaptersDemo() {
  const [a, setA] = useState<Record<string, unknown>>({});
  const [b, setB] = useState<Record<string, unknown>>({});
  const fromBuilder = fromFormBuilder({
    id: 'contact',
    fields: [
      { id: '1', type: 'text', name: 'name', label: 'Your name', required: true },
      { id: '2', type: 'select', name: 'topic', label: 'Topic', options: [{ label: 'Sales', value: 'sales' }, { label: 'Support', value: 'support' }] },
      { id: '3', type: 'checkbox', name: 'consent', label: 'Consent', helperText: 'Privacy policy' },
    ],
  });
  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <div><p className="mb-2 text-xs text-text-secondary">fromJsonSchema(...)</p><SchemaForm schema={fromJsonSchema(JSON_SCHEMA)} values={a} onChange={setA} /></div>
      <div><p className="mb-2 text-xs text-text-secondary">fromFormBuilder(...)</p><SchemaForm schema={fromBuilder} values={b} onChange={setB} /></div>
    </div>
  );
}

export function buildAppSchemaFormData(): ShowcaseComponent[] {
  return [
    {
      id: 'schema-form',
      title: 'SchemaForm',
      category: 'App',
      abbr: 'ScF',
      description:
        'Schema-driven form on the FieldSchema vocabulary (moved from next-boilerplate, OD-16). Field types: text, url, textarea, number, boolean, select, multi-select, json, color, date, datetime and repeater; showIf hides a field until another value matches, group folds fields into sections, defaults seed values and power the reset button, writes are debounced. App-bound types (media, remote-select, symbol, color-token, icon, background) are plugged in through the fieldOverrides registry and degrade to a plain input when none is given. A remote-select with searchKey (and lookupKey to resolve the label of a stored value) describes a searchable picker for the host override. zodFromSchema / validateSchemaValues validate the result; fromJsonSchema (subset) and fromFormBuilder convert other schemas. React only.',
      filePath: 'modules/app/SchemaForm/SchemaForm.tsx',
      sourceCode: `import { SchemaForm, type FieldSchema } from '@/modules/app/SchemaForm';

const schema: Record<string, FieldSchema> = {
  title: { label: 'Title', type: 'text', required: true },
  live:  { label: 'Live updates', type: 'boolean' },
  at:    { label: 'At', type: 'datetime', showIf: { live: false } },
};

<SchemaForm schema={schema} values={values} onChange={setValues} />`,
      since: '2026-10',
      status: 'beta',
      composes: [],
      designTokens: ['--surface-raised', '--surface-overlay', '--text-primary', '--text-secondary', '--text-disabled', '--border', '--border-strong', '--border-focus', '--primary', '--error'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['group', 'alert'],
        keyboardInteractions: [
          { keys: 'Tab', action: 'Move between fields; every control has a visible focus ring' },
          { keys: 'Enter / Space', action: 'Toggle group sections, repeater item panels and checkboxes' },
        ],
        notes: 'Each control is bound to its label with htmlFor/id. Validation messages use role="alert" and aria-describedby; invalid controls set aria-invalid.',
      },
      variants: [
        { title: 'Widget settings (all field types, groups, showIf)', layout: 'stack' as const, preview: <FullDemo />,
          code: `<SchemaForm schema={schema} values={values} defaults={{ refresh: 30 }} onChange={setValues} />` },
        { title: 'Validation (zod + required)', layout: 'stack' as const, preview: <ValidationDemo />,
          code: `const errors = validateSchemaValues(schema, values);
<SchemaForm schema={schema} values={values} onChange={setValues} errors={errors} />` },
        { title: 'fieldOverrides (app-bound fields)', layout: 'stack' as const, preview: <OverrideDemo />,
          code: `<SchemaForm schema={schema} values={values} onChange={setValues}
  fieldOverrides={{ media: MediaLibraryField }} />` },
        { title: 'Adapters (JSON Schema, FormBuilder)', layout: 'stack' as const, preview: <AdaptersDemo />,
          code: `<SchemaForm schema={fromJsonSchema(jsonSchema)} values={a} onChange={setA} />
<SchemaForm schema={fromFormBuilder(formSchema)} values={b} onChange={setB} />` },
      ],
    },
  ];
}
