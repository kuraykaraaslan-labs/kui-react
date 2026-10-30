'use client';
// The alias dialog's preview (E36-12, TB's `noEntityMatched` made visible): a complete draft is resolved through
// `access.preview` after a short pause, and the dialog shows the total and the first names. A draft that matches
// nothing blocks the save; a preview that fails does not (the server still validates on save), nor does one that follows a
// parameter with no value where it is previewed (it says which). What a widget of one entity gets is said under the names.

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Spinner } from '@/modules/ui/Spinner';
import { useLatestRef } from './useAliasData';
import type { EntityAliasesMessages } from './messages';
import type { AliasPreview, EntityAlias, EntityAliasesAccess } from './types';

/** `waiting`: the draft follows parameters with no value where it is previewed (`AliasPreview.waitingFor`); never a reason to refuse it. */
export type PreviewStatus = 'idle' | 'loading' | 'ok' | 'empty' | 'waiting' | 'error';

export const PREVIEW_DEBOUNCE_MS = 400;
const SHOWN_NAMES = 5;

/**
 * `draftJson` is the normalised draft alias as JSON ('' when the filter is not complete). The answer is kept per JSON,
 * so a stale answer is never shown for a newer draft, and `checkNow` (the save button) reuses a request in flight.
 */
export function useAliasPreview(access: EntityAliasesAccess, draftJson: string, debounceMs = PREVIEW_DEBOUNCE_MS) {
  const accessRef = useLatestRef(access);
  const [answer, setAnswer] = useState<{ json: string; status: PreviewStatus; result?: AliasPreview }>({ json: '', status: 'idle' });
  const inflight = useRef<{ json: string; promise: Promise<PreviewStatus> } | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  const request = useCallback(
    (json: string): Promise<PreviewStatus> => {
      if (inflight.current?.json === json) return inflight.current.promise;
      const promise = accessRef.current.preview(JSON.parse(json) as EntityAlias).then(
        (result) => {
          const status: PreviewStatus = result.total > 0 ? 'ok' : result.waitingFor?.length ? 'waiting' : 'empty';
          if (live.current) setAnswer({ json, status, result });
          return status;
        },
        () => {
          if (live.current) setAnswer({ json, status: 'error' });
          return 'error' as PreviewStatus;
        },
      );
      inflight.current = { json, promise };
      return promise;
    },
    [accessRef],
  );

  useEffect(() => {
    if (!draftJson) return;
    const t = setTimeout(() => { void request(draftJson); }, debounceMs);
    return () => clearTimeout(t);
  }, [draftJson, debounceMs, request]);

  const current = !draftJson ? null : answer.json === draftJson ? answer : null;
  const status: PreviewStatus = !draftJson ? 'idle' : current ? current.status : 'loading';

  /** The status of `json` now: the known answer, or a request made at once (no debounce). */
  const checkNow = useCallback(
    (json: string): Promise<PreviewStatus> =>
      answer.json === json && answer.status !== 'loading' && answer.status !== 'idle' ? Promise.resolve(answer.status) : request(json),
    [answer, request],
  );

  return { status, result: current?.result, checkNow };
}

export function AliasPreviewPanel({
  status,
  result,
  m,
  className,
}: {
  status: PreviewStatus;
  result?: AliasPreview;
  m: EntityAliasesMessages;
  className?: string;
}) {
  const shown = result?.entities.slice(0, SHOWN_NAMES) ?? [];
  const more = result ? Math.max(0, result.total - shown.length) : 0;
  return (
    <section
      aria-live="polite"
      aria-label={m.previewTitle}
      className={cn('rounded-lg border border-border bg-surface-base p-3 text-sm', status === 'empty' && 'border-error bg-error-subtle', className)}
    >
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">{m.previewTitle}</h3>
      {status === 'idle' && <p className="text-text-secondary">{m.previewIncomplete}</p>}
      {status === 'loading' && (
        <p className="flex items-center gap-2 text-text-secondary">
          <Spinner size="xs" />
          {m.previewLoading}
        </p>
      )}
      {status === 'ok' && result && (
        <div className="space-y-1">
          <p className="font-medium text-text-primary">{m.previewTotal(result.total, !!result.truncated)}</p>
          <p className="text-text-secondary">
            {shown.map((e) => e.name).join(', ')}
            {more > 0 && <> {m.previewMore(more)}</>}
          </p>
          {result.single && (
            <p className="text-text-secondary" data-testid="alias-preview-single">
              {'count' in result.single ? m.previewSingleMany(result.single.count)
                : result.single.first ? m.previewSingleFirst(result.single.name) : m.previewSingle(result.single.name)}
            </p>
          )}
        </div>
      )}
      {status === 'waiting' && <p className="text-text-secondary" data-testid="alias-preview-waiting">{m.previewWaiting((result?.waitingFor ?? []).join(', '))}</p>}
      {status === 'empty' && <p role="alert" className="font-medium text-error">{m.noEntityMatched}</p>}
      {status === 'error' && <p className="text-text-secondary">{m.previewFailed}</p>}
    </section>
  );
}
