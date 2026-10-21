'use client';
import { useRef, useState } from 'react';
import { RichTextEditor, type RichTextEditorHandle, type SlashCommand } from '@/modules/app/RichTextEditor';
import { CodeEditor } from '@/modules/ui/CodeEditor';
import type { ShowcaseComponent } from '../showcase.types';

const SAMPLE_HTML = `<h1>Release notes</h1>
<p>This week we shipped <strong>three</strong> things you should know about.</p>
<h2>New features</h2>
<ul>
  <li>Inline <em>image upload</em> in the editor toolbar.</li>
  <li>Block-level <code>code</code> snippets with syntax highlighting.</li>
  <li>Read-only mode for archived documents.</li>
</ul>
<blockquote>Pixel parity between the React and EJS sibling components is now enforced.</blockquote>
<p>Read the <a href="https://example.com/changelog">full changelog</a> for the rest.</p>`;

const SAMPLE_MENTIONS = [
  { id: 'u1', label: 'Jane Doe',     description: 'Product designer' },
  { id: 'u2', label: 'John Smith',   description: 'Engineer' },
  { id: 'u3', label: 'Ada Lovelace', description: 'CTO' },
  { id: 'u4', label: 'Alan Turing',  description: 'Founder' },
  { id: 'u5', label: 'Grace Hopper', description: 'VP Engineering' },
];

function EmptyDemo() {
  const [html, setHtml] = useState('');
  return (
    <RichTextEditor
      id="rte-empty"
      label="Article body"
      hint="Use the toolbar — markdown shortcuts work too: try **bold** or # heading."
      value={html}
      onChange={setHtml}
      placeholder="Start writing your article…"
      showCounter
      showWordCount
    />
  );
}

function PrepopulatedDemo() {
  return (
    <RichTextEditor
      id="rte-prefilled"
      label="Release notes"
      defaultValue={SAMPLE_HTML}
    />
  );
}

function ReadOnlyDemo() {
  return (
    <RichTextEditor
      id="rte-readonly"
      label="Archived document"
      hint="This document is read-only."
      defaultValue={SAMPLE_HTML}
      readOnly
    />
  );
}

function MaxLengthDemo() {
  const [html, setHtml] = useState('');
  return (
    <RichTextEditor
      id="rte-maxlen"
      label="Short summary"
      hint="Maximum 200 characters."
      value={html}
      onChange={setHtml}
      maxLength={200}
      showCounter
      minHeight={120}
    />
  );
}

function MentionSlashDemo() {
  const [html, setHtml] = useState('');
  const slashItems: SlashCommand[] = [
    { id: 'h1',   label: 'Heading 1',   description: 'Big section title', action: (q) => q.format('header', 1, 'user') },
    { id: 'h2',   label: 'Heading 2',   description: 'Medium title',      action: (q) => q.format('header', 2, 'user') },
    { id: 'list', label: 'Bullet list', description: 'Unordered list',    action: (q) => q.format('list', 'bullet', 'user') },
    { id: 'quote',label: 'Quote',       description: 'Block quote',       action: (q) => q.format('blockquote', true, 'user') },
    { id: 'code', label: 'Code block',  description: 'Monospaced block',  action: (q) => q.format('code-block', true, 'user') },
    { id: 'hr',   label: 'Divider',     description: 'Horizontal rule',   action: (q) => q.clipboard.dangerouslyPasteHTML('<hr/>', 'user') },
  ];
  return (
    <RichTextEditor
      id="rte-mention-slash"
      label="Comment"
      hint="Type @ to mention a teammate, or / to insert a block."
      value={html}
      onChange={setHtml}
      mentions={SAMPLE_MENTIONS}
      slashItems={slashItems}
      placeholder="Try typing @ or / …"
    />
  );
}

function ImperativeDemo() {
  const ref = useRef<RichTextEditorHandle>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => ref.current?.focus()}
          className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-overlay">Focus</button>
        <button type="button" onClick={() => ref.current?.clear()}
          className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-overlay">Clear</button>
        <button type="button" onClick={() => ref.current?.insertHTML('<p><strong>Inserted</strong> via ref API.</p>')}
          className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-overlay">Insert HTML</button>
        <button type="button" onClick={() => alert(ref.current?.getText())}
          className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-overlay">Read plain text</button>
      </div>
      <RichTextEditor
        ref={ref}
        id="rte-imperative"
        label="Imperative handle"
        defaultValue="<p>Click the buttons above to drive this editor programmatically.</p>"
      />
    </div>
  );
}

