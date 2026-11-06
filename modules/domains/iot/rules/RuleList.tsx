'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsis, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { Toggle } from '@/modules/ui/Toggle';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DropdownMenu } from '@/modules/ui/DropdownMenu';
import { EmptyState } from '@/modules/ui/EmptyState';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessagesInput } from '../messages';
import type { RuleItem, RuleScope } from '../types/rules';
import { RuleStatusChip } from './RuleStatusChip';
import { when } from './rule-format';
import { firstEquipmentAction, stepWords } from './rule-draft';

/**
 * RuleList — the rules of a place, one DataTable row each (the one-table rule), sortable by name: the name, its on/off switch, what it is doing (the status chip), when it last ran and
 * what it did in words, and the next time a schedule starts it. The row menu runs it now, edits, duplicates, opens its history or
 * deletes it (through the one ConfirmDialog). A rule that needs attention shows its reason under the name. The viewer's rights decide
 * which controls exist: without `canManage` the switch is read-only and there is no edit, duplicate or delete; without `canRun` no
 * Run now. Run now asks first (the ConfirmDialog, naming the rule and its first such step) when the rule moves equipment: a command, a
 * setting or another rule (next-boilerplate D580); a rule that only notifies people or raises alarms runs at once. Nothing here shows an
 * id or a key.
 */
export type RuleListProps = {
  rules: readonly RuleItem[];
  now: number;
  canManage: boolean;
  canRun: boolean;
  loading?: boolean;
  /** Rows that are mid-request (a switch pending, a run starting), by rule id. */
  pending?: ReadonlySet<string>;
  onAdd?: () => void;
  onToggle: (rule: RuleItem, enabled: boolean) => void;
  onRun: (rule: RuleItem) => void;
  onEdit: (rule: RuleItem) => void;
  onDuplicate: (rule: RuleItem) => void;
  /** Absent: the row has no History (the host keeps no run history for the rule yet). */
  onHistory?: (rule: RuleItem) => void;
  onDelete: (rule: RuleItem) => Promise<void>;
  /** The place's devices and their commands, to name the step Run now asks about ("Dolum-kapama: Hat kumandası · Off"); without it the step reads by its kind. */
  scope?: Pick<RuleScope, 'devices' | 'deviceTypes'> | null;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function RuleList({
  rules, now, canManage, canRun, loading = false, pending, onAdd, onToggle, onRun, onEdit, onDuplicate, onHistory, onDelete, scope, locale, messages, className,
}: RuleListProps) {
  const { m } = useIotText(messages);
  const [deleting, setDeleting] = useState<RuleItem | null>(null);
  const [running, setRunning] = useState<{ rule: RuleItem; step: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!rules.length && !loading) {
    return (
      <EmptyState
        title={m.rules.empty}
        description={m.rules.emptyHint}
        action={canManage && onAdd ? <Button size="sm" onClick={onAdd}><FontAwesomeIcon icon={faPlus} className="mr-2" />{m.rules.add}</Button> : undefined}
        className={className}
      />
    );
  }

  // a rule that moves equipment asks first, naming its first such step; one that only notifies or raises alarms runs at once (D580)
  const runNow = (r: RuleItem) => {
    const step = firstEquipmentAction(r.definition);
    if (step) setRunning({ rule: r, step: stepWords(step, scope, rules, m.rules) });
    else onRun(r);
  };
  const menu = (r: RuleItem) => [
    ...(canRun ? [{ id: 'run', label: m.rules.runNow, onClick: () => runNow(r), disabled: !r.enabled || r.status !== 'ok' }] : []),
    ...(canManage ? [{ label: m.rules.edit, onClick: () => onEdit(r) }, { label: m.rules.duplicate, onClick: () => onDuplicate(r) }] : []),
    ...(onHistory ? [{ id: 'history', label: m.rules.history, onClick: () => onHistory(r) }] : []),
    ...(canManage ? [{ label: m.rules.delete, onClick: () => { setError(undefined); setDeleting(r); }, danger: true }] : []),
  ];

  const columns: Column<RuleItem>[] = [
    {
      key: 'enabled',
      header: <span className="sr-only">{m.rules.on}</span>,
      render: (r) => (
        <Toggle
          id={`rule-on-${r.ruleId}`} label="" ariaLabel={fill(m.rules.switchLabel, { name: r.name })} size="sm"
          checked={r.enabled} disabled={!canManage || r.status === 'needs_attention' && !r.enabled} pending={pending?.has(r.ruleId) ?? false}
          onChange={(v) => onToggle(r, v)}
        />
      ),
    },
    {
      key: 'name',
      header: m.rules.title,
      sortable: true,
      render: (r) => (
        <div className="min-w-0" data-rule={r.name}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => (canManage ? onEdit(r) : onHistory?.(r))} className="truncate text-sm font-medium text-text-primary hover:underline">{r.name}</button>
            <RuleStatusChip rule={r} now={now} messages={messages} />
          </div>
          {r.status === 'needs_attention' && r.statusReason ? <p className="mt-1 text-xs text-error-fg">{r.statusReason}</p> : null}
          <p className="mt-0.5 text-xs text-text-secondary">
            {r.lastRun ? fill(m.rules.lastRun, { when: when(r.lastRun.at, now, locale), text: r.lastRun.text }) : m.rules.neverRan}
            {r.nextAt && r.nextAt > now ? ` · ${fill(m.rules.nextRun, { when: when(r.nextAt, now, locale) })}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{fill(m.rules.moreActions, { name: m.rules.title })}</span>,
      align: 'right',
      render: (r) => (
        <DropdownMenu
          trigger={<Button variant="ghost" size="sm" aria-label={fill(m.rules.moreActions, { name: r.name })}><FontAwesomeIcon icon={faEllipsis} /></Button>}
          items={menu(r)}
          align="right" portal
        />
      ),
    },
  ];

  return (
    <div className={cn('flex flex-col', className)}>
      <DataTable<RuleItem>
        mode="paginated"
        variant="plain"
        caption={m.rules.title}
        columns={columns}
        rows={[...rules]}
        rowId={(r) => r.ruleId}
        rowClassName={(r) => (r.stoppedByManual === true ? 'opacity-60' : undefined)}
        loading={loading}
        messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
        pageSizeOptions={[]}
        keyboardNavigation
      />

      <ConfirmDialog
        open={running !== null}
        title={fill(m.rules.runAskTitle, { name: running?.rule.name ?? '' })}
        message={fill(m.rules.runAskBody, { step: running?.step ?? '' })}
        tone="warning"
        confirmLabel={m.rules.runNow}
        cancelLabel={m.rules.cancel}
        onCancel={() => setRunning(null)}
        onConfirm={() => {
          const r = running?.rule;
          setRunning(null);
          if (r) onRun(r);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={fill(m.rules.deleteTitle, { name: deleting?.name ?? '' })}
        message={m.rules.deleteBody}
        tone="danger"
        confirmLabel={m.rules.deleteConfirm}
        cancelLabel={m.rules.cancel}
        busy={busy}
        error={error}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          setBusy(true);
          onDelete(deleting).then(() => { setDeleting(null); setBusy(false); }, (e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setBusy(false); });
        }}
      />
    </div>
  );
}
