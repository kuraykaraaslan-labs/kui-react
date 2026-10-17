'use client';
// modules/ui/CodeEditor/parts/FindBar.tsx
//
// The find / replace bar (M2): plain text, optional match case, previous /
// next (Enter, Shift+Enter), replace one and replace all (not in a read-only
// editor). The match is selected in the field without taking the focus.

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { findMatches, replaceAllText } from '../editing';
import type { CodeEditorMessages } from '../types';

const input = 'h-7 min-w-0 flex-1 rounded-md border border-border bg-surface-base px-2 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
const btn = 'inline-flex h-7 shrink-0 items-center justify-center rounded-md px-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-40';

export function FindBar({ value, onChange, textareaRef, readonly, messages, onClose }: {
  value: string;
  onChange?: (next: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  readonly: boolean;
  messages: CodeEditorMessages;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [index, setIndex] = useState(0);
  const queryRef = useRef<HTMLInputElement>(null);
  const hits = findMatches(value, query, matchCase);
  const at = hits.length ? Math.min(index, hits.length - 1) : 0;

  useEffect(() => { queryRef.current?.focus(); queryRef.current?.select(); }, []);

  function show(i: number) {
    const hit = hits[i];
    const ta = textareaRef.current;
    if (!hit || !ta) return;
    setIndex(i);
    ta.setSelectionRange(hit[0], hit[1]);
    // scroll the match into view: the line times the line height, kept in the middle
    const line = value.slice(0, hit[0]).split('\n').length;
    ta.scrollTop = Math.max(0, (line - 1) * 20 - ta.clientHeight / 2);
  }
  const step = (d: 1 | -1) => hits.length && show((at + d + hits.length) % hits.length);

  function replaceOne() {
    const hit = hits[at];
    if (!hit || !onChange) return;
    onChange(value.slice(0, hit[0]) + replacement + value.slice(hit[1]));
  }

  return (
    <div data-kui-codeeditor-find role="search" aria-label={messages.find}
      className="flex flex-wrap items-center gap-1 border border-b-0 border-border bg-surface-raised px-2 py-1">
      <div className="flex min-w-48 flex-1 items-center gap-1">
        <input ref={queryRef} type="search" aria-label={messages.findPlaceholder} placeholder={messages.findPlaceholder} value={query} className={input}
          onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); textareaRef.current?.focus(); }
          }} />
        <span className="shrink-0 tabular-nums text-[11px] text-text-secondary" aria-live="polite">
          {query ? (hits.length ? messages.findCount(at + 1, hits.length) : messages.findNone) : ''}
        </span>
        <button type="button" className={cn(btn, matchCase && 'bg-primary-subtle text-primary')} aria-pressed={matchCase} aria-label={messages.matchCase} title={messages.matchCase}
          onClick={() => setMatchCase((v) => !v)}>Aa</button>
        <button type="button" className={btn} aria-label={messages.findPrev} title={messages.findPrev} disabled={!hits.length} onClick={() => step(-1)}>
          <FontAwesomeIcon icon={faChevronUp} className="h-3 w-3" aria-hidden="true" />
        </button>
        <button type="button" className={btn} aria-label={messages.findNext} title={messages.findNext} disabled={!hits.length} onClick={() => step(1)}>
          <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3" aria-hidden="true" />
        </button>
        <button type="button" className={btn} aria-label={messages.findClose} title={messages.findClose} onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      {!readonly && onChange && (
        <div className="flex min-w-48 flex-1 items-center gap-1">
          <input type="text" aria-label={messages.replacePlaceholder} placeholder={messages.replacePlaceholder} value={replacement} className={input}
            onChange={(e) => setReplacement(e.target.value)} />
          <button type="button" className={btn} disabled={!hits.length} onClick={replaceOne}>{messages.replaceOne}</button>
          <button type="button" className={btn} disabled={!hits.length} onClick={() => onChange(replaceAllText(value, query, replacement, matchCase).value)}>{messages.replaceAll}</button>
        </div>
      )}
    </div>
  );
}
