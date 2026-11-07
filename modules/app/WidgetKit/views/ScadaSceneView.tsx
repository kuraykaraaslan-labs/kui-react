'use client';
import { useEffect, useMemo, useRef } from 'react';
import { formatValue } from '../settings/style';
import type { ElementGesture, WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { sceneModel, type SceneSettings as S } from './scada-scene-logic';
import { parseScenePatch } from './scene-patch';
import { SvgTree } from './SvgTree';
import { useReducedMotion } from './useReducedMotion';

export * from './scada-scene-logic';

/** A click waits this long for a second click when the symbol also answers a double click. */
export const DOUBLE_CLICK_MS = 250;

/**
 * `scada.scene`: a process diagram on a canvas. Symbols are placed by coordinates and joined by pipes, hoses, cables,
 * wires and strip lines that route themselves between ports; one bound table (a row per id) feeds every symbol and link.
 * The diagram scales to the card and keeps its proportions. A symbol the host gives an action to answers a click, a
 * double click, a right click and the keyboard (Enter or Space, the context-menu key); the others stay plain pictures.
 * Things from the `things` table are placed by their rows and answer gestures like symbols (the host knows them by id).
 * A compute script's `scenePatch` is parsed here (its own caps) and applied after the authored settings and the rules.
 */
export function ScadaSceneView({ settings, format, data, locale, title, elementActions, params, scenePatch }: WidgetViewProps) {
  const kit = useKitMessages();
  const m = kit.scada;
  const reduced = useReducedMotion();
  const parsed = useMemo(() => parseScenePatch(scenePatch), [scenePatch]);
  // a rule label's `{condition}` words an on / off reading as the state card does (next-boilerplate phase 52.6.1)
  const onOff = useMemo(() => ({ on: kit.stat.on, off: kit.stat.off }), [kit.stat.on, kit.stat.off]);
  const g = sceneModel(settings as S, data, { animate: !reduced, params, patch: parsed.patch, format: (n, own) => formatValue(n, format, own ?? {}, locale), onOff });
  // What the patch itself lists and what its parser dropped: counted on the diagram and read out with it.
  const problemLines = [...g.patchProblems, ...parsed.problems];
  const problemCount = g.problems + parsed.problems.length;
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);

  // A locked-out symbol (mode `lockout`) is still named and focusable, but nothing runs from it.
  const lockedIds = new Set(g.hits.filter((h) => h.locked).map((h) => h.id));
  const act = (gesture: ElementGesture, id: string) => { if (!lockedIds.has(id)) elementActions?.run(gesture, id); };
  // A symbol with both a click and a double click runs the click only after the second click did not come.
  const click = (id: string) => {
    if (pending.current) clearTimeout(pending.current);
    if (elementActions?.has('doubleClick', id)) pending.current = setTimeout(() => { pending.current = null; act('click', id); }, DOUBLE_CLICK_MS);
    else act('click', id);
  };
  const doubleClick = (id: string) => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    act('doubleClick', id);
  };
  const live = elementActions ? g.hits.filter((h) => (['click', 'doubleClick', 'contextMenu'] as const).some((k) => elementActions.has(k, h.id))) : [];

  return (
    <svg viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet" className="h-full min-h-0 w-full" role="img" aria-label={title || m.scene} data-problems={problemCount || undefined}>
      {problemLines.length > 0 && <desc data-part="scene-problems">{problemLines.join('. ')}</desc>}
      <SvgTree nodes={g.nodes} />
      {live.map((h) => (
        <rect
          key={h.id}
          x={h.x} y={h.y} width={h.w} height={h.h}
          role="button" tabIndex={0} aria-label={h.name} data-element={h.id} data-from={h.from}
          aria-disabled={h.locked || undefined} data-locked={h.locked || undefined}
          fill="transparent"
          className={h.locked ? 'cursor-not-allowed outline-none focus-visible:stroke-border-focus' : 'cursor-pointer outline-none hover:fill-primary/10 focus-visible:stroke-border-focus'}
          strokeWidth={2}
          onClick={elementActions!.has('click', h.id) || elementActions!.has('doubleClick', h.id) ? () => click(h.id) : undefined}
          onDoubleClick={elementActions!.has('doubleClick', h.id) ? () => doubleClick(h.id) : undefined}
          onContextMenu={elementActions!.has('contextMenu', h.id) ? (e) => { e.preventDefault(); act('contextMenu', h.id); } : undefined}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && elementActions!.has('click', h.id)) { e.preventDefault(); act('click', h.id); }
            else if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && elementActions!.has('contextMenu', h.id)) { e.preventDefault(); act('contextMenu', h.id); }
          }}
        />
      ))}
    </svg>
  );
}

export const SCADA_SCENE_VIEW: WidgetKindView = {
  View: ScadaSceneView,
  // Without rows the diagram still draws every symbol idle; only a scene with no symbols and no things is empty.
  isEmpty: (data, settings) => (!Array.isArray((settings as S).elements) || ((settings as S).elements as unknown[]).length === 0)
    && !(data.things?.rows?.length),
  emptyShape: false,
  zoomable: true,
};