function FormDemo() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setSubmitted(String(data.get('body') ?? ''));
      }}
    >
      <RichTextEditor
        id="rte-form"
        name="body"
        label="Description"
        defaultValue="<p>This editor syncs to a hidden input.</p>"
        minHeight={120}
      />
      <button type="submit"
        className="px-4 py-2 rounded-md bg-primary text-primary-fg hover:bg-primary-hover text-sm font-medium">
        Submit
      </button>
      {submitted !== null && (
        <pre className="text-[10px] leading-snug bg-surface-sunken text-text-secondary p-2 rounded-md overflow-auto max-h-[200px] whitespace-pre-wrap break-words">
          {submitted}
        </pre>
      )}
    </form>
  );
}

function AutosaveDemo() {
  return (
    <RichTextEditor
      id="rte-autosave"
      label="Draft (auto-saved to localStorage)"
      hint="Your changes survive page refresh — key: 'demo-draft'."
      autosaveKey="demo-draft"
      placeholder="Type, then refresh the page to verify autosave…"
      minHeight={140}
    />
  );
}

const SAMPLE_JS = `// Fibonacci sequence
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(fib(i));
}`;

function CodeEditorJsDemo() {
  return (
    <CodeEditor
      id="ce-js-readonly"
      label="example.js"
      hint="Read-only JavaScript snippet with line numbers."
      value={SAMPLE_JS}
      language="js"
      theme="light"
      readonly
      showLineNumbers
      minHeight={220}
    />
  );
}

function CodeEditorMarkdownDemo() {
  const [src, setSrc] = useState(`# Hello CodeEditor

Edit this markdown — line numbers update live.

- Lightweight CodeMirror fallback engine
- Token-based theming via CSS variables
- Future: Monaco opt-in, diagnostics, autocomplete
`);
  return (
    <CodeEditor
      id="ce-md-editable"
      name="readme"
      label="README.md"
      hint="Editable markdown. The hidden form input is synced to the value."
      value={src}
      onChange={setSrc}
      language="markdown"
      theme="dark"
      placeholder="Start typing markdown…"
      showLineNumbers
      minHeight={220}
    />
  );
}

const SCRIPT_NAMES = [
  { label: 'msg.payload', detail: 'any', documentation: 'The body of the message.' },
  { label: 'msg.metadata', detail: 'object', documentation: 'Writable except the system fields.' },
  { label: 'node.send', insertText: 'node.send(', detail: 'send at once', documentation: 'Send a message on output 1 at once.' },
  { label: 'node.warn', insertText: 'node.warn(', detail: 'log', documentation: 'Write to the block log.' },
];

