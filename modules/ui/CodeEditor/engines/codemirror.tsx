'use client';
// modules/ui/CodeEditor/engines/codemirror.tsx
//
// CodeMirror engine — textarea implementation (M1 contract, plus M2 and M3).
//
// CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/lang-*`)
// is NOT yet a project dependency. This file ships a textarea-based engine:
// line-number gutter, active line, readonly, placeholder, theme class,
// language data attr (M1); Tab / Shift+Tab indent (Esc, then Tab leaves the
// field), Ctrl/Cmd+/ comment toggle, auto-indent on Enter, bracket and quote
// pairs, Ctrl/Cmd+F and Shift+Alt+F handed to the toolbar (M2); diagnostics
// in the gutter with tinted lines, a completion listbox and a hover card
// (M3). Edits go through the browser's `insertText` where it has one, so
// Ctrl+Z undoes them like typing.
//
// TODO M1+: once CodeMirror 6 is added as a dependency, swap the textarea
//           for a lazy-loaded EditorView inside useLazyEngine, behind the
//           same CodeEditorEngineProps shape. The exported component name
//           should not change so the top-level CodeEditor is untouched.
// TODO M4:  minimap (custom) + code folding (@codemirror/language).

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Gutter } from '../parts/Gutter';
import {
  applyEdit, backspaceEdit, commentEdit, commentTokenOf, cursorAt, enterEdit, filterSuggestions, indentEdit, indexAt, pairEdit, prefixAt,
  suggestionEdit, wordAt, type TextEdit,
} from '../editing';
import type { CodeEditorEngineProps, Marker, Suggestion } from '../types';

const themeRootClass: Record<CodeEditorEngineProps['theme'], string> = {
  light: 'kui-codeeditor-theme-light bg-surface-base text-text-primary border-border',
  dark: 'kui-codeeditor-theme-dark bg-surface-sunken text-text-primary border-border-strong',
  'high-contrast':
    'kui-codeeditor-theme-hc bg-surface-base text-text-primary border-border-focus',
};

/** the text box's line height and padding (leading-5, px-3 py-2): the gutter, the tints and the popups line up with them */
const LINE_H = 20;
const PAD_Y = 8;
const PAD_X = 12;
/** the pointer rests this long on a name before its hover card is asked for */
export const HOVER_DELAY_MS = 400;

/** where the text box starts inside the editor's frame (after the gutter), for the popups */
const originOf = (ta: HTMLTextAreaElement | null) => ({
  x: (ta?.parentElement?.offsetLeft ?? 0) + (ta?.offsetLeft ?? 0),
  y: (ta?.parentElement?.offsetTop ?? 0) + (ta?.offsetTop ?? 0),
});

const SEVERITY_RANK: Record<Marker['severity'], number> = { error: 3, warning: 2, info: 1, hint: 0 };
const LINE_TINT: Record<Marker['severity'], string> = { error: 'bg-error-subtle', warning: 'bg-warning-subtle', info: 'bg-info-subtle', hint: 'bg-surface-overlay' };

/** the worst marker of each line */
export function markersByLine(markers: readonly Marker[] | undefined): Map<number, Marker> {
  const out = new Map<number, Marker>();
  for (const mk of markers ?? []) {
    const had = out.get(mk.line);
    if (!had || SEVERITY_RANK[mk.severity] > SEVERITY_RANK[had.severity]) out.set(mk.line, mk);
  }
  return out;
}

