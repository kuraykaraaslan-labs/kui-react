// The board document: a dashboard with every card on it, as one portable JSON (D-21.4).
// Pure; used for export/import in kui-react's IoT theme. next-boilerplate's board package v2
// carries the same parts (board settings + every placement's stamped settings) plus data bindings.

import { CORE_BOARD, CORE_CARD, CORE_FORMAT } from './core';
import { prepareForSave, readStamp } from './engine';
import type { Issue, SettingsStamp, SettingsTemplate, Sparse } from './types';
import type { BuiltinKindSpec } from '../kind';

export const BOARD_DOCUMENT_FORMAT = 'widgetkit.board';
export const BOARD_DOCUMENT_VERSION = 1;
export const GRID_COLUMNS = 12;

export interface BoardPlacement {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings: Sparse;
  /** Host-specific data binding (opaque to WidgetKit; carried as is). */
  binding?: unknown;
}

export interface BoardDocument {
  format: typeof BOARD_DOCUMENT_FORMAT;
  version: number;
  /** The newest version of each template used inside (lets an importer refuse what it cannot read). */
  templates: SettingsStamp;
  board: { title: string; description?: string; settings: Sparse };
  placements: BoardPlacement[];
}

const isObj = (v: unknown): v is Sparse => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown, min: number, max: number, dflt: number) =>
  Number.isInteger(v) ? Math.min(max, Math.max(min, v as number)) : dflt;

/** Validate, migrate and stamp every part; the result is ready to download. */
export function exportBoard(doc: BoardDocument, kinds: readonly BuiltinKindSpec[]): BoardDocument {
  const res = normalizeBoard(doc, kinds);
  return res.doc;
}

export interface ImportResult {
  doc: BoardDocument;
  issues: Issue[];
  /** Templates in the file that are newer than this code: the import must stop. */
  newer: Array<{ id: string; stored: number; known: number }>;
  /** Placement types this host does not know: dropped. */
  unknownTypes: string[];
}

/** Why `importBoard` refused a file: `error` is the English text, `code` + `detail` let a host word it. */
export interface ImportRefusal {
  error: string;
  code: 'invalid-json' | 'not-board' | 'newer-format' | 'newer-templates';
  /** `newer-format`: the file's format version; `newer-templates`: the newer templates, joined ("core:card v9"). */
  detail?: string;
}

function normalizeBoard(input: unknown, kinds: readonly BuiltinKindSpec[], defaultTitle = 'Dashboard'): ImportResult {
  const issues: Issue[] = [];
  const newer: ImportResult['newer'] = [];
  const unknownTypes: string[] = [];
  const src = isObj(input) ? input : {};
  const boardSrc = isObj(src.board) ? src.board : {};
  const stamp: SettingsStamp = {};
  const note = (t: SettingsTemplate) => { stamp[t.id] = t.version; };

  const boardSave = prepareForSave(isObj(boardSrc.settings) ? boardSrc.settings : {}, { type: CORE_BOARD });
  newer.push(...boardSave.newer);
  issues.push(...boardSave.issues.map((i) => ({ path: `board.settings.${i.path}`, message: i.message })));
  note(CORE_BOARD);

  const placements: BoardPlacement[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(src.placements) ? src.placements : [];
  list.slice(0, 200).forEach((raw, i) => {
    if (!isObj(raw)) return;
    const kind = kinds.find((k) => k.type === raw.type);
    if (!kind) { unknownTypes.push(String(raw.type)); return; }
    const set = { type: kind.template, card: CORE_CARD, format: kind.template.format ? CORE_FORMAT : undefined };
    const saved = prepareForSave(isObj(raw.settings) ? raw.settings : {}, set);
    newer.push(...saved.newer);
    issues.push(...saved.issues.map((x) => ({ path: `placements.${i}.${x.path}`, message: x.message })));
    note(kind.template); note(CORE_CARD); if (set.format) note(CORE_FORMAT);
    let id = typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : `w${i + 1}`;
    while (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    const w = int(raw.w, 1, GRID_COLUMNS, kind.defaultW);
    placements.push({
      id,
      type: kind.type,
      title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : kind.label,
      x: int(raw.x, 0, GRID_COLUMNS - w, 0),
      y: int(raw.y, 0, 10000, 0),
      w,
      h: int(raw.h, 1, 48, kind.defaultH),
      settings: saved.newer.length ? (raw.settings as Sparse) : saved.settings,
      ...(raw.binding !== undefined ? { binding: raw.binding } : {}),
    });
  });

  const fileStamp = readStamp({ $v: src.templates });
  for (const [id, v] of Object.entries(fileStamp)) {
    const known = id === CORE_BOARD.id ? CORE_BOARD.version : id === CORE_CARD.id ? CORE_CARD.version : id === CORE_FORMAT.id ? CORE_FORMAT.version
      : kinds.find((k) => k.template.id === id)?.template.version;
    if (known !== undefined && (v as number) > known && !newer.some((n) => n.id === id)) newer.push({ id, stored: v as number, known });
  }

  return {
    doc: {
      format: BOARD_DOCUMENT_FORMAT,
      version: BOARD_DOCUMENT_VERSION,
      templates: stamp,
      board: {
        title: typeof boardSrc.title === 'string' && boardSrc.title.trim() ? boardSrc.title.slice(0, 120) : defaultTitle,
        ...(typeof boardSrc.description === 'string' ? { description: boardSrc.description.slice(0, 1000) } : {}),
        settings: boardSave.newer.length ? (boardSrc.settings as Sparse) : boardSave.settings,
      },
      placements,
    },
    issues,
    newer,
    unknownTypes,
  };
}

/**
 * Read an uploaded board file. A newer document format is refused with a clear message (`error`, in
 * English) and a `code` the host can word itself. `options.defaultTitle` names a board without a title.
 */
export function importBoard(
  json: string,
  kinds: readonly BuiltinKindSpec[],
  options: { defaultTitle?: string } = {},
): ImportResult | ImportRefusal {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return { error: 'This file is not valid JSON.', code: 'invalid-json' }; }
  if (!isObj(parsed) || parsed.format !== BOARD_DOCUMENT_FORMAT) return { error: 'This file is not a dashboard export.', code: 'not-board' };
  if (typeof parsed.version !== 'number' || parsed.version > BOARD_DOCUMENT_VERSION) {
    const detail = String(parsed.version);
    return { error: `This dashboard was exported by a newer version (format ${detail}). Update this app to import it.`, code: 'newer-format', detail };
  }
  const res = normalizeBoard(parsed, kinds, options.defaultTitle?.trim() || undefined);
  if (res.newer.length) {
    const detail = res.newer.map((n) => `${n.id} v${n.stored}`).join(', ');
    return { error: `This dashboard uses newer widget settings (${detail}). Update this app to import it.`, code: 'newer-templates', detail };
  }
  return res;
}

/** The first free row below every placement (where a new card goes). */
export function nextFreeRow(placements: BoardPlacement[]): number {
  return placements.reduce((m, p) => Math.max(m, p.y + p.h), 0);
}
