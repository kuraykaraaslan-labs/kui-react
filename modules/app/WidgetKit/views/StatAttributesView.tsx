'use client';
import type { CSSProperties, ReactNode } from 'react';
import { SettingIcon, useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { attributesModel, attributeRows, type AttributesRowView, type AttributesSettings as S } from './attributes-logic';
import { Metric, Row } from './ui';

export * from './attributes-logic';

/** `stat.attributes`: a record as label / value rows (the kit's `Row`), or as a grid of small metrics. */
export function StatAttributesView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings as S;
  const yesNo = useKitMessages().common;
  const m = attributesModel(s, format, data, locale, yesNo);
  const { layout, labelStyle } = m;
  const labelOf = (r: AttributesRowView): ReactNode => r.iconName ? (
    <span className="inline-flex min-w-0 items-center gap-2">
      <SettingIcon name={r.iconName} className="shrink-0 text-text-secondary" style={{ width: 14, height: 14, fontSize: 14 }} />
      <span className="truncate">{r.label}</span>
    </span>
  ) : r.label;

  if (layout === 'list') {
    return (
      <div className="flex flex-col" data-layout="list" style={m.listStyle as CSSProperties | undefined}>
        {m.rows.map((r, i) => (
          <Row
            key={`${r.key}-${i}`}
            label={labelOf(r)}
            value={r.value}
            divider={m.dividers}
            className={r.rowExtra}
            labelStyle={labelStyle as CSSProperties}
            valueStyle={r.valueStyle as CSSProperties}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={m.gridClass} data-layout={layout}>
      {m.rows.map((r, i) => (
        <div key={`${r.key}-${i}`} className={r.cellClass} style={r.cellStyle as CSSProperties | undefined} data-part="row">
          <span className="block truncate text-xs font-medium text-text-secondary" style={labelStyle as CSSProperties}>{labelOf(r)}</span>
          <span style={r.color ? { color: r.color } : undefined}>
            {r.number !== undefined ? (
              <Metric text={r.number} unit={r.unit} unitPosition={r.unitPosition} size="md" font={s.valueFont} color={m.metricColor(r)} />
            ) : (
              <span className="block truncate text-[15px] font-semibold leading-tight text-text-primary" style={r.textValueStyle as CSSProperties}>{r.value}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export const STAT_ATTRIBUTES_VIEW: WidgetKindView = {
  View: StatAttributesView,
  isEmpty: (data) => {
    const rec = data.record?.record;
    return !rec || Object.keys(rec).length === 0;
  },
  toCsv: (data, settings, format) => [
    ['key', 'value'],
    ...attributeRows(data.record?.record, settings, format).map((r) => [r.key, r.value]),
  ],
  emptyShape: true,
};
