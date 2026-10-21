'use client';
// modules/ui/CodeEditor/index.tsx
//
// CodeEditor — engine-agnostic code editor primitive. Default engine is
// CodeMirror 6 (lightweight; today a textarea engine with the M2 and M3
// aids). Monaco (VSCode) is opt-in via `engine="monaco"` and falls back to
// the same engine until it lands.
//
// Pixel-identical EJS sibling at modules/ui/CodeEditor/CodeEditor.ejs (kui-ejs), at parity:
// the M2 editing aids and the M3 diagnostics, completion and hover. There the
// `format` / `getSuggestions` / `getHover` options name global functions on the
// server; in the browser `KuiCodeEditor.attach(root, opts)` takes functions.
//
// Adoption:
//   - RulesetEditor's code fields (the automation script with completion,
//     hover and parse diagnostics).
//   - RichTextEditor "Insert code block" uses this in an embedded mode (planned).
//   - DiffViewer (37) builds left/right panes on top of this (planned).
//
// M2: toolbar (`showToolbar`), find / replace (Ctrl/Cmd+F), format (`format`,
//     `formatOnSave`), fullscreen, plus the engine's keys (indent, comment, pairs).
// M3: `markers` (gutter, tinted lines, the list under the field),
//     `getSuggestions`, `getHover`. `extraLibs` waits for a TS engine.
// TODO M4: minimap, vim/emacs keymap, code folding.
// TODO M5: ARIA live region for diagnostics + reduced-motion cursor.

