# CodeEditor

- **id:** `code-editor`
- **layer:** ui
- **category:** App
- **filePath:** `modules/ui/CodeEditor/index.tsx`
- **status:** stable
- **since:** 2026-05

Engine-agnostic code editor primitive on a textarea engine (line-number gutter, active line, theme, readonly, placeholder). M2: Tab / Shift+Tab indent (Esc then Tab leaves), Ctrl/Cmd+/ comment toggle, auto-indent, bracket and quote pairs, a toolbar (find / replace, format, copy, full screen), format-on-save. M3: diagnostics (markers in the gutter, tinted lines, a list that jumps to the spot), completion (getSuggestions, a listbox) and hover (getHover). Later: Monaco lazy engine, multi-cursor, minimap, folding, vim/emacs keymap. EJS sibling at modules/ui/CodeEditor/CodeEditor.ejs (kui-ejs) at parity: the M2 editing aids and the M3 diagnostics, completion and hover; on the server the `format` / `getSuggestions` / `getHover` options name global functions, in the browser `KuiCodeEditor.attach(root, opts)` takes functions. Used by the RulesetEditor code fields (the automation script with completion, hover and checks).

## Accessibility

- WCAG: AA
- ARIA patterns: textbox
- Keyboard:
  - `Tab` — Move focus into / out of the editor
  - `Arrow keys` — Move caret + sync active line gutter
  - `Ctrl/Cmd + Z` — Browser-native undo (edits go through insertText)
  - `Tab / Shift + Tab` — Indent / outdent; Esc then Tab moves focus out
  - `Ctrl/Cmd + /` — Toggle a line comment
  - `Ctrl + Space` — Open suggestions; Arrow keys pick, Enter or Tab inserts, Esc closes
  - `Ctrl/Cmd + F` — Find and replace
  - `Shift + Alt + F` — Format (when the editor has a format function)

## Design tokens consumed

- `--surface-base`
- `--surface-raised`
- `--surface-overlay`
- `--surface-sunken`
- `--text-primary`
- `--text-secondary`
- `--text-disabled`
- `--border`
- `--border-strong`
- `--border-focus`
- `--error`

## Variants

### Script with aids (M2 / M3)

```tsx
<CodeEditor id="script" language="js" value={code} onChange={setCode} showToolbar
  markers={markers} format={tidy} getSuggestions={() => names} getHover={({ word }) => help(word)} />
```

### JavaScript readonly

```tsx
<CodeEditor
  id="example"
  label="example.js"
  language="js"
  theme="light"
  value={source}
  readonly
  showLineNumbers
/>
```

### Markdown editable

```tsx
const [src, setSrc] = useState('# Hello');
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
```

## Full source

```tsx
import { CodeEditor } from '@/modules/ui/CodeEditor';

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
<CodeEditor engine="monaco" language="ts" value={code} onChange={setCode} />
```