function CodeEditorAidsDemo() {
  const [src, setSrc] = useState('const t = msg.payload.temp;\nif (t > 30 {\n  node.warn("hot");\n}\nreturn msg;\n');
  // a toy check for the demo: an opening bracket on a line without its closing one
  const markers = src.split('\n').flatMap((line, i) =>
    (line.match(/\(/g)?.length ?? 0) > (line.match(/\)/g)?.length ?? 0)
      ? [{ line: i + 1, column: line.indexOf('(') + 1, severity: 'error' as const, message: 'This ( is not closed on its line.', source: 'demo' }]
      : []);
  return (
    <CodeEditor
      id="ce-aids"
      label="script.js"
      hint="Type msg. or press Ctrl+Space for suggestions; Ctrl+/ comments a line; Ctrl+F finds."
      value={src}
      onChange={setSrc}
      language="js"
      showToolbar
      markers={markers}
      format={(v) => v.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')}
      getSuggestions={() => SCRIPT_NAMES}
      getHover={({ word }) => { const s = SCRIPT_NAMES.find((x) => x.label === word); return s ? { contents: s.documentation } : null; }}
      minHeight={180}
    />
  );
}

export function buildAppEditorData(): ShowcaseComponent[] {
  return [
    {
      id: 'code-editor',
      title: 'CodeEditor',
      category: 'App',
      abbr: 'CE',
      description:
        'Engine-agnostic code editor primitive on a textarea engine (line-number gutter, active line, theme, readonly, placeholder). M2: Tab / Shift+Tab indent (Esc then Tab leaves), Ctrl/Cmd+/ comment toggle, auto-indent, bracket and quote pairs, a toolbar (find / replace, format, copy, full screen), format-on-save. M3: diagnostics (markers in the gutter, tinted lines, a list that jumps to the spot), completion (getSuggestions, a listbox) and hover (getHover). Later: Monaco lazy engine, multi-cursor, minimap, folding, vim/emacs keymap. EJS sibling at modules/ui/CodeEditor/CodeEditor.ejs (kui-ejs) at parity: the M2 editing aids and the M3 diagnostics, completion and hover; on the server the `format` / `getSuggestions` / `getHover` options name global functions, in the browser `KuiCodeEditor.attach(root, opts)` takes functions. Used by the RulesetEditor code fields (the automation script with completion, hover and checks).',
      filePath: 'modules/ui/CodeEditor/index.tsx',
      sourceCode: `import { CodeEditor } from '@/modules/ui/CodeEditor';

// Read-only snippet:
<CodeEditor
  id="example"
  language="js"
  theme="light"
  value={source}
  readonly
/>

// Editable markdown (controlled):
const [src, setSrc] = useState('');
<CodeEditor
  id="readme"
  name="readme"
  label="README.md"
  language="markdown"
  theme="dark"
  value={src}
  onChange={setSrc}
  placeholder="Start typing markdown…"
/>

// Toolbar, diagnostics, completion and hover (M2 / M3):
<CodeEditor
  id="script"
  language="js"
  value={code}
  onChange={setCode}
  showToolbar
  format={tidy}
  markers={[{ line: 2, column: 4, severity: 'error', message: 'This ( is not closed.' }]}
  getSuggestions={({ prefix }) => names}
  getHover={({ word }) => ({ contents: helpOf(word) })}
/>

// Opt-in Monaco engine (falls back to the textarea engine for now):
<CodeEditor engine="monaco" language="ts" value={code} onChange={setCode} />`,
      since: '2026-05',
      composes: [],
      designTokens: [
        '--surface-base', '--surface-raised', '--surface-overlay', '--surface-sunken',
        '--text-primary', '--text-secondary', '--text-disabled',
        '--border', '--border-strong', '--border-focus', '--error',
      ],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['textbox'],
        keyboardInteractions: [
          { keys: 'Tab',         action: 'Move focus into / out of the editor' },
          { keys: 'Arrow keys',  action: 'Move caret + sync active line gutter' },
          { keys: 'Ctrl/Cmd + Z', action: 'Browser-native undo (edits go through insertText)' },
          { keys: 'Tab / Shift + Tab', action: 'Indent / outdent; Esc then Tab moves focus out' },
          { keys: 'Ctrl/Cmd + /', action: 'Toggle a line comment' },
          { keys: 'Ctrl + Space', action: 'Open suggestions; Arrow keys pick, Enter or Tab inserts, Esc closes' },
          { keys: 'Ctrl/Cmd + F', action: 'Find and replace' },
          { keys: 'Shift + Alt + F', action: 'Format (when the editor has a format function)' },
        ],
      },
      variants: [
        {
          title: 'Script with aids (M2 / M3)',
          layout: 'stack' as const,
          preview: <CodeEditorAidsDemo />,
          code: `<CodeEditor id="script" language="js" value={code} onChange={setCode} showToolbar
  markers={markers} format={tidy} getSuggestions={() => names} getHover={({ word }) => help(word)} />`,
        },
        {
          title: 'JavaScript readonly',
          layout: 'stack' as const,
          preview: <CodeEditorJsDemo />,
          code: `<CodeEditor
  id="example"
  label="example.js"
  language="js"
  theme="light"
  value={source}
  readonly
  showLineNumbers
/>`,
        },
        {
          title: 'Markdown editable',
          layout: 'stack' as const,
          preview: <CodeEditorMarkdownDemo />,
          code: `const [src, setSrc] = useState('# Hello');
<CodeEditor
  id="readme"
  name="readme"
  label="README.md"
  language="markdown"
  theme="dark"
  value={src}
  onChange={setSrc}
  placeholder="Start typing markdown…"
/>`,
        },
      ],
    },
    {
      id: 'rich-text-editor',
      title: 'RichTextEditor',
      category: 'App',
      abbr: 'RT',
      description:
        'Quill 2.x WYSIWYG editor with token-tinted snow theme. Production features: controlled value, imperative ref API, onBlur, name+hidden-form-sync, drag-and-drop image upload with onImageUpload callback, paste sanitization (Word / GDocs cleanup), char + word counter with maxLength, autosave to localStorage, markdown shortcuts, color + highlight, sub/sup, indent/outdent, horizontal rule, tables, emoji picker, @-mentions, /-slash command menu, selection bubble menu, image resize/align overlay, fullscreen mode. Pixel-identical EJS sibling at modules/app/RichTextEditor.ejs.',
      filePath: 'modules/app/RichTextEditor/index.tsx',
      sourceCode: `import { useRef, useState } from 'react';
import { RichTextEditor, type RichTextEditorHandle } from '@/modules/app/RichTextEditor';

// Controlled with counter + maxLength:
const [body, setBody] = useState('');
<RichTextEditor
  id="article-body"
  label="Article body"
  value={body}
  onChange={setBody}
  maxLength={2000}
  showCounter
  showWordCount
/>

// Imperative handle:
const ref = useRef<RichTextEditorHandle>(null);
<RichTextEditor ref={ref} id="reply" />
ref.current?.focus();
ref.current?.insertHTML('<p>Hi!</p>');

// Form integration (hidden input synced to 'body'):
<form>
  <RichTextEditor id="post" name="body" defaultValue={savedHtml} />
  <button type="submit">Save</button>
</form>

// Image upload to CDN instead of base64:
<RichTextEditor
  id="cms"
  onImageUpload={async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const { url } = await r.json();
    return url;
  }}
/>

// Autosave to localStorage:
<RichTextEditor id="draft" autosaveKey="my-draft" />

// Mentions + slash commands:
<RichTextEditor
  id="comment"
  mentions={[{ id: 'u1', label: 'Jane Doe', description: 'Designer' }]}
  slashItems={[{
    id: 'h1', label: 'Heading 1',
    action: (q) => q.format('header', 1, 'user'),
  }]}
/>`,
      since: '2026-05',
      composes: ['modal', 'input', 'button'],
      dependencies: ['quill'],
      designTokens: [
        '--surface-base', '--surface-sunken', '--surface-raised', '--surface-overlay',
        '--text-primary', '--text-secondary', '--text-disabled',
        '--border', '--border-focus', '--primary', '--primary-subtle', '--error',
      ],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['textbox', 'toolbar', 'dialog', 'listbox'],
        keyboardInteractions: [
          { keys: 'Ctrl/Cmd + B',         action: 'Bold selection' },
          { keys: 'Ctrl/Cmd + I',         action: 'Italic selection' },
          { keys: 'Ctrl/Cmd + U',         action: 'Underline selection' },
          { keys: 'Ctrl/Cmd + Z',         action: 'Undo' },
          { keys: 'Ctrl/Cmd + Shift + Z', action: 'Redo' },
          { keys: 'Tab / Shift+Tab',      action: 'Indent / outdent in lists' },
          { keys: '@',                    action: 'Open mention suggestions' },
          { keys: '/',                    action: 'Open slash-command menu (at line start)' },
          { keys: '** ** / * * / ` `',    action: 'Markdown bold / italic / code' },
          { keys: '# / ## / ###',         action: 'Markdown headings' },
          { keys: '- / * / 1.',           action: 'Markdown bullet / numbered list' },
          { keys: '> ',                   action: 'Markdown blockquote' },
        ],
      },
      variants: [
        {
          title: 'Empty + counter',
          layout: 'stack' as const,
          preview: <EmptyDemo />,
          code: `const [body, setBody] = useState('');
<RichTextEditor
  id="article-body"
  label="Article body"
  value={body}
  onChange={setBody}
  showCounter
  showWordCount
/>`,
        },
        {
          title: 'Pre-populated',
          layout: 'stack' as const,
          preview: <PrepopulatedDemo />,
          code: `<RichTextEditor
  id="release-notes"
  label="Release notes"
  defaultValue={initial}
  onChange={setBody}
/>`,
        },
        {
          title: 'Read-only',
          layout: 'stack' as const,
          preview: <ReadOnlyDemo />,
          code: `<RichTextEditor
  id="archived"
  defaultValue={savedHtml}
  readOnly
/>`,
        },
        {
          title: 'Max length (200 chars)',
          layout: 'stack' as const,
          preview: <MaxLengthDemo />,
          code: `<RichTextEditor
  id="short-summary"
  maxLength={200}
  showCounter
/>`,
        },
        {
          title: 'Mentions + slash commands',
          layout: 'stack' as const,
          preview: <MentionSlashDemo />,
          code: `<RichTextEditor
  id="comment"
  mentions={[
    { id: 'u1', label: 'Jane Doe', description: 'Designer' },
    { id: 'u2', label: 'John Smith', description: 'Engineer' },
  ]}
  slashItems={[
    { id: 'h1', label: 'Heading 1', action: (q) => q.format('header', 1, 'user') },
    { id: 'list', label: 'Bullet list', action: (q) => q.format('list', 'bullet', 'user') },
  ]}
/>`,
        },
        {
          title: 'Imperative ref API',
          layout: 'stack' as const,
          preview: <ImperativeDemo />,
          code: `const ref = useRef<RichTextEditorHandle>(null);
<RichTextEditor ref={ref} id="reply" />
ref.current?.focus();
ref.current?.clear();
ref.current?.insertHTML('<p>Hi!</p>');
const text = ref.current?.getText();`,
        },
        {
          title: 'Form integration',
          layout: 'stack' as const,
          preview: <FormDemo />,
          code: `<form action="/api/post" method="post">
  <RichTextEditor id="post" name="body" defaultValue={savedHtml} />
  <button type="submit">Save</button>
</form>`,
        },
        {
          title: 'Autosave',
          layout: 'stack' as const,
          preview: <AutosaveDemo />,
          code: `<RichTextEditor
  id="draft"
  autosaveKey="my-draft"
  placeholder="Survives page refresh…"
/>`,
        },
      ],
    },
  ];
}
