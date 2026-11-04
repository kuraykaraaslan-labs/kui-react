'use client';
import { cn } from '@/libs/utils/cn';
import { ModelProviderBadge } from '../model/ModelProviderBadge';
import { FeatureCheckCell, type FeatureCheckValue } from './FeatureCheckCell';
import { ModelScoreSparkline } from './ModelScoreSparkline';
import type { AIModel } from '../types';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';

export type ModelComparisonRow = {
  model: AIModel;
  benchmarkScores: number[];
  features: Record<string, FeatureCheckValue>;
  /** Headline benchmark score (0-100). */
  headlineScore?: number;
};

export type ModelComparisonTableProps = {
  rows: ModelComparisonRow[];
  /** Ordered feature keys to display as columns. */
  featureKeys: { key: string; label: string }[];
  className?: string;
};

type Row = ModelComparisonRow & Record<string, unknown>;

/**
 * ModelComparisonTable — models side by side (context, price, benchmark trend, a column per feature): the kit's DataTable with this
 * column preset, searchable (name, id, provider), sortable, filterable by provider, a page at a time.
 */
export function ModelComparisonTable({ rows, featureKeys, className }: ModelComparisonTableProps) {
  const providers = [...new Set(rows.map((r) => String(r.model.provider)))].sort();
  const columns: Column<Row>[] = [
    {
      key: 'model', header: 'Model', sortable: true, sortValue: (r) => r.model.name,
      searchValue: (r) => `${r.model.name} ${r.model.modelId} ${r.model.provider}`,
      render: ({ model }) => (
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{model.name}</p>
            <p className="font-mono text-[10px] font-normal text-text-secondary truncate">{model.modelId}</p>
          </div>
          <ModelProviderBadge provider={model.provider} size="sm" />
        </div>
      ),
    },
    {
      key: 'context', header: 'Context', sortable: true, searchable: false, sortValue: (r) => r.model.contextWindow ?? null,
      render: ({ model }) => <span className="whitespace-nowrap text-text-primary">{model.contextWindow ? `${(model.contextWindow / 1000).toFixed(0)}k` : '—'}</span>,
    },
    {
      key: 'price', header: 'Price · in / out', sortable: true, searchable: false, sortValue: (r) => r.model.pricingPromptPer1k ?? null,
      render: ({ model }) => (
        <span className="whitespace-nowrap text-text-primary">
          {model.pricingPromptPer1k != null ? `$${model.pricingPromptPer1k.toFixed(4)}` : '—'}
          <span className="text-text-secondary"> / </span>
          {model.pricingCompletionPer1k != null ? `$${model.pricingCompletionPer1k.toFixed(4)}` : '—'}
        </span>
      ),
    },
    {
      key: 'benchmark', header: 'Benchmark trend', sortable: true, searchable: false, sortValue: (r) => r.headlineScore ?? null,
      render: ({ benchmarkScores, headlineScore }) => (
        <div className="flex items-center gap-3">
          <ModelScoreSparkline scores={benchmarkScores} width={80} height={28} />
          {headlineScore != null && <span className="font-mono text-xs font-semibold text-text-primary">{headlineScore.toFixed(1)}</span>}
        </div>
      ),
    },
    ...featureKeys.map((f): Column<Row> => ({
      key: `feature:${f.key}`, header: f.label, align: 'center', sortable: true, searchable: false,
      sortValue: (r) => String(r.features[f.key] ?? 'no'),
      render: (r) => <FeatureCheckCell value={r.features[f.key] ?? 'no'} />,
    })),
  ];
  const filterFields: DataTableFilterField<Row>[] = providers.length > 1
    ? [{ id: 'provider', label: 'Provider', type: 'checkboxes', options: providers.map((p) => ({ value: p, label: p })), match: (r, v) => !Array.isArray(v) || !v.length || (v as string[]).includes(String(r.model.provider)) }]
    : [];
  return (
    <DataTable<Row>
      mode="paginated"
      className={cn('overflow-x-auto', className)}
      caption="Model comparison"
      columns={columns}
      rows={rows as Row[]}
      rowId={(r) => r.model.modelId}
      filterFields={filterFields}
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
