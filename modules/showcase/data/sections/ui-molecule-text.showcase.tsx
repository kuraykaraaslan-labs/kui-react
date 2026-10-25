'use client';
import React from 'react';
import { Input } from '@/modules/ui/Input';
import { Textarea } from '@/modules/ui/Textarea';
import { SearchBar } from '@/modules/ui/SearchBar';
import { Spinner } from '@/modules/ui/Spinner';
import { useId, useState } from 'react';
import type { ShowcaseComponent } from '../showcase.types';

function InputDemoControlled({ prefixIcon, suffixIcon, clearable, success, readOnly, showCount }: {
  prefixIcon?: React.ReactNode; suffixIcon?: React.ReactNode;
  clearable?: boolean; success?: string; readOnly?: boolean; showCount?: boolean;
}) {
  const [v, setV] = useState('');
  const id = useId();
  return (
    <Input id={`input-demo-${id}`} label="Label"
      value={v} onChange={(e) => setV(e.target.value)}
      prefixIcon={prefixIcon} suffixIcon={suffixIcon}
      clearable={clearable} onClear={() => setV('')}
      success={success} readOnly={readOnly}
      showCount={showCount} maxLength={showCount ? 50 : undefined}
    />
  );
}

export function buildMoleculeTextData(): ShowcaseComponent[] {
  return [
    {
      id: 'input',
      title: 'Input',
      category: 'Molecule',
      abbr: 'In',
      description: 'Text input field with label, hint, error, prefix icon, password toggle, and 3 size variants.',
      filePath: 'modules/ui/Input.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';

export function Input({ id, label, hint, error, required, className, ...props }) {
  const describedBy = [hint && !error ? \`\${id}-hint\` : null, error ? \`\${id}-error\` : null].filter(Boolean).join(' ');
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-error ml-1" aria-hidden="true">*</span>}
      </label>
      <input id={id} required={required} aria-invalid={!!error} aria-describedby={describedBy || undefined}
        className={cn('block w-full rounded-md border px-3 py-2 text-sm transition-colors text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-sunken', error ? 'border-error ring-1 ring-error bg-error-subtle' : 'border-border bg-surface-base', className)}
        {...props} />
      {hint && !error && <p id={\`\${id}-hint\`} className="text-xs text-text-secondary">{hint}</p>}
      {error && <p id={\`\${id}-error\`} className="text-xs text-error" role="alert">{error}</p>}
    </div>
  );
}`,
      playground: {
        controls: [
          { key: 'label',       label: 'Label',       type: 'text',   default: 'Email' },
          { key: 'type',        label: 'Type',        type: 'select', options: ['text', 'email', 'password', 'number', 'search'] as const, default: 'email' },
          { key: 'placeholder', label: 'Placeholder', type: 'text',   default: 'you@example.com' },
          { key: 'hint',        label: 'Hint',        type: 'text',   default: '' },
          { key: 'error',       label: 'Error',       type: 'text',   default: '' },
          { key: 'required',    label: 'Required',    type: 'boolean', default: false },
          { key: 'disabled',    label: 'Disabled',    type: 'boolean', default: false },
        ],
        render: (p) => (
          <div className="w-full max-w-xs">
            <Input
              id="pg-input"
              label={p.label as string}
              type={p.type as string}
              placeholder={p.placeholder as string}
              hint={p.hint as string || undefined}
              error={p.error as string || undefined}
              required={p.required as boolean}
              disabled={p.disabled as boolean}
            />
          </div>
        ),
        generateCode: (p) => {
          const attrs: string[] = [`label="${p.label}"`, `type="${p.type}"`];
          if (p.placeholder) attrs.push(`placeholder="${p.placeholder}"`);
          if (p.hint)        attrs.push(`hint="${p.hint}"`);
          if (p.error)       attrs.push(`error="${p.error}"`);
          if (p.required)    attrs.push('required');
          if (p.disabled)    attrs.push('disabled');
          return `<Input id="field" ${attrs.join(' ')} />`;
        },
      },
      variants: [
        {
          title: 'Default',
          preview: <div className="w-full max-w-xs"><Input id="sc-in-default" label="Email" type="email" placeholder="you@example.com" hint="We'll never share your email." /></div>,
          code: `<Input id="email" label="Email" type="email" placeholder="you@example.com" hint="We'll never share your email." />`,
        },
        {
          title: 'Hidden label (hideLabel)',
          preview: <div className="w-full max-w-xs"><Input id="sc-in-hidden" label="Quantity of Widget A" hideLabel type="number" placeholder="Qty" /></div>,
          code: `// An editable table cell: the column heading shows what it is; the label stays the accessible name.\n<Input id="qty-a" label="Quantity of Widget A" hideLabel type="number" />`,
        },
        {
          title: 'Error',
          preview: <div className="w-full max-w-xs"><Input id="sc-in-error" label="Email" type="email" error="A valid email address is required." required /></div>,
          code: `<Input id="email" label="Email" type="email" error="A valid email address is required." required />`,
        },
        {
          title: 'Disabled',
          preview: <div className="w-full max-w-xs"><Input id="sc-in-disabled" label="Email" type="email" placeholder="you@example.com" disabled /></div>,
          code: `<Input id="email" label="Email" type="email" placeholder="you@example.com" disabled />`,
        },
        {
          title: 'Prefix / suffix icon',
          preview: (
            <div className="w-full max-w-xs space-y-3">
              <Input id="sc-in-prefix" label="Search" prefixIcon={<span>🔍</span>} placeholder="Search…" />
              <Input id="sc-in-suffix" label="Amount" suffixIcon={<span>$</span>} placeholder="0.00" type="number" />
            </div>
          ),
          code: `<Input id="search" label="Search" prefixIcon={<SearchIcon />} placeholder="Search…" />\n<Input id="amount" label="Amount" suffixIcon={<span>$</span>} type="number" />`,
          layout: 'stack' as const,
        },
        {
          title: 'Clearable',
          preview: (
            <div className="w-full max-w-xs">
              <InputDemoControlled clearable />
            </div>
          ),
          code: `function Demo() {\n  const [v, setV] = useState('');\n  return <Input id="clr" label="Label" value={v} onChange={(e) => setV(e.target.value)}\n    clearable onClear={() => setV('')} />;\n}`,
          layout: 'stack' as const,
        },
        {
          title: 'Success state',
          preview: (
            <div className="w-full max-w-xs">
              <Input id="sc-in-success" label="Username" value="johndoe" onChange={() => {}} success="Username is available!" />
            </div>
          ),
          code: `<Input id="username" label="Username" value="johndoe" success="Username is available!" />`,
          layout: 'stack' as const,
        },
        {
          title: 'Read only',
          preview: (
            <div className="w-full max-w-xs">
              <Input id="sc-in-readonly" label="API Key" value="sk-abc123xyz" onChange={() => {}} readOnly />
            </div>
          ),
          code: `<Input id="api-key" label="API Key" value="sk-abc123xyz" readOnly />`,
          layout: 'stack' as const,
        },
        {
          title: 'Character counter',
          preview: (
            <div className="w-full max-w-xs">
              <InputDemoControlled showCount />
            </div>
          ),
          code: `<Input id="bio" label="Bio" value={v} onChange={(e) => setV(e.target.value)} maxLength={50} showCount />`,
          layout: 'stack' as const,
        },
        {
          title: 'Password with eye toggle',
          preview: (() => {
            function PwDemo() {
              const [v, setV] = useState('');
              return (
                <div className="w-full max-w-xs">
                  <Input id="pw-demo" label="Password" type="password"
                    value={v} onChange={(e) => setV(e.target.value)}
                    placeholder="Enter your password" hint="Min. 8 characters" />
                </div>
              );
            }
            return <PwDemo />;
          })(),
          code: `<Input id="password" label="Password" type="password" value={v} onChange={setV} />`,
          layout: 'stack' as const,
        },
        {
          title: 'Number stepper',
          preview: (() => {
            function NumDemo() {
              const [v, setV] = useState('5');
              return (
                <div className="w-full max-w-xs">
                  <Input id="num-demo" label="Quantity" type="number"
                    value={v} onChange={(e) => setV(e.target.value)}
                    min={0} max={99} step={1} />
                </div>
              );
            }
            return <NumDemo />;
          })(),
          code: `<Input id="qty" label="Quantity" type="number" value={v} onChange={setV} min={0} max={99} />`,
          layout: 'stack' as const,
        },
        {
          title: 'Prefix / suffix text',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-xs space-y-3">
              <Input id="sc-in-url" label="Website" prefixIcon={<span className="text-text-secondary text-xs font-mono select-none">https://</span>} placeholder="yoursite.com" />
              <Input id="sc-in-handle" label="Twitter handle" prefixIcon={<span className="text-text-secondary text-sm select-none">@</span>} placeholder="username" />
              <Input id="sc-in-usd" label="Price" suffixIcon={<span className="text-text-secondary text-sm select-none">USD</span>} type="number" placeholder="0.00" />
            </div>
          ),
          code: `<Input id="website" label="Website"\n  prefixIcon={<span className="text-text-secondary text-xs font-mono">https://</span>}\n  placeholder="yoursite.com" />\n\n<Input id="handle" label="Twitter handle"\n  prefixIcon={<span className="text-text-secondary">@</span>}\n  placeholder="username" />\n\n<Input id="price" label="Price"\n  suffixIcon={<span className="text-text-secondary">USD</span>}\n  type="number" />`,
        },
        {
          title: 'Loading state',
          layout: 'stack' as const,
          preview: (() => {
            function LoadingInputDemo() {
              const [v, setV] = useState('johndoe');
              return (
                <div className="w-full max-w-xs">
                  <Input id="sc-in-loading" label="Username" value={v}
                    onChange={(e) => setV(e.target.value)}
                    suffixIcon={<Spinner size="xs" />}
                    hint="Checking availability…" />
                </div>
              );
            }
            return <LoadingInputDemo />;
          })(),
          code: `<Input id="username" label="Username" value={v} onChange={setV}\n  suffixIcon={<Spinner size="xs" />}\n  hint="Checking availability…" />`,
        },
      ],
    },
    {
      id: 'textarea',
      title: 'Textarea',
      category: 'Molecule',
      abbr: 'Ta',
      description: 'Label + textarea + hint + error anatomy. Vertical resizing is enabled via resize-y and the parts are linked through aria-describedby.',
      filePath: 'modules/ui/Textarea.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';

export function Textarea({ id, label, hint, error, disabled, required, rows = 4, className, ...props }) {
  const hintId = hint ? \`\${id}-hint\` : undefined;
  const errorId = error ? \`\${id}-error\` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}{required && <span className="text-error ml-1" aria-hidden="true">*</span>}
      </label>
      <textarea id={id} rows={rows} disabled={disabled} required={required} aria-describedby={describedBy} aria-invalid={!!error}
        className={cn('block w-full rounded-md border px-3 py-2 text-sm transition-colors resize-y text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-sunken', error ? 'border-error ring-1 ring-error bg-error-subtle' : 'border-border bg-surface-base', className)} {...props} />
      {hint && !error && <p id={hintId} className="text-xs text-text-secondary">{hint}</p>}
      {error && <p id={errorId} className="text-xs text-error" role="alert">{error}</p>}
    </div>
  );
}`,
      playground: {
        controls: [
          { key: 'label',       label: 'Label',       type: 'text',   default: 'Message' },
          { key: 'placeholder', label: 'Placeholder', type: 'text',   default: 'Write your message…' },
          { key: 'rows',        label: 'Rows',        type: 'number', min: 2, max: 10, step: 1, default: 3 },
          { key: 'hint',        label: 'Hint',        type: 'text',   default: '' },
          { key: 'error',       label: 'Error',       type: 'text',   default: '' },
          { key: 'disabled',    label: 'Disabled',    type: 'boolean', default: false },
        ],
        render: (p) => (
          <div className="w-full max-w-xs">
            <Textarea
              id="pg-textarea"
              label={p.label as string}
              placeholder={p.placeholder as string}
              rows={p.rows as number}
              hint={p.hint as string || undefined}
              error={p.error as string || undefined}
              disabled={p.disabled as boolean}
            />
          </div>
        ),
        generateCode: (p) => {
          const attrs: string[] = [`label="${p.label}"`];
          if (p.placeholder)  attrs.push(`placeholder="${p.placeholder}"`);
          if (p.rows !== 3)   attrs.push(`rows={${p.rows}}`);
          if (p.hint)         attrs.push(`hint="${p.hint}"`);
          if (p.error)        attrs.push(`error="${p.error}"`);
          if (p.disabled)     attrs.push('disabled');
          return `<Textarea id="message" ${attrs.join(' ')} />`;
        },
      },
      variants: [
        {
          title: 'Default',
          preview: <div className="w-full max-w-xs"><Textarea id="sc-ta-default" label="Message" placeholder="Write your message…" hint="Max 500 characters." rows={3} /></div>,
          code: `<Textarea id="message" label="Message" placeholder="Write your message…" hint="Max 500 characters." />`,
        },
        {
          title: 'Error',
          preview: <div className="w-full max-w-xs"><Textarea id="sc-ta-error" label="Message" error="Message is required." required rows={3} /></div>,
          code: `<Textarea id="message" label="Message" error="Message is required." required />`,
        },
        {
          title: 'Disabled',
          preview: <div className="w-full max-w-xs"><Textarea id="sc-ta-disabled" label="Message" placeholder="Not editable" disabled rows={3} /></div>,
          code: `<Textarea id="message" label="Message" placeholder="Not editable" disabled />`,
        },
        {
          title: 'Character counter',
          layout: 'stack' as const,
          preview: (() => {
            function TextareaCounterDemo() {
              const MAX = 200;
              const [v, setV] = useState('');
              const remaining = MAX - v.length;
              return (
                <div className="w-full max-w-xs space-y-1">
                  <Textarea id="sc-ta-counter" label="Bio" rows={3}
                    value={v} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setV(e.target.value)}
                    maxLength={MAX} placeholder="Tell us about yourself…" />
                  <p className={`text-xs text-right ${remaining < 20 ? 'text-error' : 'text-text-secondary'}`}>
                    {remaining} characters remaining
                  </p>
                </div>
              );
            }
            return <TextareaCounterDemo />;
          })(),
          code: `function Demo() {\n  const MAX = 200;\n  const [v, setV] = useState('');\n  return (\n    <div className="space-y-1">\n      <Textarea id="bio" label="Bio" value={v} maxLength={MAX} rows={3}\n        onChange={(e) => setV(e.target.value)} />\n      <p className={\`text-xs text-right \${MAX - v.length < 20 ? 'text-error' : 'text-text-secondary'}\`}>\n        {MAX - v.length} characters remaining\n      </p>\n    </div>\n  );\n}`,
        },
      ],
    },
    {
      id: 'search-bar',
      title: 'SearchBar',
      category: 'Molecule',
      abbr: 'Sb',
      description: 'role="searchbox" with search icon and clear button. Works in controlled and uncontrolled modes.',
      filePath: 'modules/ui/SearchBar.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { useState } from 'react';

export function SearchBar({ id = 'search', placeholder = 'Search…', value, onChange, onClear, className }) {
  const [internal, setInternal] = useState('');
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internal;
  function handleChange(e) { if (!controlled) setInternal(e.target.value); onChange?.(e.target.value); }
  function handleClear() { if (!controlled) setInternal(''); onChange?.(''); onClear?.(); }
  return (
    <div className={cn('relative flex items-center', className)}>
      <span aria-hidden="true" className="absolute left-3 text-text-disabled pointer-events-none select-none">⌕</span>
      <input id={id} type="search" role="searchbox" value={currentValue} onChange={handleChange} placeholder={placeholder} autoComplete="off"
        className={cn('block w-full rounded-md border border-border bg-surface-base px-3 py-2 pl-8 text-sm text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus transition-colors', currentValue && 'pr-8')} />
      {currentValue && (
        <button type="button" onClick={handleClear} aria-label="Clear search" className="absolute right-2 text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none rounded">✕</button>
      )}
    </div>
  );
}`,
      playground: {
        controls: [
          { key: 'placeholder', label: 'Placeholder', type: 'text', default: 'Search components…' },
          { key: 'value',       label: 'Value',       type: 'text', default: '' },
        ],
        render: (p) => (
          <div className="w-full max-w-xs">
            <SearchBar
              placeholder={p.placeholder as string}
              value={p.value as string}
              onChange={() => {}}
            />
          </div>
        ),
        generateCode: (p) => {
          const attrs: string[] = [`placeholder="${p.placeholder}"`];
          if (p.value) attrs.push(`value="${p.value}"`);
          return `<SearchBar ${attrs.join(' ')} onChange={handleChange} />`;
        },
      },
      variants: [
        {
          title: 'Default',
          preview: <div className="w-full max-w-xs"><SearchBar placeholder="Search components…" /></div>,
          code: `<SearchBar placeholder="Search components…" />`,
        },
        {
          title: 'With value',
          preview: <div className="w-full max-w-xs"><SearchBar value="Button" onChange={() => {}} /></div>,
          code: `<SearchBar value="Button" onChange={(v) => console.log(v)} />`,
        },
        {
          title: 'Loading state',
          layout: 'stack' as const,
          preview: (() => {
            function SearchLoadingDemo() {
              const [q, setQ] = useState('react');
              const [loading, setLoading] = useState(false);
              const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
              function handleChange(v: string) {
                setQ(v);
                setLoading(true);
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => setLoading(false), 800);
              }
              return (
                <div className="w-full max-w-xs space-y-2">
                  <SearchBar value={q} onChange={handleChange} placeholder="Search…" />
                  {loading ? (
                    <p className="text-xs text-text-secondary flex items-center gap-1.5">
                      <Spinner size="xs" /> Searching…
                    </p>
                  ) : q ? (
                    <p className="text-xs text-text-secondary">Found 24 results for &ldquo;{q}&rdquo;</p>
                  ) : null}
                </div>
              );
            }
            return <SearchLoadingDemo />;
          })(),
          code: `function Demo() {\n  const [q, setQ] = useState('');\n  const [loading, setLoading] = useState(false);\n  return (\n    <div className="space-y-2">\n      <SearchBar value={q} onChange={(v) => { setQ(v); setLoading(true); }} />\n      {loading\n        ? <p className="flex items-center gap-1.5"><Spinner size="xs" /> Searching…</p>\n        : q && <p>{q} — 24 results</p>}\n    </div>\n  );\n}`,
        },
        {
          title: 'With results count',
          layout: 'stack' as const,
          preview: (() => {
            const ITEMS = ['Button', 'Badge', 'Avatar', 'Card', 'Input', 'Select', 'Textarea', 'Tooltip', 'Modal', 'Drawer'];
            function ResultsSearchDemo() {
              const [q, setQ] = useState('');
              const filtered = q ? ITEMS.filter(n => n.toLowerCase().includes(q.toLowerCase())) : ITEMS;
              return (
                <div className="w-full max-w-xs space-y-2">
                  <SearchBar value={q} onChange={setQ} placeholder="Filter components…" />
                  <p className="text-xs text-text-secondary">{filtered.length} of {ITEMS.length} components</p>
                  <ul className="text-sm text-text-primary space-y-1">
                    {filtered.slice(0, 4).map(name => <li key={name} className="px-2 py-1 rounded hover:bg-surface-overlay">{name}</li>)}
                    {filtered.length > 4 && <li className="text-xs text-text-secondary px-2">+{filtered.length - 4} more…</li>}
                  </ul>
                </div>
              );
            }
            return <ResultsSearchDemo />;
          })(),
          code: `function Demo() {\n  const items = ['Button', 'Badge', 'Card', ...];\n  const [q, setQ] = useState('');\n  const filtered = q ? items.filter(n => n.toLowerCase().includes(q.toLowerCase())) : items;\n  return (\n    <div className="space-y-2">\n      <SearchBar value={q} onChange={setQ} />\n      <p className="text-xs text-text-secondary">{filtered.length} of {items.length} results</p>\n      <ul>{filtered.map(name => <li key={name}>{name}</li>)}</ul>\n    </div>\n  );\n}`,
        },
      ],
    },
  ];
}
