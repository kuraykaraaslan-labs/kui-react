'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Drawer } from '@/modules/ui/Drawer';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableQuery } from '@/modules/ui/Table/types';
import { errorMessage, PROFILE_TEMPLATE_SORT_KEYS, type ProfileTemplateQuery } from '../api/adapter';
import { useIotAdapter, useIotText } from '../api/IotAdapterProvider';
import { sameSort, toIotSort, toTableSort } from '../api/list-table';
import { fill, formatDateTime } from '../format';
import { transportLabel, type ProfileTemplate } from '../types/profile';

/**
 * PlatformTemplatesDrawer — the platform's own view of what it publishes (NB iot_device_profile 03 §3.3, "Platform templates"; OPB-19: a
 * header button and a drawer on the profiles page, never a tab or a page of its own). For a viewer with `canPublishTemplates` (NB: the
 * platform workspace with `templates.manage`): the published templates in a DataTable (name, template key, version, transport, last
 * change) on the host's own search, sort and paging (`profiles.templates.list`); a row opens the template's own profile when the host
 * names it (`profileId`, given only to the publishing workspace). Publishing and unpublishing stay on the profile's page.
 */
export type PlatformTemplatesDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Opens a template's own profile (the drawer closes first). */
  onOpen: (profileId: string) => void;
};

type Row = ProfileTemplate & Record<string, unknown>;
const PAGE_SIZE = 20;

export function PlatformTemplatesDrawer({ open, onClose, onOpen }: PlatformTemplatesDrawerProps) {
  const api = useIotAdapter().profiles?.templates;
  const { m, locale, timeZone } = useIotText();
  const [query, setQuery] = useState<ProfileTemplateQuery>({ page: 1, pageSize: PAGE_SIZE, sort: { key: 'name', dir: 'asc' } });
  const [items, setItems] = useState<ProfileTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryRef = useRef(query);
  useLayoutEffect(() => { queryRef.current = query; }, [query]);
  // only the newest read is shown
  const seqRef = useRef(0);

  const load = useCallback((q: ProfileTemplateQuery, signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    const seq = ++seqRef.current;
    return api.list(q, signal).then(
      (page) => {
        if (signal?.aborted || seq !== seqRef.current) return;
        setItems(page.items);
        setTotal(page.total);
        setError(null);
        setLoadedKey(JSON.stringify(q));
      },
      (e: unknown) => {
        if (signal?.aborted || seq !== seqRef.current) return;
        setError(errorMessage(e, m.common.loadFailed));
        setLoadedKey(JSON.stringify(q));
      },
    );
  }, [api, m.common.loadFailed]);

  useEffect(() => {
    if (!open) return undefined;
    const ctl = new AbortController();
    load(query, ctl.signal).catch(() => undefined);
    return () => ctl.abort();
  }, [load, query, open]);

  function tableQuery(t: DataTableQuery) {
    const next: ProfileTemplateQuery = {
      page: t.page, pageSize: t.pageSize, search: t.search.trim() || undefined, sort: toIotSort(t.sort, PROFILE_TEMPLATE_SORT_KEYS),
    };
    const cur = queryRef.current;
    if (next.page === cur.page && next.pageSize === cur.pageSize && (next.search ?? '') === (cur.search ?? '') && sameSort(next.sort, cur.sort)) return;
    const moved = (next.search ?? '') !== (cur.search ?? '') || !sameSort(next.sort, cur.sort) ? { ...next, page: 1 } : next;
    queryRef.current = moved;
    setQuery(moved);
  }

  const columns = useMemo((): Column<Row>[] => [
    {
      key: 'name', header: m.platformTemplates.name, sortable: true, sortKey: 'name',
      render: (t) => (t.profileId ? (
        <button type="button" className="text-left font-medium text-primary hover:underline" aria-label={fill(m.platformTemplates.openProfile, { name: t.name })}
          onClick={() => { onClose(); onOpen(t.profileId!); }}>{t.name}</button>
      ) : <span className="font-medium text-text-primary">{t.name}</span>),
    },
    { key: 'templateKey', header: m.platformTemplates.key, render: (t) => <code className="text-xs">{t.templateKey}</code> },
    { key: 'templateVersion', header: m.platformTemplates.version, render: (t) => <Badge variant="neutral" size="sm">{`v${t.templateVersion}`}</Badge> },
    { key: 'transportType', header: m.platformTemplates.transport, hideBelow: 'md', render: (t) => transportLabel(t.transportType, (x) => m.transport[x]) },
    { key: 'updatedAt', header: m.platformTemplates.updated, sortable: true, sortKey: 'updated', hideBelow: 'md', render: (t) => formatDateTime(t.updatedAt, { locale, timeZone }) },
  ], [m, locale, timeZone, onClose, onOpen]);

  if (!api) return null;
  return (
    <Drawer open={open} onClose={onClose} title={m.platformTemplates.title} closeLabel={m.common.close} className="w-[48rem]">
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{m.platformTemplates.hint}</p>
        <DataTable<Row>
          mode="manual"
          variant="plain"
          caption={m.platformTemplates.title}
          columns={columns}
          rows={items as Row[]}
          total={total}
          query={{ page: query.page, pageSize: query.pageSize, sort: toTableSort(query.sort), search: query.search ?? '' }}
          onQueryChange={tableQuery}
          multiSort={false}
          searchPlaceholder={m.platformTemplates.search}
          pageSizeOptions={[PAGE_SIZE, 50]}
          rowId={(t) => t.templateKey}
          loading={loadedKey !== JSON.stringify(query)}
          error={error || undefined}
          onRetry={() => void load(queryRef.current)}
          emptyMessage={m.platformTemplates.empty}
          messages={{ loading: m.common.loading, retry: m.common.retry }}
        />
      </div>
    </Drawer>
  );
}
