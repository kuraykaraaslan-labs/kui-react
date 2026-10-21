'use client';
// The toolbar of the process diagram editor: undo and redo, the tools, zoom, grid and guides, the actions on a selection
// (align, distribute, order, duplicate, delete, copy, paste), the library of saved pieces, layers (session-only lock and
// hide) and the count of problems. It holds no diagram state; the shell passes what to show and what each button does.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAnglesDown, faAnglesUp, faArrowDown, faArrowPointer, faArrowsLeftRight, faArrowsUpDown, faArrowUp, faBookmark, faCopy, faClone, faDiagramProject, faExpand,
  faEye, faEyeSlash, faFolderOpen, faFont, faHand, faLayerGroup, faLink, faLock, faLockOpen, faMagnifyingGlassMinus, faMagnifyingGlassPlus, faMinus, faObjectGroup,
  faPaste, faRotateLeft, faRotateRight, faRulerCombined, faTableCells, faTrash, faTriangleExclamation, faXmark, faAlignLeft, faAlignCenter, faAlignRight, faBars,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import type { AlignMode, DistributeAxis, ReorderMode } from './scene-edit-logic';
import { SCENE_LINK_KINDS } from './scene-edit-logic';
import { fill, type SceneEditorMessages } from './scene-editor-messages-canvas';
import type { SavedAssembly, Tool } from './scene-editor-state';

export interface LayerItem { id: string; label: string; locked: boolean; hidden: boolean }

export interface SceneEditorToolbarProps {
  m: SceneEditorMessages;
  tool: Tool;
  onTool: (tool: Tool) => void;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  zoomPercent: number; onZoomIn: () => void; onZoomOut: () => void; onFit: () => void;
  grid: boolean; guides: boolean; onGrid: () => void; onGuides: () => void;
  linkKind: string; onLinkKind: (kind: string) => void;
  /** How many things are selected, and how many of them are symbols. */
  selected: number; selectedElements: number;
  onDuplicate: () => void; onDelete: () => void; onCopy: () => void; onPaste: () => void; onConnectSelected: () => void;
  onAlign: (mode: AlignMode) => void; onDistribute: (axis: DistributeAxis) => void; onOrder: (mode: ReorderMode) => void;
  library: readonly SavedAssembly[];
  onSaveAssembly: (name: string) => void; onInsertAssembly: (item: SavedAssembly) => void; onRemoveAssembly: (name: string) => void;
  layers: readonly LayerItem[];
  onToggleLock: (id: string) => void; onToggleHide: (id: string) => void; onUnlockAll: () => void; onShowAll: () => void;
  problems: number; onProblems: () => void;
}

const TOOLS: Array<{ tool: Tool; icon: IconDefinition; label: keyof SceneEditorMessages; key: string }> = [
  { tool: 'select', icon: faArrowPointer, label: 'toolSelect', key: 'V' },
  { tool: 'connect', icon: faDiagramProject, label: 'toolConnect', key: 'C' },
  { tool: 'pan', icon: faHand, label: 'toolPan', key: 'H' },
  { tool: 'text', icon: faFont, label: 'toolText', key: 'T' },
  { tool: 'zone', icon: faObjectGroup, label: 'toolZone', key: 'Z' },
  { tool: 'divider', icon: faMinus, label: 'toolDivider', key: 'D' },
];

const TOOL_ID = 'scene-tool';

function IconButton({ icon, label, onClick, disabled, selected, testId, hint }: { icon: IconDefinition; label: string; onClick: () => void; disabled?: boolean; selected?: boolean; testId?: string; hint?: string }) {
  return (
    <Button variant="ghost" size="sm" iconOnly selected={selected} disabled={disabled} onClick={onClick} aria-label={label} title={hint ? `${label} (${hint})` : label} data-testid={testId}>
      <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
    </Button>
  );
}