import { useEffect, useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faTriangleExclamation, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { ENGINES } from './hooks/useLazyEngine';
import { useDiagnostics } from './hooks/useDiagnostics';
import { Toolbar } from './parts/Toolbar';
import { FindBar } from './parts/FindBar';
import { indexAt } from './editing';
import type { CodeEditorMessages, CodeEditorProps, Marker } from './types';

export const DEFAULT_CODE_EDITOR_MESSAGES: CodeEditorMessages = {
  placeholder: '',
  loading: 'Loading…',
  readOnlyLabel: 'read-only',
  toolbarLabel: 'Code tools',
  find: 'Find and replace',
  findPlaceholder: 'Find',
  replacePlaceholder: 'Replace with',
  findPrev: 'Previous match',
  findNext: 'Next match',
  findClose: 'Close find',
  replaceOne: 'Replace',
  replaceAll: 'Replace all',
  matchCase: 'Match case',
  findNone: 'No match',
  findCount: (current, total) => `${current} of ${total}`,
  format: 'Format the code',
  copy: 'Copy the code',
  copied: 'Copied',
  fullscreen: 'Full screen',
  exitFullscreen: 'Leave full screen',
  suggestions: 'Suggestions',
  problems: 'Problems in the code',
  markerAt: (line, column, message) => `Line ${line}${column ? `, column ${column}` : ''}: ${message}`,
};

const MARKER_ICON = { error: faCircleExclamation, warning: faTriangleExclamation, info: faCircleInfo, hint: faCircleInfo } as const;
const MARKER_TONE: Record<Marker['severity'], string> = { error: 'text-error', warning: 'text-warning-fg', info: 'text-info', hint: 'text-text-secondary' };

export function CodeEditor({
  value,
  onChange,
  language = 'plaintext',
  theme = 'light',
  engine = 'codemirror',
  readonly = false,
  placeholder = '',
  label,
  hint,
  error,
  minHeight = 200,
  showLineNumbers = true,
  id,
  name,
  className,
  showToolbar = false,
  formatOnSave = false,
  format,
  tabSize = 2,
  markers,
  getSuggestions,
  getHover,
  extraLibs: _extraLibs,
  showMinimap: _showMinimap,
  keymap: _keymap,
  messages,
}: CodeEditorProps) {
  const Engine = ENGINES[engine] ?? ENGINES.codemirror;
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const m = { ...DEFAULT_CODE_EDITOR_MESSAGES, ...messages };
  const sorted = useDiagnostics(markers);
  const [findOpen, setFindOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const uid = useId();
  const noteId = `${id ?? uid}-note`;
  const problemsId = `${id ?? uid}-problems`;

  // Keep the hidden form input in sync — supports drop-in <form> usage.
  useEffect(() => {
    if (hiddenInputRef.current) hiddenInputRef.current.value = value ?? '';
  }, [value]);

  // Escape leaves full screen (the field keeps its own Escape for the suggestion list)
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  async function runFormat() {
    if (!format || readonly) return;
    try {
      const next = await format(value);
      if (typeof next === 'string' && next !== value) onChange?.(next);
    } catch { /* a formatter that fails leaves the code as it was */ }
  }

  function goTo(mk: Marker) {
    const ta = textareaRef.current;
    if (!ta) return;
    const at = indexAt(value, mk.line, mk.column ?? 1);
    ta.focus();
    ta.setSelectionRange(at, at);
    ta.scrollTop = Math.max(0, (mk.line - 1) * 20 - ta.clientHeight / 2);
  }

  const describedBy = [hint || error ? noteId : '', sorted.length ? problemsId : ''].filter(Boolean).join(' ') || undefined;
  const hasErrors = !!error || sorted.some((x) => x.severity === 'error');
  const copy = () => { try { void navigator.clipboard?.writeText(value).catch(() => undefined); } catch { /* no clipboard */ } };

  return (
    <div
      data-kui-codeeditor
      data-engine={engine}
      data-language={language}
      data-theme={theme}
      data-fullscreen={fullscreen ? '' : undefined}
      className={cn('w-full', fullscreen && 'fixed inset-0 z-[60] flex flex-col overflow-auto bg-surface-base p-4', className)}
      onKeyDownCapture={formatOnSave && format ? (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') void runFormat();
      } : undefined}
    >
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text-primary mb-1"
        >
          {label}
        </label>
      )}

      {showToolbar && (
        <Toolbar language={language} theme={theme} readonly={readonly} messages={m} findOpen={findOpen}
          onFind={() => setFindOpen((v) => !v)} onFormat={format ? () => void runFormat() : undefined} onCopy={copy}
          fullscreen={fullscreen} onFullscreen={() => setFullscreen((v) => !v)} />
      )}
      {findOpen && (
        <FindBar value={value} onChange={readonly ? undefined : onChange} textareaRef={textareaRef} readonly={readonly} messages={m} onClose={() => setFindOpen(false)} />
      )}

      <Engine
        value={value}
        onChange={onChange}
        language={language}
        theme={theme}
        readonly={readonly}
        placeholder={placeholder}
        minHeight={fullscreen ? Math.max(minHeight, 480) : minHeight}
        showLineNumbers={showLineNumbers}
        id={id}
        markers={markers}
        getSuggestions={getSuggestions}
        getHover={getHover}
        tabSize={tabSize}
        textareaRef={textareaRef}
        onFind={() => setFindOpen(true)}
        onFormat={format ? () => void runFormat() : undefined}
        messages={m}
        describedBy={describedBy}
        invalid={hasErrors}
        // The hidden input below carries the form name — engine's textarea
        // stays unnamed so the controlled value wins on submit.
        className={cn(error && 'border-error focus-within:ring-error', (showToolbar || findOpen) && 'rounded-t-none', fullscreen && 'flex-1')}
      />

      {name && (
        <input
          ref={hiddenInputRef}
          type="hidden"
          name={name}
          defaultValue={value ?? ''}
        />
      )}

      {sorted.length > 0 && (
        <ul id={problemsId} aria-label={m.problems} data-kui-codeeditor-problems className="mt-1 space-y-0.5">
          {sorted.map((mk, i) => (
            <li key={`${mk.line}:${mk.column ?? 0}:${i}`}>
              <button type="button" onClick={() => goTo(mk)} data-severity={mk.severity}
                className={cn('flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', MARKER_TONE[mk.severity])}>
                <FontAwesomeIcon icon={MARKER_ICON[mk.severity]} className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  {m.markerAt(mk.line, mk.column, mk.message)}
                  {(mk.source || mk.code) && <span className="text-text-secondary">{` (${[mk.source, mk.code].filter(Boolean).join(' ')})`}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(hint || error) && (
        <p
          id={noteId}
          className={cn(
            'mt-1 text-xs',
            error ? 'text-error' : 'text-text-secondary'
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

export type {
  CodeEditorProps,
  CodeEditorEngine,
  CodeEditorTheme,
  Lang,
  Marker,
  Suggestion,
  SuggestContext,
  Hover,
  HoverContext,
  CodeEditorMessages,
} from './types';
export { filterSuggestions, findMatches, cursorAt, indexAt, wordAt, prefixAt } from './editing';
