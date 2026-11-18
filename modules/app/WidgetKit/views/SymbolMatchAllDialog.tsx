'use client';
// "Match everything" (next-boilerplate phase 45 slice 16, U3): the proposals for every parameter of every symbol of a drawing at once, in the kit's
// DataTable with a checkbox per row (the certain ones ticked by default), and ONE Apply. The kit proposes nothing itself: the host builds the rows
// (`matchAllRows` of `symbol-binding-logic.ts`) from the devices' values and writes what was ticked as one revision of the binding. Words only: a
// symbol, what it shows, what it would read, how certain; never a key, a slot or a role.
import { useMemo, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Modal } from '@/modules/ui/Modal';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableMessages, DataTableRowId } from '@/modules/ui/Table/types';
import { useNow } from '../useNow';
import { ageText, formatValue, type MatchEmptyReason, type MatchRow } from './symbol-binding-logic';
import { DEFAULT_SYMBOL_BINDING_MESSAGES, mergeMessages, type DeepPartial, type SymbolBindingMessages } from './symbol-binding-messages';

export interface SymbolMatchAllDialogProps {
  open: boolean;
  rows: readonly MatchRow[];
  /** Writes the ticked proposals (their row ids). */
  onApply: (ids: string[]) => void | Promise<void>;
  onClose: () => void;
  /** The host is writing: Apply waits, and the dialog cannot be closed. */
  busy?: boolean;
  /** The host is still reading the devices' values: the dialog says so instead of "nothing to propose", Apply waits, Cancel still closes. */
  loading?: boolean;
  /**
   * Why there are no rows (`matchEmptyReason`): every symbol is connected, the devices sent no values, there is no device, or no proposal is sure. The
   * dialog says that instead of one sentence for all of them (next-boilerplate e2e round 5, E4).
   */
  emptyReason?: MatchEmptyReason;
  /** How many of the drawing's symbols are connected: said with an `unsure` empty reason (run 3 note 146). */
  connected?: { connected: number; total: number };
  /** The time the ages are counted from (ms); default the clock. */
  now?: number;
  /** The workspace's language: the values' numbers follow it (`formatValue`). */
  locale?: string;
  messages?: DeepPartial<SymbolBindingMessages>;
  /**
   * The table's own words in the host's language: its search, "N selected", "Clear selection", the empty and paging lines (next-boilerplate phase 52.6.1,
   * UI test 3: "Search…" and "2 selected" stayed English in a Turkish workspace), as `SceneSetupDrawer`'s `tableMessages`. The dialog's own words win.
   */
  tableMessages?: Partial<DataTableMessages>;
  portalTarget?: Element | string | null;
}

export function SymbolMatchAllDialog(props: SymbolMatchAllDialogProps) {
  // one selection per opening: the certain rows ticked
  return props.open ? <MatchForm key="open" {...props} /> : null;
}