/** A button that opens a small list in the page (not a portal); Escape or a click elsewhere closes it. */
function Menu({ label, icon, disabled, children, testId, wide }: { label: string; icon: IconDefinition; disabled?: boolean; children: (close: () => void) => ReactNode; testId?: string; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const down = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); root.current?.querySelector('button')?.focus(); } }}
    >
      <Button variant="ghost" size="sm" iconOnly disabled={disabled} aria-label={label} title={label} aria-haspopup="true" aria-expanded={open} aria-controls={open ? id : undefined} data-testid={testId} onClick={() => setOpen((v) => !v)} selected={open}>
        <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
      </Button>
      {open && (
        <div id={id} role="group" aria-label={label} className={cn('absolute left-0 top-full z-30 mt-1 rounded-md border border-border bg-surface-raised p-1 shadow-lg', wide ? 'w-72' : 'min-w-52')}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, disabled }: { icon?: IconDefinition; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-text-primary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50">
      {icon && <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" className="text-text-secondary" />}
      <span>{label}</span>
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />;

export function SceneEditorToolbar(p: SceneEditorToolbarProps) {
  const { m } = p;
  const some = p.selected > 0;
  const many = p.selectedElements >= 2;
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('');
  const nameId = useId();
  const filterId = useId();
  const layers = filter ? p.layers.filter((l) => l.label.toLowerCase().includes(filter.toLowerCase())) : p.layers;

  return (
    <div role="toolbar" aria-label={m.toolbar} aria-orientation="horizontal" data-testid="scene-toolbar" className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-raised px-2 py-1.5">
      <IconButton icon={faRotateLeft} label={m.undo} hint="Ctrl+Z" onClick={p.onUndo} disabled={!p.canUndo} testId="undo" />
      <IconButton icon={faRotateRight} label={m.redo} hint="Ctrl+Shift+Z" onClick={p.onRedo} disabled={!p.canRedo} testId="redo" />
      <Divider />
      <div role="group" aria-label={m.tools} className="flex items-center gap-0.5">
        {TOOLS.map((t) => (
          <IconButton key={t.tool} icon={t.icon} label={m[t.label]} hint={t.key} selected={p.tool === t.tool} onClick={() => p.onTool(t.tool)} testId={`${TOOL_ID}-${t.tool}`} />
        ))}
      </div>
      <label className="flex items-center gap-1 text-xs text-text-secondary">
        <span className="sr-only">{m.linkKind}</span>
        <FontAwesomeIcon icon={faLink} aria-hidden="true" />
        <select aria-label={m.linkKind} value={p.linkKind} onChange={(e) => p.onLinkKind(e.target.value)} data-testid="link-kind" className="h-8 rounded-md border border-border bg-surface-base px-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          {SCENE_LINK_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <IconButton icon={faLink} label={m.connectSelected} hint="K" onClick={p.onConnectSelected} disabled={p.selectedElements !== 2} testId="connect-selected" />
      <Divider />
      <IconButton icon={faMagnifyingGlassMinus} label={m.zoomOut} hint="-" onClick={p.onZoomOut} testId="zoom-out" />
      <button type="button" onClick={p.onFit} aria-label={m.zoomFit} title={`${m.zoomFit} (0)`} data-testid="zoom-level" className="h-8 min-w-12 rounded-md px-1 text-xs tabular-nums text-text-secondary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
        {fill(m.zoomLevel, { percent: p.zoomPercent })}
      </button>
      <IconButton icon={faMagnifyingGlassPlus} label={m.zoomIn} hint="+" onClick={p.onZoomIn} testId="zoom-in" />
      <IconButton icon={faExpand} label={m.zoomFit} hint="0" onClick={p.onFit} testId="zoom-fit" />
      <IconButton icon={faTableCells} label={m.grid} selected={p.grid} onClick={p.onGrid} testId="toggle-grid" />
      <IconButton icon={faRulerCombined} label={m.guides} selected={p.guides} onClick={p.onGuides} testId="toggle-guides" />
      <Divider />
      <IconButton icon={faClone} label={m.duplicate} hint="Ctrl+D" onClick={p.onDuplicate} disabled={!some} testId="duplicate" />
      <IconButton icon={faCopy} label={m.copy} hint="Ctrl+C" onClick={p.onCopy} disabled={!some} testId="copy" />
      <IconButton icon={faPaste} label={m.paste} hint="Ctrl+V" onClick={p.onPaste} testId="paste" />
      <IconButton icon={faTrash} label={m.delete} hint="Delete" onClick={p.onDelete} disabled={!some} testId="delete" />
      <Menu label={m.align} icon={faAlignLeft} disabled={!many} testId="menu-align">
        {(close) => (
          <>
            <MenuItem icon={faAlignLeft} label={m.alignLeft} onClick={() => { p.onAlign('left'); close(); }} />
            <MenuItem icon={faAlignCenter} label={m.alignCenter} onClick={() => { p.onAlign('center'); close(); }} />
            <MenuItem icon={faAlignRight} label={m.alignRight} onClick={() => { p.onAlign('right'); close(); }} />
            <MenuItem icon={faArrowUp} label={m.alignTop} onClick={() => { p.onAlign('top'); close(); }} />
            <MenuItem icon={faBars} label={m.alignMiddle} onClick={() => { p.onAlign('middle'); close(); }} />
            <MenuItem icon={faArrowDown} label={m.alignBottom} onClick={() => { p.onAlign('bottom'); close(); }} />
          </>
        )}
      </Menu>
      <Menu label={m.distribute} icon={faArrowsLeftRight} disabled={p.selectedElements < 3} testId="menu-distribute">
        {(close) => (
          <>
            <MenuItem icon={faArrowsLeftRight} label={m.distributeH} onClick={() => { p.onDistribute('horizontal'); close(); }} />
            <MenuItem icon={faArrowsUpDown} label={m.distributeV} onClick={() => { p.onDistribute('vertical'); close(); }} />
          </>
        )}
      </Menu>
      <Menu label={m.order} icon={faAnglesUp} disabled={!some} testId="menu-order">
        {(close) => (
          <>
            <MenuItem icon={faAnglesUp} label={m.toFront} onClick={() => { p.onOrder('front'); close(); }} />
            <MenuItem icon={faArrowUp} label={m.forward} onClick={() => { p.onOrder('forward'); close(); }} />
            <MenuItem icon={faArrowDown} label={m.backward} onClick={() => { p.onOrder('backward'); close(); }} />
            <MenuItem icon={faAnglesDown} label={m.toBack} onClick={() => { p.onOrder('back'); close(); }} />
          </>
        )}
      </Menu>
      <Divider />
      <Menu label={m.saveAssembly} icon={faBookmark} disabled={!some} testId="menu-save" wide>
        {(close) => (
          <form
            className="flex items-end gap-2 p-1"
            onSubmit={(e) => { e.preventDefault(); p.onSaveAssembly(name.trim() || fill(m.assemblyDefault, { n: p.library.length + 1 })); setName(''); close(); }}
          >
            <label htmlFor={nameId} className="flex-1 text-xs font-medium text-text-secondary">
              {m.assemblyName}
              <input id={nameId} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={fill(m.assemblyDefault, { n: p.library.length + 1 })} className="mt-1 h-8 w-full rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" />
            </label>
            <Button type="submit" size="sm" variant="primary" data-testid="save-assembly">{m.save}</Button>
          </form>
        )}
      </Menu>
      <Menu label={m.insertAssembly} icon={faFolderOpen} testId="menu-insert" wide>
        {(close) => (p.library.length === 0 ? <p className="px-2 py-1.5 text-sm text-text-secondary">{m.libraryEmpty}</p> : (
          <ul className="max-h-64 overflow-auto">
            {p.library.map((item) => (
              <li key={item.name} className="flex items-center gap-1">
                <button type="button" onClick={() => { p.onInsertAssembly(item); close(); }} className="flex-1 truncate rounded px-2 py-1.5 text-left text-sm text-text-primary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{item.name}</button>
                <button type="button" aria-label={fill(m.libraryRemove, { name: item.name })} onClick={() => p.onRemoveAssembly(item.name)} className="rounded p-1.5 text-text-secondary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ))}
      </Menu>
      <Menu label={m.layers} icon={faLayerGroup} testId="menu-layers" wide>
        {() => (
          <div className="p-1">
            <label htmlFor={filterId} className="sr-only">{m.layersFilter}</label>
            <input id={filterId} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={m.layersFilter} className="mb-1 h-8 w-full rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" />
            <ul className="max-h-64 overflow-auto">
              {layers.map((l) => (
                <li key={l.id} className="flex items-center gap-1 text-sm text-text-primary">
                  <span className={cn('flex-1 truncate px-2', l.hidden && 'text-text-disabled line-through')}>{l.label}</span>
                  <button type="button" aria-pressed={l.locked} aria-label={`${l.locked ? m.unlock : m.lock} ${l.label}`} onClick={() => p.onToggleLock(l.id)} className="rounded p-1.5 hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                    <FontAwesomeIcon icon={l.locked ? faLock : faLockOpen} aria-hidden="true" className={l.locked ? 'text-primary' : 'text-text-secondary'} />
                  </button>
                  <button type="button" aria-pressed={l.hidden} aria-label={`${l.hidden ? m.show : m.hide} ${l.label}`} onClick={() => p.onToggleHide(l.id)} className="rounded p-1.5 hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                    <FontAwesomeIcon icon={l.hidden ? faEyeSlash : faEye} aria-hidden="true" className={l.hidden ? 'text-primary' : 'text-text-secondary'} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex gap-1 border-t border-border pt-1">
              <MenuItem label={m.unlockAll} onClick={p.onUnlockAll} disabled={!p.layers.some((l) => l.locked)} />
              <MenuItem label={m.showAll} onClick={p.onShowAll} disabled={!p.layers.some((l) => l.hidden)} />
            </div>
          </div>
        )}
      </Menu>
      <button
        type="button"
        onClick={p.onProblems}
        data-testid="problems-count"
        className={cn('ml-auto flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', p.problems ? 'text-warning' : 'text-text-secondary')}
      >
        <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
        {p.problems ? fill(m.problemsCount, { count: p.problems }) : m.noProblems}
      </button>
    </div>
  );
}
