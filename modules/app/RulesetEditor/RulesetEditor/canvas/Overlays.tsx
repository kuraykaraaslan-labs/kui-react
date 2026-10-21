'use client';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { GraphIssue, ValidationResult } from '../../graph/validate';
import { useMessages } from '../messages';

/** Counts of the problems in the graph; opens the list. Clicking a problem selects its node. */
export function IssuesPanel({ result, nodeLabel, onSelect }: {
  result: ValidationResult;
  nodeLabel: (nodeId: string) => string;
  onSelect: (nodeId: string) => void;
}) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const issues: GraphIssue[] = [...result.errors, ...result.warnings];
  if (!issues.length) return null;
  return (
    <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" aria-expanded={open} aria-label={m.issuesSummary(result.errors.length, result.warnings.length)} onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-base px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
        {result.errors.length > 0 && <span className="inline-flex items-center gap-1 text-error"><FontAwesomeIcon icon={faCircleExclamation} className="h-3 w-3" aria-hidden="true" />{result.errors.length}</span>}
        {result.warnings.length > 0 && <span className="inline-flex items-center gap-1 text-warning"><FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3" aria-hidden="true" />{result.warnings.length}</span>}
      </button>
      {open && (
        <ul aria-label={m.issuesList} className="max-h-64 w-72 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-base p-1.5 shadow-lg">
          {issues.map((issue, i) => (
            <li key={`${issue.code}-${issue.nodeId ?? ''}-${i}`}>
              <button type="button" disabled={!issue.nodeId} onClick={() => issue.nodeId && onSelect(issue.nodeId)}
                className={cn('flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-default')}>
                <FontAwesomeIcon icon={issue.severity === 'error' ? faCircleExclamation : faTriangleExclamation} className={cn('mt-0.5 h-3 w-3 shrink-0', issue.severity === 'error' ? 'text-error' : 'text-warning')} aria-hidden="true" />
                <span className="min-w-0">
                  {issue.nodeId && <span className="block truncate font-semibold text-text-primary">{nodeLabel(issue.nodeId)}</span>}
                  <span className="block text-text-secondary">{issue.message}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
