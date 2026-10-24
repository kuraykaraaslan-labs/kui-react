'use client';
// The kit's only data path: everything goes through the host's `EntityAliasesAccess`. The entity types and relation
// providers are loaded once per access object (cached for a minute, so the aliases dialog, the alias dialog and the
// filter form share one request); entity names are resolved by id when a stored filter is shown.
//
// The access object is read through a ref, so a host that passes a new object on every render does not cause a
// reload loop; a new catalog is loaded the next time a dialog opens.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComboBoxOption } from '@/modules/ui/ComboBox';
import type { EntityAliasesAccess, EntityRef, EntityTypeInfo, RelationProviderInfo } from './types';

export interface AliasCatalog {
  entityTypes: EntityTypeInfo[];
  providers: RelationProviderInfo[];
}

const CATALOG_TTL_MS = 60_000;
const catalogCache = new WeakMap<EntityAliasesAccess, { at: number; promise: Promise<AliasCatalog> }>();

/** The entity types and relation providers of an access object. A failing `relationProviders()` means none. */
export function loadAliasCatalog(access: EntityAliasesAccess): Promise<AliasCatalog> {
  const hit = catalogCache.get(access);
  if (hit && Date.now() - hit.at < CATALOG_TTL_MS) return hit.promise;
  const promise = Promise.all([
    access.entityTypes(),
    access.relationProviders().catch(() => [] as RelationProviderInfo[]),
  ]).then(([entityTypes, providers]) => ({ entityTypes, providers }));
  catalogCache.set(access, { at: Date.now(), promise });
  promise.catch(() => {
    if (catalogCache.get(access)?.promise === promise) catalogCache.delete(access);
  });
  return promise;
}

/** A ref that always holds the latest value (for callbacks that must keep a stable identity). */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

const NO_TYPES: EntityTypeInfo[] = [];
const NO_PROVIDERS: RelationProviderInfo[] = [];

export function useAliasCatalog(access: EntityAliasesAccess, active = true) {
  const accessRef = useLatestRef(access);
  const [state, setState] = useState<{ catalog: AliasCatalog | null; failed: boolean }>({ catalog: null, failed: false });
  useEffect(() => {
    if (!active) return;
    let live = true;
    loadAliasCatalog(accessRef.current).then(
      (catalog) => { if (live) setState({ catalog, failed: false }); },
      () => { if (live) setState((s) => ({ ...s, failed: true })); },
    );
    return () => { live = false; };
  }, [active, accessRef]);
  return {
    entityTypes: state.catalog?.entityTypes ?? NO_TYPES,
    providers: state.catalog?.providers ?? NO_PROVIDERS,
    loaded: state.catalog !== null,
    failed: state.failed,
  };
}

export function toEntityOption(ref: EntityRef): ComboBoxOption {
  const description = ref.label || ref.subtype || undefined;
  return { value: ref.id, label: ref.name, ...(description ? { description } : {}) };
}

/**
 * Entities by id: the ones a search returned (`remember`) plus the ones resolved through `entitiesByIds` for ids that
 * are stored but not yet known. An id the host does not return (deleted, no access) stays unknown and is shown as is.
 */
export function useEntityRefs(access: EntityAliasesAccess, entityType: string, ids: readonly string[]) {
  const accessRef = useLatestRef(access);
  const [known, setKnown] = useState<Record<string, EntityRef>>({});
  const missing = entityType ? ids.filter((id) => id && !known[id]) : [];
  const missingKey = missing.length ? JSON.stringify([entityType, missing]) : '';

  useEffect(() => {
    if (!missingKey) return;
    const [type, list] = JSON.parse(missingKey) as [string, string[]];
    let live = true;
    accessRef.current.entitiesByIds(type, list).then(
      (refs) => {
        if (!live || refs.length === 0) return;
        setKnown((k) => {
          const next = { ...k };
          for (const r of refs) next[r.id] = r;
          return next;
        });
      },
      () => { /* unknown ids are shown by id */ },
    );
    return () => { live = false; };
  }, [missingKey, accessRef]);

  const remember = useCallback((refs: readonly EntityRef[]) => {
    if (refs.length === 0) return;
    setKnown((k) => {
      const next = { ...k };
      for (const r of refs) next[r.id] = r;
      return next;
    });
  }, []);

  return { known, remember };
}
