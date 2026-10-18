'use client';
import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear, faPlus, faTrash, faCopy, faArrowLeft, faArrowRight, faArrowUp, faArrowDown,
  faDownload, faUpload, faPen, faCheck, faSliders,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Drawer } from '@/modules/ui/Drawer';
import { PlacementCard } from './PlacementCard';
import { WidgetSettingsEditor } from './WidgetSettingsEditor';
import { CORE_BOARD } from './settings/core';
import { effective, readSettings } from './settings/engine';
import { cssColor } from './settings/style';
import { resolvePlacement } from './settings/resolve';
import {
  GRID_COLUMNS, exportBoard, importBoard, nextFreeRow, type BoardDocument, type BoardPlacement, type ImportRefusal,
} from './settings/board';
import type { BuiltinKindSpec, ControlRequest, SlotData, WidgetKindView } from './kind';
import type { Sparse } from './settings/types';
import { SettingIcon, useKitMessages, useWidgetKit } from './WidgetKitContext';
import { localizeKind } from './localize';
import { cardCellResponsive } from './board-cell';
import type { WidgetBoardMessages } from './messages';

export interface WidgetBoardProps {
  doc: BoardDocument;
  /** Absent = view only (no edit mode). */
  onChange?: (doc: BoardDocument) => void;
  /** Bound results by placement id, then slot key. */
  data?: Record<string, Record<string, SlotData | undefined>>;
  kinds: readonly BuiltinKindSpec[];
  views: Readonly<Record<string, WidgetKindView>>;
  onControl?: (placementId: string, request: ControlRequest) => Promise<unknown>;
  /** Host editor for a placement's data binding, shown on the Data tab. */
  renderDataEditor?: (placement: BoardPlacement, update: (p: BoardPlacement) => void) => ReactNode;
  /** Shown when a placement cannot be controlled (e.g. a demo board). */
  controlDisabledReason?: (placement: BoardPlacement) => string | undefined;
  now?: number;
  className?: string;
}

const iconBtn = cn(
  'inline-flex h-7 w-7 items-center justify-center rounded-md bg-surface-base/90 text-text-secondary shadow-sm',
  'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
  'disabled:opacity-40 disabled:cursor-not-allowed',
);
const toolBtn = cn(
  'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-primary',
  'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
);
const BG_SIZE: Record<string, string> = { cover: 'cover', contain: 'contain', fill: '100% 100%', auto: 'auto' };