export function CodeMirrorEngine({
  value,
  onChange,
  language,
  theme,
  readonly,
  placeholder,
  minHeight,
  showLineNumbers,
  id,
  name,
  className,
  markers,
  getSuggestions,
  getHover,
  tabSize = 2,
  textareaRef,
  onFind,
  onFormat,
  messages,
  describedBy,
  invalid,
}: CodeEditorEngineProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const setTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    taRef.current = el;
    if (textareaRef) textareaRef.current = el;
  }, [textareaRef]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [activeLine, setActiveLine] = useState(1);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [charW, setCharW] = useState(0);
  const pendingSel = useRef<[number, number] | null>(null);
  const escaped = useRef(false);
  const typed = useRef<string | null>(null);
  const reqSeq = useRef(0);
  const [suggest, setSuggest] = useState<{ items: Suggestion[]; index: number; caret: number; origin: { x: number; y: number } } | null>(null);
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const listId = useId();
  const unit = ' '.repeat(Math.max(1, tabSize));
  const token = commentTokenOf(language);

  const lines = useMemo(() => (value ? value.split('\n') : ['']), [value]);
  const lineCount = Math.max(lines.length, 1);
  const byLine = useMemo(() => markersByLine(markers), [markers]);

  /* the width of one character of the mono font, for the popups and the hover (0 where nothing is laid out) */
  useLayoutEffect(() => {
    const w = measureRef.current?.getBoundingClientRect().width ?? 0;
    setCharW(w > 0 ? w / 10 : 0);
  }, []);

  /* a selection set by an edit that went through `onChange`: placed once the new value is in the box */
  useLayoutEffect(() => {
    const sel = pendingSel.current;
    if (sel && taRef.current) { pendingSel.current = null; taRef.current.setSelectionRange(sel[0], sel[1]); }
  }, [value]);

  const updateActiveLine = useCallback((ta: HTMLTextAreaElement) => {
    const sel = ta.selectionStart ?? 0;
    setActiveLine(ta.value.slice(0, sel).split('\n').length);
  }, []);

  // Keep the gutter active-line cursor in sync without forcing a render storm.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const handler = () => updateActiveLine(ta);
    ta.addEventListener('keyup', handler);
    ta.addEventListener('click', handler);
    ta.addEventListener('focus', handler);
    return () => {
      ta.removeEventListener('keyup', handler);
      ta.removeEventListener('click', handler);
      ta.removeEventListener('focus', handler);
    };
  }, [updateActiveLine]);

  useEffect(() => () => { if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current); }, []);

  // Sync vertical scroll between gutter + textarea, and the line tints and popups with it.
  const onScroll = useCallback(() => {
    const ta = taRef.current;
    const wrap = wrapRef.current;
    if (!ta || !wrap) return;
    const gutterEl = wrap.querySelector<HTMLElement>('[data-kui-codeeditor-gutter]');
    if (gutterEl) gutterEl.scrollTop = ta.scrollTop;
    setScroll({ top: ta.scrollTop, left: ta.scrollLeft });
  }, []);

  /** one edit: through the browser's undo stack where it can, else as a new value with the selection placed after it */
  function apply(e: TextEdit) {
    const ta = taRef.current;
    if (!ta) return;
    if (e.from === e.to && !e.text) { ta.setSelectionRange(e.selStart, e.selEnd); return; }
    ta.setSelectionRange(e.from, e.to);
    let native = false;
    try {
      native = typeof document.execCommand === 'function' && document.execCommand(e.text ? 'insertText' : 'delete', false, e.text);
    } catch { native = false; }
    if (native && ta.value === applyEdit(value, e)) { ta.setSelectionRange(e.selStart, e.selEnd); return; }
    pendingSel.current = [e.selStart, e.selEnd];
    onChange?.(applyEdit(value, e));
  }

  function requestSuggestions(text: string, caret: number, explicit: boolean, trigger?: string) {
    if (!getSuggestions) return;
    const { text: prefix } = prefixAt(text, caret);
    if (!explicit && !prefix) { setSuggest(null); return; }
    const seq = ++reqSeq.current;
    Promise.resolve(getSuggestions({ language, value: text, cursor: cursorAt(text, caret), triggerCharacter: trigger, prefix }))
      .then((list) => {
        if (seq !== reqSeq.current) return;
        const items = filterSuggestions(list ?? [], prefix);
        setSuggest(items.length ? { items, index: 0, caret, origin: originOf(taRef.current) } : null);
      })
      .catch(() => { if (seq === reqSeq.current) setSuggest(null); });
  }

  function accept(s: Suggestion) {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? suggest?.caret ?? 0;
    setSuggest(null);
    reqSeq.current++;
    apply(suggestionEdit(value, caret, s));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const s = ta.selectionStart ?? 0, en = ta.selectionEnd ?? 0;
    const mod = e.ctrlKey || e.metaKey;
    typed.current = !mod && !e.altKey && e.key.length === 1 ? e.key : null;
    if (hover) setHover(null);
    if (suggest) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = suggest.items.length;
        setSuggest({ ...suggest, index: (suggest.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(suggest.items[suggest.index]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSuggest(null); reqSeq.current++; return; }
    }
    if (mod && !e.altKey && e.key.toLowerCase() === 'f') { if (onFind) { e.preventDefault(); onFind(); } return; }
    if (e.shiftKey && e.altKey && !mod && e.code === 'KeyF') { if (onFormat && !readonly) { e.preventDefault(); onFormat(); } return; }
    if (readonly) return;
    if (e.key === 'Escape') { escaped.current = true; return; }
    if (e.key === 'Tab' && !mod && !e.altKey) {
      // Esc, then Tab: the key moves the focus on, as everywhere else on the page
      if (escaped.current) { escaped.current = false; return; }
      e.preventDefault();
      apply(indentEdit(value, s, en, e.shiftKey, unit));
      return;
    }
    escaped.current = false;
    if (mod && !e.altKey && e.key === '/' && token) { e.preventDefault(); apply(commentEdit(value, s, en, token)); return; }
    if (mod && e.key === ' ' && getSuggestions) { e.preventDefault(); requestSuggestions(value, s, true); return; }
    if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey && !e.nativeEvent.isComposing) { e.preventDefault(); apply(enterEdit(value, s, en, unit)); return; }
    if (e.key === 'Backspace' && !mod && !e.altKey) {
      const edit = backspaceEdit(value, s, en);
      if (edit) { e.preventDefault(); apply(edit); setSuggest(null); }
      return;
    }
    if (typed.current) {
      const edit = pairEdit(value, s, en, typed.current);
      if (edit) { e.preventDefault(); apply(edit); }
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange?.(next);
    if (!getSuggestions) return;
    const ch = typed.current;
    if (ch && /[\w$.]/.test(ch)) requestSuggestions(next, e.target.selectionStart ?? next.length, false, ch);
    else if (suggest) {
      // Backspace keeps the list while a name is still being typed
      if (ch === null && prefixAt(next, e.target.selectionStart ?? 0).text) requestSuggestions(next, e.target.selectionStart ?? 0, false);
      else setSuggest(null);
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLTextAreaElement>) {
    if (!getHover || charW <= 0) return;
    const ta = e.currentTarget;
    const r = ta.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const line = Math.floor((y + ta.scrollTop - PAD_Y) / LINE_H) + 1;
    const column = Math.floor((x + ta.scrollLeft - PAD_X) / charW) + 1;
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    const text = lines[line - 1];
    if (text === undefined || column < 1 || column > text.length) { if (hover) setHover(null); return; }
    const word = wordAt(value, indexAt(value, line, column));
    if (!word) { if (hover) setHover(null); return; }
    const o = originOf(ta);
    const at = { x: x + o.x, y: (line * LINE_H) + PAD_Y - ta.scrollTop + o.y + 2 };
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = null;
      Promise.resolve(getHover({ language, value, word, cursor: { line, column } }))
        .then((h) => setHover(h?.contents ? { text: h.contents, ...at } : null))
        .catch(() => setHover(null));
    }, HOVER_DELAY_MS);
  }

  function onMouseLeave() {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHover(null);
  }

  /* where the completion list opens: under the caret's line, at the start of the name being typed */
  const popupAt = (() => {
    if (!suggest) return null;
    const c = cursorAt(value, suggest.caret);
    const cw = charW > 0 ? charW : 8;
    const o = suggest.origin;
    return {
      top: c.line * LINE_H + PAD_Y - scroll.top + o.y + 2,
      left: Math.max(0, (c.column - 1 - prefixAt(value, suggest.caret).text.length) * cw + PAD_X - scroll.left + o.x),
    };
  })();

  return (
    <div
      ref={wrapRef}
      data-kui-codeeditor-engine="codemirror-fallback"
      data-language={language}
      data-theme={theme}
      data-readonly={readonly ? '' : undefined}
      className={cn(
        'relative flex w-full overflow-hidden rounded-md border font-mono text-sm',
        'focus-within:ring-2 focus-within:ring-border-focus',
        themeRootClass[theme],
        className
      )}
      style={{ minHeight }}
    >
      <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre font-mono text-sm">0000000000</span>
      {showLineNumbers && (
        <Gutter
          lineCount={lineCount}
          activeLine={activeLine}
          minHeight={minHeight}
          markers={byLine.size ? byLine : undefined}
        />
      )}
      <div className="relative flex min-w-0 flex-1">
        {byLine.size > 0 && (
          <div aria-hidden="true" data-kui-codeeditor-tints className="pointer-events-none absolute inset-x-0 top-0" style={{ transform: `translateY(${-scroll.top}px)` }}>
            {[...byLine.values()].map((mk) => (
              <div key={mk.line} data-line={mk.line} className={cn('absolute inset-x-0', LINE_TINT[mk.severity])} style={{ top: PAD_Y + (mk.line - 1) * LINE_H, height: LINE_H }} />
            ))}
          </div>
        )}
        <textarea
          ref={setTextarea}
          id={id}
          name={name}
          value={value}
          readOnly={readonly}
          spellCheck={false}
          wrap="off"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          placeholder={placeholder}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          onBlur={() => { setSuggest(null); reqSeq.current++; }}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          aria-multiline="true"
          aria-readonly={readonly ? true : undefined}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          aria-autocomplete={getSuggestions ? 'list' : undefined}
          aria-controls={suggest ? listId : undefined}
          aria-activedescendant={suggest ? `${listId}-${suggest.index}` : undefined}
          className={cn(
            'relative flex-1 min-w-0 resize-none bg-transparent px-3 py-2 leading-5',
            'font-mono text-sm tabular-nums caret-text-primary',
            'placeholder:text-text-disabled',
            'focus-visible:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            readonly && 'cursor-default'
          )}
          style={{ minHeight }}
        />
      </div>
      {suggest && popupAt && (
        <ul
          id={listId}
          role="listbox"
          aria-label={messages.suggestions}
          data-kui-codeeditor-suggest
          className="absolute z-20 max-h-48 min-w-48 max-w-[min(24rem,90%)] overflow-y-auto rounded-md border border-border bg-surface-overlay py-1 text-xs shadow-lg"
          style={{ top: popupAt.top, left: popupAt.left }}
        >
          {suggest.items.map((s, i) => (
            <li
              key={s.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === suggest.index}
              onMouseDown={(e) => { e.preventDefault(); accept(s); }}
              className={cn('flex cursor-pointer items-baseline gap-2 px-2 py-1', i === suggest.index ? 'bg-primary-subtle text-primary' : 'text-text-primary hover:bg-surface-raised')}
            >
              <span className="font-mono">{s.label}</span>
              {s.detail && <span className="ml-auto truncate pl-3 font-sans text-[11px] text-text-secondary">{s.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {hover && (
        <div
          role="tooltip"
          data-kui-codeeditor-hover
          className="pointer-events-none absolute z-20 max-w-72 whitespace-pre-wrap rounded-md border border-border bg-surface-overlay px-2.5 py-1.5 font-sans text-xs text-text-primary shadow-lg"
          style={{ top: hover.y, left: hover.x }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}
