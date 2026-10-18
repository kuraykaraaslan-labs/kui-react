'use client';
// modules/ui/Evidence/index.tsx
//
// CitationChip, EvidenceList and CitedText — for AI answers where every claim has to cite a row the user can
// open. A chip `[1]` is a link to the evidence row (same-page anchor by default, so it works without
// JavaScript), the list shows each item with a kind icon and a way to open it, and claims that were dropped
// because they cited nothing openable are listed apart, with a text indicator (never colour alone).

import { Fragment, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell, faBan, faBook, faChartLine, faCircleExclamation, faCircleInfo, faDiagramProject, faFileLines, faMagnifyingGlass,
  faRocket, faSliders, faTriangleExclamation, faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { cn } from '@/libs/utils/cn';
import { fillMessage } from '../_shared/format';

export type EvidenceKind = 'log' | 'trace' | 'metric' | 'alert' | 'incident' | 'deploy' | 'config' | 'doc' | 'query' | 'other';

export type EvidenceItem = {
  id: string;
  /** The number a chip cites. Default = the item's position + 1. */
  index?: number;
  /** One of the known kinds (gives an icon), or any text (shown as is with the generic icon). */
  kind: EvidenceKind | (string & {});
  title: string;
  summary?: string;
  /** Where the row opens (a link). With `onOpen` as well, the link still works and the handler also runs. */
  href?: string;
  /** Epoch ms or an ISO string. */
  timestamp?: number | string;
  /** The system the row came from (`loki`, `tempo`, `deploys`). */
  source?: string;
};

export type DroppedClaim = {
  id: string;
  /** The claim as the model wrote it. */
  text: string;
  /** Why it was dropped (`no citation`, `cited a row that does not exist`). */
  reason?: string;
};

export type EvidenceMessages = {
  /** `{index}`, `{title}` */
  citation: string;
  /** `{index}` */
  droppedCitation: string;
  heading: string;
  empty: string;
  open: string;
  /** `{title}` */
  openNamed: string;
  droppedHeading: string;
  /** `{count}` */
  droppedSummary: string;
  droppedHint: string;
  reason: string;
  kinds: Record<EvidenceKind, string>;
};

export const DEFAULT_EVIDENCE_MESSAGES: EvidenceMessages = {
  citation: 'Evidence {index}: {title}',
  droppedCitation: 'Citation {index}: no matching evidence, claim dropped',
  heading: 'Evidence',
  empty: 'No evidence was cited.',
  open: 'Open',
  openNamed: 'Open {title}',
  droppedHeading: 'Dropped claims',
  droppedSummary: '{count} claims removed: they cited no evidence you can open.',
  droppedHint: 'These statements are not part of the answer.',
  reason: 'Reason',
  kinds: {
    log: 'Log', trace: 'Trace', metric: 'Metric', alert: 'Alert', incident: 'Incident', deploy: 'Deploy',
    config: 'Config', doc: 'Document', query: 'Query', other: 'Other',
  },
};

const KIND_ICON: Record<EvidenceKind, IconDefinition> = {
  log: faFileLines,
  trace: faDiagramProject,
  metric: faChartLine,
  alert: faBell,
  incident: faCircleExclamation,
  deploy: faRocket,
  config: faSliders,
  doc: faBook,
  query: faMagnifyingGlass,
  other: faCircleInfo,
};

const isKnownKind = (k: string): k is EvidenceKind => k in KIND_ICON;

/** The DOM id of an evidence row, which a chip's default anchor points at. */
export function evidenceDomId(idPrefix: string, evidenceId: string): string {
  return `${idPrefix}-${evidenceId}`;
}

export type CitationChipProps = {
  /** The number shown, `[n]`. */
  index: number;
  /** The evidence row it cites. */
  evidenceId: string;
  /** The evidence title, for the accessible name and the tooltip. */
  title?: string;
  /** `dropped`: the citation points at nothing the user can open. It renders as plain text, not a link. */
  status?: 'cited' | 'dropped';
  /** Link target. Default = the anchor of the matching EvidenceList row. */
  href?: string;
  /** Same prefix as the EvidenceList. Default = `evidence`. */
  idPrefix?: string;
  /** Runs on click, besides following the link. */
  onSelect?: (evidenceId: string) => void;
  messages?: Partial<Pick<EvidenceMessages, 'citation' | 'droppedCitation'>>;
  className?: string;
};

export function CitationChip({
  index, evidenceId, title, status = 'cited', href, idPrefix = 'evidence', onSelect, messages, className,
}: CitationChipProps) {
  const msg = { ...DEFAULT_EVIDENCE_MESSAGES, ...messages };
  const base = 'mx-0.5 inline-flex items-center gap-0.5 rounded px-1 align-baseline text-xs font-semibold leading-5';
  if (status === 'dropped') {
    return (
      <span
        data-citation="dropped"
        aria-label={fillMessage(msg.droppedCitation, { index })}
        className={cn(base, 'border border-dashed border-warning bg-warning-subtle text-warning-fg', className)}
      >
        <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" className="h-2.5 w-2.5" />
        [{index}]
      </span>
    );
  }
  const label = fillMessage(msg.citation, { index, title: title ?? evidenceId });
  return (
    <a
      href={href ?? `#${evidenceDomId(idPrefix, evidenceId)}`}
      data-citation="cited"
      aria-label={label}
      title={title}
      onClick={() => onSelect?.(evidenceId)}
      className={cn(
        base, 'bg-primary-subtle text-primary no-underline transition-colors hover:bg-primary hover:text-primary-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        className,
      )}
    >
      [{index}]
    </a>
  );
}

export type EvidenceListProps = {
  items: EvidenceItem[];
  droppedClaims?: DroppedClaim[];
  /** The row to highlight (a chip was clicked). The `:target` of the page highlights too. */
  activeId?: string | null;
  /** Called when the user opens a row (its link or its Open button). */
  onOpen?: (item: EvidenceItem) => void;
  /** Same prefix as the chips. Default = `evidence`. */
  idPrefix?: string;
  /** Heading level text; `false` hides the heading. */
  heading?: string | false;
  /** Locale for timestamps. */
  locale?: string;
  /** IANA zone for timestamps. */
  timeZone?: string;
  messages?: Partial<EvidenceMessages>;
  className?: string;
};

function timeText(ts: number | string | undefined, locale?: string, timeZone?: string): string | null {
  if (ts === undefined) return null;
  const ms = typeof ts === 'number' ? ts : Date.parse(ts);
  if (Number.isNaN(ms)) return null;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', ...(timeZone ? { timeZone } : {}) }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

export function EvidenceList({
  items, droppedClaims = [], activeId, onOpen, idPrefix = 'evidence', heading, locale, timeZone, messages, className,
}: EvidenceListProps) {
  const msg = useMemo(() => ({ ...DEFAULT_EVIDENCE_MESSAGES, ...messages, kinds: { ...DEFAULT_EVIDENCE_MESSAGES.kinds, ...messages?.kinds } }), [messages]);
  const headingText = heading === undefined ? msg.heading : heading;
  return (
    <section aria-label={headingText === false ? msg.heading : undefined} className={cn('flex flex-col gap-3', className)}>
      {headingText !== false && <h3 className="text-sm font-semibold text-text-primary">{headingText}</h3>}
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">{msg.empty}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item, i) => {
            const n = item.index ?? i + 1;
            const kind = isKnownKind(item.kind) ? item.kind : 'other';
            const kindLabel = isKnownKind(item.kind) ? msg.kinds[item.kind] : item.kind;
            const when = timeText(item.timestamp, locale, timeZone);
            const active = activeId === item.id;
            return (
              <li
                key={item.id}
                id={evidenceDomId(idPrefix, item.id)}
                data-active={active || undefined}
                data-kind={item.kind}
                tabIndex={-1}
                className={cn(
                  'flex gap-3 rounded-md border border-border bg-surface-raised p-3 text-sm',
                  'target:border-primary target:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                  active && 'border-primary bg-primary-subtle',
                )}
              >
                <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-primary-subtle px-1 text-xs font-semibold text-primary">[{n}]</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-text-secondary">
                      <FontAwesomeIcon icon={KIND_ICON[kind]} aria-hidden="true" className="h-3 w-3" />
                      {kindLabel}
                    </span>
                    {item.href ? (
                      <a
                        href={item.href}
                        onClick={() => onOpen?.(item)}
                        className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                      >
                        <span className="truncate">{item.title}</span>
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" className="h-3 w-3 shrink-0 rtl:-scale-x-100" />
                      </a>
                    ) : (
                      <span className="min-w-0 truncate font-medium text-text-primary">{item.title}</span>
                    )}
                  </div>
                  {item.summary && <p className="break-words text-text-secondary">{item.summary}</p>}
                  {(when || item.source) && (
                    <p className="text-xs text-text-disabled">{[item.source, when].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                {!item.href && onOpen && (
                  <button
                    type="button"
                    aria-label={fillMessage(msg.openNamed, { title: item.title })}
                    onClick={() => onOpen(item)}
                    className="h-fit shrink-0 rounded border border-border bg-surface-base px-2 py-1 text-xs transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    {msg.open}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {droppedClaims.length > 0 && (
        <div role="status" data-part="dropped" className="flex flex-col gap-2 rounded-md border border-dashed border-warning bg-warning-subtle p-3 text-sm text-warning-fg">
          <p className="flex items-center gap-2 font-medium">
            <FontAwesomeIcon icon={faBan} aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{msg.droppedHeading}: {fillMessage(msg.droppedSummary, { count: droppedClaims.length })}</span>
          </p>
          <p className="text-xs">{msg.droppedHint}</p>
          <ul className="flex flex-col gap-1.5">
            {droppedClaims.map((c) => (
              <li key={c.id} className="rounded bg-surface-base/60 p-2 text-text-primary">
                <span className="line-through decoration-warning">{c.text}</span>
                {c.reason && <span className="ms-2 text-xs text-text-secondary">({msg.reason}: {c.reason})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export type CitedTextProps = {
  /** Answer text with `[n]` markers. */
  text: string;
  evidence: EvidenceItem[];
  idPrefix?: string;
  onSelect?: (evidenceId: string) => void;
  messages?: Partial<EvidenceMessages>;
  className?: string;
};

/**
 * Answer text with its `[n]` markers turned into chips. A marker whose number matches no evidence row becomes a
 * `dropped` chip: the reader sees that the claim is unsupported instead of a link that goes nowhere.
 */
export function CitedText({ text, evidence, idPrefix = 'evidence', onSelect, messages, className }: CitedTextProps) {
  const byIndex = useMemo(() => {
    const m = new Map<number, EvidenceItem>();
    evidence.forEach((e, i) => m.set(e.index ?? i + 1, e));
    return m;
  }, [evidence]);
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className={cn('text-sm leading-6 text-text-primary', className)}>
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const n = Number(m[1]);
        const ev = byIndex.get(n);
        return ev
          ? <CitationChip key={i} index={n} evidenceId={ev.id} title={ev.title} idPrefix={idPrefix} onSelect={onSelect} messages={messages} />
          : <CitationChip key={i} index={n} evidenceId={String(n)} status="dropped" messages={messages} />;
      })}
    </p>
  );
}
