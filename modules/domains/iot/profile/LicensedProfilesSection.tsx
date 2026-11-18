'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableQuery } from '@/modules/ui/Table/types';
import { errorMessage, PROFILE_TEMPLATE_SORT_KEYS, type ProfileTemplateQuery } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { sameSort, toIotSort, toTableSort } from '../api/list-table';
import { fill } from '../format';
import type { ProfileTemplate } from '../types/profile';
import { ProfileSection } from './profile-fields';

/**
 * LicensedProfilesSection — "Licensed device profiles" (NB 63-licensed-devices LD-3): the profiles the platform publishes for Roltek's
 * own devices and licensed ones, at the top of the new profile drawer. One card per template (name, version, description, transport,
 * plain MQTT and the every-command-without-TLS mark), on the DataTable's own search, sort and paging (the host serves the page). "Use"
 * gives the workspace its own copy (`profiles.templates.adopt`) and opens it; a template the workspace already copied offers "Open your
 * copy". Nothing is drawn while the host has no templates API, and nothing once the first page says the platform publishes none.
 */
export type LicensedProfilesSectionProps = {
  /** The profile to open: the copy just made (`created`) or the one the workspace already had. */
  onOpen: (profileId: string, created: boolean) => void;
  /** Whether the section is drawn (false without the host's API or once none is published): the drawer titles its form by it. */
  onPresence?: (shown: boolean) => void;
  className?: string;
};

const PAGE_SIZE = 6;

export function LicensedProfilesSection({ onOpen, onPresence, className }: LicensedProfilesSectionProps) {
  const api = useIotAdapter().profiles?.templates;
  const notify = useIotNotify();
  const { m } = useIotText();
  const [query, setQuery] = useState<ProfileTemplateQuery>({ page: 1, pageSize: PAGE_SIZE, sort: { key: 'name', dir: 'asc' } });
  const [items, setItems] = useState<ProfileTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // none published: known after the first unfiltered page answers zero
  const [nonePublished, setNonePublished] = useState(false);
  const [adopting, setAdopting] = useState<string | null>(null);
  const queryRef = useRef(query);
  // a layout effect: the table reports its query before the passive effects run, and must compare with the one it was handed
  useLayoutEffect(() => { queryRef.current = query; }, [query]);
  // only the newest read is shown: a late answer of an older one is dropped
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
        if (!q.search && q.page === 1 && page.total === 0) setNonePublished(true);
      },
      (e: unknown) => {
        if (signal?.aborted || seq !== seqRef.current) return;
        setError(errorMessage(e, m.common.loadFailed));
        setLoadedKey(JSON.stringify(q));
      },
    );
  }, [api, m.common.loadFailed]);

  useEffect(() => {
    const ctl = new AbortController();
    load(query, ctl.signal).catch(() => undefined);
    return () => ctl.abort();
  }, [load, query]);

  const shown = !!api && !nonePublished;
  useEffect(() => { onPresence?.(shown); }, [onPresence, shown]);

  function tableQuery(t: DataTableQuery) {
    const next: ProfileTemplateQuery = {
      page: t.page, pageSize: t.pageSize, search: t.search.trim() || undefined, sort: toIotSort(t.sort, PROFILE_TEMPLATE_SORT_KEYS),
    };
    const cur = queryRef.current;
    if (next.page === cur.page && next.pageSize === cur.pageSize && (next.search ?? '') === (cur.search ?? '') && sameSort(next.sort, cur.sort)) return;
    // a new search or sort starts at the first page; at once, not in the effect, so the table's next report compares with it
    const moved = (next.search ?? '') !== (cur.search ?? '') || !sameSort(next.sort, cur.sort) ? { ...next, page: 1 } : next;
    queryRef.current = moved;
    setQuery(moved);
  }

  async function adopt(t: ProfileTemplate) {
    if (!api) return;
    setAdopting(t.templateKey);
    try {
      const out = await api.adopt(t.templateKey);
      notify({ tone: 'success', message: fill(out.created ? m.newProfile.licensedAdopted : m.newProfile.licensedHad, { name: t.name }) });
      onOpen(out.profileId, out.created);
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.newProfile.licensedFailed) });
    } finally {
      setAdopting(null);
    }
  }

  const columns = useMemo((): Column<ProfileTemplate>[] => [
    { key: 'name', header: m.newProfile.licensedName, sortable: true, sortKey: 'name' },
    { key: 'updatedAt', header: m.newProfile.licensedUpdated, sortable: true, sortKey: 'updated' },
  ], [m]);

  if (!shown) return null;
  return (
    <ProfileSection title={m.newProfile.licensed} hint={m.newProfile.licensedHint} className={className}>
      <DataTable<ProfileTemplate>
        mode="manual"
        layout="cards"
        cardMinWidth="12rem"
        caption={m.newProfile.licensed}
        columns={columns}
        rows={items}
        total={total}
        query={{ page: query.page, pageSize: query.pageSize, sort: toTableSort(query.sort), search: query.search ?? '' }}
        onQueryChange={tableQuery}
        multiSort={false}
        searchPlaceholder={m.newProfile.licensedSearch}
        pageSizeOptions={[PAGE_SIZE, 12, 24]}
        rowId={(t) => t.templateKey}
        loading={loadedKey !== JSON.stringify(query)}
        error={error || undefined}
        onRetry={() => void load(queryRef.current)}
        emptyMessage={m.newProfile.licensedEmpty}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        renderCard={(t) => (
          <div className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface-base p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 font-medium text-text-primary">{t.name}</span>
              <Badge variant="neutral" size="sm">{fill(m.newProfile.licensedVersion, { version: t.templateVersion })}</Badge>
            </div>
            {t.description && <p className="text-xs text-text-secondary">{t.description}</p>}
            <div className="flex flex-wrap gap-1">
              <Badge variant="info" size="sm">{(m.transport as Record<string, string | undefined>)[t.transportType] ?? t.transportType}</Badge>
              <Badge variant={t.mqttTransport === 'PLAINTEXT_ALLOWED' ? 'warning' : 'success'} size="sm">
                {t.mqttTransport === 'PLAINTEXT_ALLOWED' ? m.newProfile.licensedPlain : m.newProfile.licensedTls}
              </Badge>
              {t.plaintextAllCommands && <Badge variant="warning" size="sm">{m.newProfile.licensedPlainAll}</Badge>}
            </div>
            <div className="mt-auto flex justify-end">
              {t.copyProfileId
                ? <Button variant="ghost" size="sm" onClick={() => onOpen(t.copyProfileId!, false)}>{m.newProfile.licensedOpenCopy}</Button>
                : <Button variant="secondary" size="sm" loading={adopting === t.templateKey} disabled={adopting !== null} onClick={() => void adopt(t)}>{m.newProfile.licensedUse}</Button>}
            </div>
          </div>
        )}
      />
    </ProfileSection>
  );
}