const safeUrl = (u: unknown) => (typeof u === 'string' && /^(https?:\/\/|\/(?!\/))/i.test(u) && !/["'()\\\s]/.test(u) ? u : undefined);
const newId = (placements: BoardPlacement[]) => {
  let n = placements.length + 1;
  while (placements.some((p) => p.id === `w${n}`)) n += 1;
  return `w${n}`;
};

/**
 * A whole dashboard: a 12-column grid of `PlacementCard`s laid out by each placement's geometry,
 * styled by the board's own settings (`core:board`). With `onChange` it has an edit mode: add,
 * duplicate, remove, move and resize cards, ThingsBoard-depth card and board settings, and JSON
 * export/import of the whole board with every card (owner decision D-21.4). Its texts come from the
 * host's `messages.board`; the widget picker's type texts from its `kindText`.
 */
export function WidgetBoard({
  doc, onChange, data = {}, kinds, views, onControl, renderDataEditor, controlDisabledReason, now, className,
}: WidgetBoardProps) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { kindText } = useWidgetKit();
  const m = useKitMessages().board;
  // The types as shown (picker, drawer title, a new card's title); the originals stay the data.
  const shownKinds = useMemo(() => (kindText ? kinds.map((k) => localizeKind(k, kindText)) : kinds), [kinds, kindText]);

  const board = useMemo(() => effective(CORE_BOARD, readSettings(doc.board.settings, { type: CORE_BOARD }).parts['core:board']), [doc.board.settings]);
  const kindOf = (type: string) => kinds.find((k) => k.type === type);
  const update = (placements: BoardPlacement[]) => onChange?.({ ...doc, placements });
  const patch = (id: string, p: Partial<BoardPlacement>) => update(doc.placements.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const ordered = [...doc.placements].sort((a, b) => a.y - b.y || a.x - b.x);
  const rowH = typeof board.rowHeight === 'number' ? board.rowHeight : 40;
  const gap = typeof board.gap === 'number' ? board.gap : 8;
  const bgImage = safeUrl(board.backgroundImage);
  const surface: CSSProperties = {
    backgroundColor: cssColor(board.backgroundColor) ?? 'var(--canvas-bg, var(--surface-sunken))',
    ...(bgImage ? { backgroundImage: `url("${bgImage}")`, backgroundSize: BG_SIZE[String(board.backgroundSize)] ?? 'cover', backgroundPosition: 'center' } : {}),
    padding: board.outerMargin ? gap : 0,
  };
  const gridStyle = {
    '--wk-row': `${rowH}px`,
    gap,
    ...(board.autoFillHeight ? { minHeight: '100%' } : {}),
  } as CSSProperties;

  const toolbar = new Set((board.toolbar as string[] | undefined) ?? []);
  const sel = doc.placements.find((p) => p.id === selected) ?? null;
  const selKind = sel ? kindOf(sel.type) : undefined;
  const selLabel = sel ? shownKinds.find((k) => k.type === sel.type)?.label : undefined;

  const download = () => {
    const out = exportBoard(doc, kinds);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.board.title.replace(/[^\w.-]+/g, '-') || 'dashboard'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const upload = async (file: File) => {
    const res = importBoard(await file.text(), kinds, { defaultTitle: m.defaultTitle });
    if ('error' in res) { setImportError(importRefusalText(res, m)); return; }
    setImportError(res.unknownTypes.length ? m.skippedTypes(res.unknownTypes.join(', ')) : null);
    if (window.confirm(m.replaceConfirm(res.doc.board.title, res.doc.placements.length))) onChange?.(res.doc);
  };

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {board.showTitle !== false ? (
          <h2 className="text-lg font-semibold text-text-primary" style={{ color: cssColor(board.titleColor) }}>{doc.board.title}</h2>
        ) : <span />}
        <div className="flex flex-wrap items-center gap-2">
          {toolbar.has('export') && (
            <button type="button" onClick={download} className={toolBtn}>
              <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" aria-hidden="true" /> {m.export}
            </button>
          )}
          {onChange && editing && (
            <>
              <button type="button" onClick={() => fileRef.current?.click()} className={toolBtn}>
                <FontAwesomeIcon icon={faUpload} className="h-3.5 w-3.5" aria-hidden="true" /> {m.import}
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label={m.importFile}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
              <button type="button" onClick={() => setBoardOpen(true)} className={toolBtn}>
                <FontAwesomeIcon icon={faSliders} className="h-3.5 w-3.5" aria-hidden="true" /> {m.settings}
              </button>
              <button type="button" onClick={() => setPicking(true)} className={toolBtn}>
                <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" aria-hidden="true" /> {m.addWidget}
              </button>
            </>
          )}
          {onChange && (
            <button type="button" onClick={() => { setEditing((e) => !e); setSelected(null); }} aria-pressed={editing}
              className={cn(toolBtn, editing && 'border-primary bg-primary text-primary-fg hover:bg-primary-hover')}>
              <FontAwesomeIcon icon={editing ? faCheck : faPen} className="h-3.5 w-3.5" aria-hidden="true" /> {editing ? m.done : m.edit}
            </button>
          )}
        </div>
      </div>
      {importError && <p role="alert" className="text-sm text-error">{importError}</p>}

      <div className="min-h-0 flex-1 rounded-xl" style={surface}>
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:[grid-auto-rows:var(--wk-row)]" style={gridStyle}>
          {ordered.map((p) => {
            const kind = kindOf(p.type);
            const view = views[p.type];
            if (!kind || !view) return null;
            const r = resolvePlacement({ template: kind.template, slotCount: kind.slots.length, settings: p.settings, board });
            // The cell is the grid item: its place applies from lg up only (below, cards stack in y, x
            // order), and the card's small-screen settings (hide, order) act on the cell, not just the card.
            // While editing nothing is hidden: a hidden cell would take its edit buttons with it, and
            // with them the only way back to the setting.
            const cell = cardCellResponsive(editing ? { ...r.card, hideOnMobile: false, hideOnDesktop: false } : r.card);
            return (
              <div key={p.id} data-placement={p.id}
                className={cn(
                  'relative min-h-0 lg:[grid-column:var(--wk-gc)] lg:[grid-row:var(--wk-gr)]',
                  editing && 'outline-dashed outline-1 outline-border-strong rounded-xl',
                  r.card.mobileHeight === undefined && 'max-lg:min-h-[var(--wk-mh,10rem)]',
                  cell.className,
                )}
                style={{
                  ['--wk-gc' as string]: `${p.x + 1} / span ${p.w}`,
                  ['--wk-gr' as string]: `${p.y + 1} / span ${p.h}`,
                  ['--wk-mh' as string]: `${p.h * rowH}px`,
                  ...cell.style,
                }}>
                <PlacementCard
                  title={p.title}
                  template={kind.template}
                  slots={kind.slots}
                  view={view}
                  settings={p.settings}
                  board={board}
                  data={data[p.id] ?? {}}
                  isEditor={editing}
                  fixedHeight
                  now={now}
                  onControl={onControl ? (req) => onControl(p.id, req) : undefined}
                  controlDisabledReason={controlDisabledReason?.(p)}
                />
                {editing && (
                  <div className="absolute right-2 top-2 z-10 flex flex-wrap justify-end gap-1">
                    <button type="button" className={iconBtn} aria-label={m.settingsOf(p.title)} onClick={() => setSelected(p.id)}>
                      <FontAwesomeIcon icon={faGear} className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" className={iconBtn} aria-label={m.moveLeft} disabled={p.x === 0} onClick={() => patch(p.id, { x: p.x - 1 })}>
                      <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button type="button" className={iconBtn} aria-label={m.moveRight} disabled={p.x + p.w >= GRID_COLUMNS} onClick={() => patch(p.id, { x: p.x + 1 })}>
                      <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button type="button" className={iconBtn} aria-label={m.moveUp} disabled={p.y === 0} onClick={() => patch(p.id, { y: p.y - 1 })}>
                      <FontAwesomeIcon icon={faArrowUp} className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button type="button" className={iconBtn} aria-label={m.moveDown} onClick={() => patch(p.id, { y: p.y + 1 })}>
                      <FontAwesomeIcon icon={faArrowDown} className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button type="button" className={iconBtn} aria-label={m.duplicate}
                      onClick={() => update([...doc.placements, { ...p, id: newId(doc.placements), y: nextFreeRow(doc.placements) }])}>
                      <FontAwesomeIcon icon={faCopy} className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button type="button" className={cn(iconBtn, 'hover:text-error')} aria-label={m.remove(p.title)}
                      onClick={() => update(doc.placements.filter((x) => x.id !== p.id))}>
                      <FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {ordered.length === 0 && (
          <div className="flex min-h-48 items-center justify-center text-sm text-text-secondary">
            {onChange ? m.emptyEditable : m.empty}
          </div>
        )}
      </div>

      {sel && selKind && (
        <Drawer open onClose={() => setSelected(null)} title={m.placementSettings(sel.title || selLabel || selKind.label)}>
          <PlacementSettings placement={sel} kind={selKind} board={board} messages={m} onChange={(p) => patch(sel.id, p)}
            dataEditor={renderDataEditor?.(sel, (p) => patch(sel.id, p))} />
        </Drawer>
      )}

      {boardOpen && (
        <Drawer open onClose={() => setBoardOpen(false)} title={m.settings}>
          <div className="space-y-3 p-1">
            <div>
              <label htmlFor="wk-board-title" className="mb-1.5 block text-xs font-medium text-text-secondary">{m.boardTitle}</label>
              <input id="wk-board-title" type="text" value={doc.board.title} maxLength={120}
                onChange={(e) => onChange?.({ ...doc, board: { ...doc.board, title: e.target.value } })}
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" />
            </div>
            <WidgetSettingsEditor templates={[CORE_BOARD]} settings={doc.board.settings}
              caps={{ hasData: false, exportable: false, formatsNumbers: false }}
              onChange={(settings) => onChange?.({ ...doc, board: { ...doc.board, settings } })} />
          </div>
        </Drawer>
      )}

      {picking && (
        <Drawer open onClose={() => setPicking(false)} title={m.addWidget}>
          <WidgetPicker kinds={shownKinds} messages={m} onPick={(k) => {
            const id = newId(doc.placements);
            update([...doc.placements, { id, type: k.type, title: k.label, x: 0, y: nextFreeRow(doc.placements), w: k.defaultW, h: k.defaultH, settings: {} }]);
            setPicking(false);
            setSelected(id);
          }} />
        </Drawer>
      )}
    </div>
  );
}

/** A refused import in the host's words (`importBoard`'s `code`); its English `error` otherwise. */
function importRefusalText(res: ImportRefusal, m: WidgetBoardMessages): string {
  switch (res.code) {
    case 'invalid-json': return m.invalidJson;
    case 'not-board': return m.notBoard;
    case 'newer-format': return m.newerFormat(res.detail ?? '');
    case 'newer-templates': return m.newerTemplates(res.detail ?? '');
    // A code this host does not know yet (a newer kit): the English text.
    default: return (res as ImportRefusal).error;
  }
}

function PlacementSettings({ placement, kind, board, messages: m, onChange, dataEditor }: {
  placement: BoardPlacement; kind: BuiltinKindSpec; board: Sparse; messages: WidgetBoardMessages;
  onChange: (p: Partial<BoardPlacement>) => void; dataEditor?: ReactNode;
}) {
  const r = resolvePlacement({ template: kind.template, slotCount: kind.slots.length, settings: placement.settings, board });
  const num = (label: string, key: 'x' | 'y' | 'w' | 'h', min: number, max: number) => (
    <label className="flex flex-col gap-1 text-xs text-text-secondary">
      {label}
      <input type="number" min={min} max={max} value={placement[key]}
        onChange={(e) => {
          const v = Math.min(max, Math.max(min, Math.round(Number(e.target.value) || 0)));
          onChange(key === 'w' ? { w: v, x: Math.min(placement.x, GRID_COLUMNS - v) } : { [key]: v });
        }}
        className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" />
    </label>
  );
  return (
    <WidgetSettingsEditor
      templates={r.templates}
      settings={placement.settings}
      layers={r.layers}
      caps={r.caps}
      title={placement.title}
      onTitleChange={(title) => onChange({ title })}
      onChange={(settings) => onChange({ settings })}
      extraTabs={{
        ...(dataEditor ? { Data: dataEditor } : {}),
        Card: (
          <fieldset className="rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">{m.positionSize}</legend>
            <div className="grid grid-cols-4 gap-2">
              {num(m.column, 'x', 0, GRID_COLUMNS - placement.w)}
              {num(m.row, 'y', 0, 10000)}
              {num(m.width, 'w', 1, GRID_COLUMNS)}
              {num(m.height, 'h', 1, 48)}
            </div>
          </fieldset>
        ),
      }}
    />
  );
}

function WidgetPicker({ kinds, messages: m, onPick }: {
  kinds: readonly BuiltinKindSpec[]; messages: WidgetBoardMessages; onPick: (k: BuiltinKindSpec) => void;
}) {
  const [q, setQ] = useState('');
  const groups = new Map<string, BuiltinKindSpec[]>();
  for (const k of kinds) {
    if (q && !`${k.label} ${k.description} ${k.category}`.toLowerCase().includes(q.toLowerCase())) continue;
    groups.set(k.category, [...(groups.get(k.category) ?? []), k]);
  }
  return (
    <div className="space-y-4 p-1">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.searchWidgetsPlaceholder} aria-label={m.searchWidgets}
        className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" />
      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">{cat}</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map((k) => (
              <li key={k.type}>
                <button type="button" onClick={() => onPick(k)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:border-primary hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                  <SettingIcon name={k.icon} className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary">{k.label}</span>
                    <span className="block text-xs text-text-secondary">{k.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
