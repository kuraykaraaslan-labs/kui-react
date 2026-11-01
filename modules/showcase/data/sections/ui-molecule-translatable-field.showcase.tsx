'use client';
import { useState } from 'react';
import { TranslatableField, type TranslatableLanguage, type TranslatableSuggestion } from '@/modules/ui/TranslatableField';
import { Button } from '@/modules/ui/Button';
import type { ShowcaseComponent } from '../showcase.types';

const LANGUAGES: TranslatableLanguage[] = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'bg', name: 'Български' },
  { code: 'ar', name: 'العربية', rtl: true },
];

function TranslatableDemo(props: {
  initial: Record<string, string>;
  suggestions?: Record<string, TranslatableSuggestion>;
  notes?: Record<string, string>;
  withAdd?: boolean;
}) {
  const [value, setValue] = useState(props.initial);
  const [languages, setLanguages] = useState(LANGUAGES.slice(0, props.withAdd ? 2 : 4));
  const next = LANGUAGES.find((l) => !languages.includes(l));
  return (
    <div className="w-full max-w-xl">
      <TranslatableField
        id={props.withAdd ? 'label-add' : 'label-demo'}
        label="Menu label"
        languages={languages}
        value={value}
        onChange={setValue}
        required={['en']}
        suggestions={props.suggestions}
        notes={props.notes}
        maxLength={40}
        addLanguage={props.withAdd && next ? (
          <Button size="sm" variant="ghost" onClick={() => setLanguages((l) => [...l, next])}>+ Add language</Button>
        ) : undefined}
      />
    </div>
  );
}

export function buildTranslatableFieldData(): ShowcaseComponent[] {
  return [
    {
      id: 'translatable-field',
      title: 'TranslatableField',
      category: 'Molecule',
      abbr: 'TF',
      description: 'One text in several languages: a row per language with its flag, its own name, the input (right to left where the language is, lang set), a state mark in words (filled, missing, suggested) and a clear button. A required language left empty is an error; an empty language with a suggestion shows it in the field with an Accept action; a note can sit under a row; an "Add language" slot follows the rows. The value is a code → text record. React-only (next-boilerplate phase 54, D54-10).',
      filePath: 'modules/ui/TranslatableField/index.tsx',
      since: '2026-11',
      composes: ['button'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['group'],
        keyboardInteractions: [
          { keys: 'Tab', action: 'Move between the inputs, Accept and clear buttons' },
        ],
      },
      sourceCode: `'use client';
import { TranslatableField } from '@/modules/ui/TranslatableField';

const [label, setLabel] = useState({ en: 'Flows' });

<TranslatableField
  id="item-label"
  label="Label"
  languages={[
    { code: 'en', name: 'English', flag: <Flag code="gb" /> },
    { code: 'tr', name: 'Türkçe', flag: <Flag code="tr" /> },
    { code: 'ar', name: 'العربية', rtl: true },
  ]}
  value={label}
  onChange={setLabel}
  required={['en']}
  suggestions={{ tr: { text: 'Akışlar', source: 'automation.menu.flows' } }}
  notes={{ tr: 'Overridden in Translations' }}
/>`,
      variants: [
        {
          title: 'Filled, missing and suggested',
          layout: 'stack',
          preview: (
            <TranslatableDemo
              initial={{ en: 'Flows', ar: 'التدفقات' }}
              suggestions={{ tr: { text: 'Akışlar', source: 'automation.menu.flows' } }}
              notes={{ ar: 'Overridden in Translations' }}
            />
          ),
          code: `<TranslatableField id="item-label" label="Menu label" languages={languages}\n  value={{ en: 'Flows', ar: 'التدفقات' }} onChange={setLabel} required={['en']}\n  suggestions={{ tr: { text: 'Akışlar', source: 'automation.menu.flows' } }}\n  notes={{ ar: 'Overridden in Translations' }} />`,
        },
        {
          title: 'Required English empty, with "Add language"',
          layout: 'stack',
          preview: <TranslatableDemo initial={{}} withAdd />,
          code: `<TranslatableField id="ws-label" label="Menu label" languages={languages}\n  value={label} onChange={setLabel} required={['en']}\n  addLanguage={<Button size="sm" variant="ghost" onClick={addLanguage}>+ Add language</Button>} />`,
        },
      ],
    },
  ];
}