function MatchForm({ rows, onApply, onClose, busy = false, loading = false, emptyReason, connected, messages, tableMessages, portalTarget, locale, ...rest }: SymbolMatchAllDialogProps) {
  const all = useMemo(() => mergeMessages<SymbolBindingMessages>(DEFAULT_SYMBOL_BINDING_MESSAGES, messages), [messages]);
  const m = all.matchAll;
  const age = all.age;
  const words = useMemo(() => ({ on: all.stateOn, off: all.stateOff }), [all]);
  const tick = useNow(5000);
  const now = rest.now ?? tick;
  const confident = useMemo(() => rows.filter((r) => r.confident && !r.mismatch).map((r) => r.id), [rows]);
  // the ticked rows: the certain ones until the person touches the selection (the host hands the rows over after its reads, so they follow the rows until then)
  const [touched, setTouched] = useState<DataTableRowId[] | null>(null);
  const chosen = touched ?? confident;
  const setChosen = (ids: DataTableRowId[]) => setTouched(ids);
  // the names wrap instead of being cut (next-boilerplate phase 52.2.5, test 3 #31: "Greenho…", "Soil moistu…" at 1280 px), in a dialog wide enough for four
  // columns; a row that reads "Check the kind" says why, in the panel's own sentence (D587, test 3 #80)
  const columns = useMemo<Column<MatchRow>[]>(() => [
    {
      key: 'symbol', header: m.symbol, sortable: true, tdClass: 'min-w-[9rem]',
      render: (r) => (
        <span className="block min-w-0 break-words">
          <span className="block text-sm text-text-primary">{r.symbolLabel}</span>
          <span className="block text-xs text-text-secondary">{r.kindLabel}</span>
        </span>
      ),
    },
    { key: 'fieldLabel', header: m.parameter, sortable: true, tdClass: 'whitespace-nowrap' },
    {
      key: 'key', header: m.proposed, sortable: true, tdClass: 'min-w-[12rem]',
      render: (r) => (
        <span className="block min-w-0 break-words">
          <span className="block text-sm text-text-primary">{r.keyLabel}</span>
          {/* the device first: it is what tells two alike candidates apart (run 3 note 105) */}
          <span className="block text-xs text-text-secondary" title={r.deviceName}>{`${r.deviceName} · ${formatValue(r.value, r.unit, words, locale)} · ${ageText(r.ts, now, age)}`}</span>
        </span>
      ),
    },
    {
      key: 'confident', header: m.confidence, sortable: true, searchable: false, tdClass: 'min-w-[8rem] max-w-[14rem]',
      render: (r) => (r.mismatch
        ? (
          <span className="block min-w-0">
            <Badge size="sm" variant="warning">{m.mismatch}</Badge>
            <span className="mt-0.5 block whitespace-normal break-words text-xs text-warning-fg" data-testid="match-mismatch-reason">{all.mismatch[r.mismatch]}</span>
          </span>
        )
        : r.confident ? <Badge size="sm" variant="success">{m.sure}</Badge> : <Badge size="sm" variant="neutral">{m.maybe}</Badge>),
    },
  ], [m, all, age, now, words, locale]);

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={m.title}
      description={loading && rows.length === 0 ? m.loading : rows.length === 0 ? (emptyReason === 'unsure' && connected && connected.connected > 0 ? m.unsureCount(connected.connected, connected.total) : emptyReason ? m.emptyBecause[emptyReason] : m.empty) : m.intro(rows.length, confident.length)}
      size="full"
      className="max-w-5xl"
      {...(portalTarget ? { portalTarget } : {})}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>{m.cancel}</Button>
          {/* nothing to propose: no "Apply 0 proposals" (next-boilerplate e2e round 5, S01-J3-12); the text above says why */}
          {(rows.length > 0 || loading || busy) && (
            <Button variant="primary" size="sm" loading={busy} disabled={busy || loading || chosen.length === 0} onClick={() => void onApply(chosen.map(String))}>{m.apply(chosen.length)}</Button>
          )}
        </div>
      )}
    >
      {rows.length > 0 && (
        <DataTable<MatchRow>
          key={rows.map((r) => r.id).join('|')}
          id="symbol-match-all"
          mode="static"
          density="compact"
          caption={m.tableLabel}
          columns={columns}
          rows={rows as MatchRow[]}
          rowId={(r) => r.id}
          selectable
          defaultSelectedRowIds={confident}
          onSelectionChange={setChosen}
          searchable={rows.length > 8}
          searchText={(r) => `${r.symbolLabel} ${r.kindLabel} ${r.fieldLabel} ${r.keyLabel} ${r.key}`}
          stickyHeader
          defaultSort={[]}
          multiSort={false}
          scrollClassName="max-h-[60vh] overflow-y-auto"
          tableClassName="text-xs"
          messages={{ ...tableMessages, tableLabel: m.tableLabel, selectAllRows: m.selectAll, selectRow: m.selectRow }}
        />
      )}
    </Modal>
  );
}
