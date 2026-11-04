'use client';
import { Badge } from '@/modules/ui/Badge';
import { Tooltip } from '@/modules/ui/Tooltip';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import type { Parameter } from './types';

const locationVariant: Record<string, 'primary' | 'info' | 'warning' | 'neutral'> = {
  path:   'primary',
  query:  'info',
  header: 'warning',
  cookie: 'neutral',
};

const LOCATIONS = ['path', 'query', 'header', 'cookie'] as const;

type Props = {
  parameters: Parameter[];
  className?: string;
};

type ParamRow = Parameter & { type: string; requiredFlag: 'required' | 'optional' };

const typeOf = (p: Parameter): string => p.schema?.type ?? (p.schema?.$ref ? '$ref' : '—');

/**
 * ParameterTable — an operation's parameters (name, where it goes, type, required, description with its example and allowed
 * values): the kit's DataTable with this column preset, searchable, sortable, filterable by location and required, a page at a time.
 */
export function ParameterTable({ parameters, className }: Props) {
  if (!parameters.length) return null;
  const rows: ParamRow[] = parameters.map((p) => ({ ...p, type: typeOf(p), requiredFlag: p.required ? 'required' : 'optional' }));

  const columns: Column<ParamRow>[] = [
    {
      key: 'name', header: 'Name', sortable: true, width: '25%',
      render: (param) => (
        <div className="flex items-center gap-1.5">
          <code className="font-mono text-xs font-semibold text-text-primary">{param.name}</code>
          {param.deprecated && <Badge variant="warning" size="sm">deprecated</Badge>}
        </div>
      ),
    },
    {
      key: 'in', header: 'In', sortable: true, width: '5rem',
      render: (param) => <Badge variant={locationVariant[param.in] ?? 'neutral'} size="sm">{param.in}</Badge>,
    },
    {
      key: 'type', header: 'Type', sortable: true, width: '6rem',
      render: (param) => (
        <code className="font-mono text-xs text-text-secondary">
          {param.type}
          {param.schema?.format && <span className="text-text-disabled"> ({param.schema.format})</span>}
        </code>
      ),
    },
    {
      key: 'requiredFlag', header: 'Required', sortable: true, searchable: false, width: '5rem',
      render: (param) => (param.required
        ? <Badge variant="error" size="sm">required</Badge>
        : <span className="text-xs text-text-disabled">optional</span>),
    },
    {
      key: 'description', header: 'Description',
      searchValue: (param) => `${param.description ?? ''} ${(param.schema?.enum ?? []).map(String).join(' ')}`,
      render: (param) => (
        <div className="text-xs text-text-secondary">
          <div className="flex items-start gap-1.5">
            <span className="line-clamp-2">{param.description ?? '—'}</span>
            {param.schema?.example !== undefined && (
              <Tooltip content={<span className="font-mono text-xs">e.g. {String(param.schema.example)}</span>} placement="top">
                <FontAwesomeIcon icon={faCircleInfo} className="w-3.5 h-3.5 text-text-disabled shrink-0 mt-0.5 cursor-help" aria-label="Example value" />
              </Tooltip>
            )}
          </div>
          {param.schema?.enum && (
            <div className="flex flex-wrap gap-1 mt-1">
              {param.schema.enum.map((v, i) => (
                <code key={i} className="rounded bg-surface-sunken px-1 py-0 text-[10px] font-mono text-text-secondary">{String(v)}</code>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];
  const filterFields: DataTableFilterField<ParamRow>[] = [
    { id: 'in', label: 'In', type: 'checkboxes', options: LOCATIONS.map((l) => ({ value: l, label: l })) },
    { id: 'requiredFlag', label: 'Required', type: 'select', options: [{ value: 'required', label: 'required' }, { value: 'optional', label: 'optional' }] },
  ];

  return (
    <DataTable<ParamRow>
      mode="paginated"
      className={className}
      caption="Parameters"
      columns={columns}
      rows={rows}
      rowId={(p) => p.parameterId}
      filterFields={filterFields}
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      density="compact"
    />
  );
}
