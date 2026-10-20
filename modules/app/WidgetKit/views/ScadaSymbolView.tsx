'use client';
import type { CSSProperties } from 'react';
import { formatValue } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { scadaModel, type ScadaSettings as S } from './scada-logic';
import { SvgTree } from './SvgTree';
import { useReducedMotion } from './useReducedMotion';

export * from './scada-logic';

/**
 * `scada.symbol`: one process symbol drawn from the bound readings. The drawing is the model's SVG tree; the number
 * (for symbols that print one) and the label sit under it. A viewer who asks for reduced motion sees running parts
 * still.
 */
export function ScadaSymbolView({ settings, format, data, locale }: WidgetViewProps) {
  const m = useKitMessages().scada;
  const reduced = useReducedMotion();
  const fmt = (n: number) => formatValue(n, format, {}, locale);
  const g = scadaModel(settings as S, data, { animate: !reduced, format: fmt });
  const value = g.hasValue && g.showValue && g.value !== null ? fmt(g.value) : null;
  const limit: CSSProperties | undefined = g.maxSize ? { maxWidth: g.maxSize, maxHeight: g.maxSize } : undefined;
  const spoken = [g.label ? `${g.name} ${g.label}` : g.name, g.unknown ? '' : m[g.state], value ?? ''].filter(Boolean).join(', ');
  return (
    <figure className="m-0 flex h-full min-h-0 w-full flex-col items-center justify-center gap-1" role="img" aria-label={spoken} data-state={g.state} data-symbol={g.symbol}>
      <svg viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet" className="min-h-0 w-full flex-1" style={limit} aria-hidden="true" focusable="false">
        <SvgTree nodes={g.nodes} />
      </svg>
      {value && <span className="text-sm font-semibold leading-none tabular-nums text-text-primary" data-part="value">{value}</span>}
      {g.showLabel && <span className="max-w-full truncate text-xs leading-tight text-text-secondary" data-part="label">{g.label}</span>}
    </figure>
  );
}

export const SCADA_SYMBOL_VIEW: WidgetKindView = {
  View: ScadaSymbolView,
  // Drawn from no data: the symbol in its idle look, faded under the no-data text.
  isEmpty: (data) => !Object.values(data).some((d) => d && d.value !== undefined && d.value !== null),
  emptyShape: true,
};
