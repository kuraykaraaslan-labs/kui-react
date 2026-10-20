'use client';
import { formatValue } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { sceneModel, type SceneSettings as S } from './scada-scene-logic';
import { SvgTree } from './SvgTree';
import { useReducedMotion } from './useReducedMotion';

export * from './scada-scene-logic';

/**
 * `scada.scene`: a process diagram on a canvas. Symbols are placed by coordinates and joined by pipes, hoses, cables,
 * wires and strip lines that route themselves between ports; one bound table (a row per id) feeds every symbol and link.
 * The diagram scales to the card and keeps its proportions.
 */
export function ScadaSceneView({ settings, format, data, locale, title }: WidgetViewProps) {
  const m = useKitMessages().scada;
  const reduced = useReducedMotion();
  const g = sceneModel(settings as S, data, { animate: !reduced, format: (n) => formatValue(n, format, {}, locale) });
  return (
    <svg viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet" className="h-full min-h-0 w-full" role="img" aria-label={title || m.scene} data-problems={g.problems || undefined}>
      <SvgTree nodes={g.nodes} />
    </svg>
  );
}

export const SCADA_SCENE_VIEW: WidgetKindView = {
  View: ScadaSceneView,
  // Without rows the diagram still draws every symbol idle; only a scene with no symbols is empty.
  isEmpty: (_data, settings) => !Array.isArray((settings as S).elements) || ((settings as S).elements as unknown[]).length === 0,
  emptyShape: false,
};
