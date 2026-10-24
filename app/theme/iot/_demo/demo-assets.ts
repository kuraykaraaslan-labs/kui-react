import { IotApiError, type IotAssetsApi } from '@/modules/domains/iot/api/adapter';
import type {
  AssetCrumb, AssetNode, AssetRecord, AssetRelation, DevicePlacement, RelationEntityType,
} from '@/modules/domains/iot/types/asset';
import type { DeviceRecord } from '@/modules/domains/iot/types/device';
import { DEMO_ASSETS, DEMO_PLACEMENTS, type DemoAsset } from '../iot.data';

/*
 * The demo's sites and assets (docs/concepts/iot-platform/phases/08): an in-memory topology over `DEMO_ASSETS`, with the same rules
 * NB's `iot_asset` enforces, so the screens show the same refusals: a move under the asset itself or a descendant (validation), a
 * delete while children remain (conflict), one placement per device (a second one moves it), a code unique among live assets, asset →
 * asset CONTAINS never a relation. Changes last for the page's life (no browser storage).
 */

type Row = DemoAsset & { createdAt: Date };

export type DemoAssets = IotAssetsApi & {
  /** The asset a device is placed on (the demo's device delete asks it, like NB's reference check). */
  placementOf(deviceId: string): string | null;
};

const MINUTE = 60_000;

export function createDemoAssets(devices: () => DeviceRecord[], wait: () => Promise<void>): DemoAssets {
  let seq = 0;
  const rows: Row[] = DEMO_ASSETS.map((a, i) => ({ ...a, attributes: { ...(a.attributes ?? {}) }, createdAt: new Date(Date.now() - (400 - i) * 86_400_000) }));
  const relations: AssetRelation[] = [
    ...Object.entries(DEMO_PLACEMENTS).map(([deviceId, assetId], i): AssetRelation => ({
      relationId: `rel-p${i}`, fromType: 'ASSET', fromId: assetId, toType: 'DEVICE', toId: deviceId, type: 'CONTAINS', createdAt: new Date(Date.now() - 30 * MINUTE),
    })),
    { relationId: 'rel-f1', fromType: 'ASSET', fromId: 'as-coolant', toType: 'ASSET', toId: 'as-press-line', type: 'FEEDS', createdAt: new Date(Date.now() - 90 * 86_400_000) },
    { relationId: 'rel-m1', fromType: 'DEVICE', fromId: 'dev-002', toType: 'ASSET', toId: 'as-assembly', type: 'MONITORS', createdAt: new Date(Date.now() - 60 * 86_400_000) },
  ];

  const row = (id: string): Row => {
    const r = rows.find((x) => x.assetId === id);
    if (!r) throw new IotApiError('not_found', 'Asset not found.');
    return r;
  };
  const childrenOf = (id: string | null) => rows.filter((r) => r.parentId === id).sort((a, b) => a.name.localeCompare(b.name));
  const subtree = (id: string): string[] => [id, ...childrenOf(id).flatMap((c) => subtree(c.assetId))];
  const ancestors = (r: Row): Row[] => (r.parentId ? [...ancestors(row(r.parentId)), row(r.parentId)] : []);
  const crumb = (r: Row): AssetCrumb => ({ assetId: r.assetId, code: r.code, name: r.name, kind: r.kind });
  const placements = () => relations.filter((x) => x.type === 'CONTAINS' && x.toType === 'DEVICE');
  const placementOf = (deviceId: string) => placements().find((x) => x.toId === deviceId)?.fromId ?? null;
  const deviceCount = (id: string) => placements().filter((x) => x.fromId === id && devices().some((d) => d.deviceId === x.toId)).length;
  const node = (r: Row): AssetNode => ({
    assetId: r.assetId, parentId: r.parentId, code: r.code, name: r.name, kind: r.kind, lat: r.lat ?? null, lng: r.lng ?? null,
    childCount: childrenOf(r.assetId).length, deviceCount: deviceCount(r.assetId), children: childrenOf(r.assetId).map(node),
  });
  const codeOf = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'NODE';
  const freeCode = (base: string) => { let c = base; for (let i = 2; rows.some((r) => r.code === c); i++) c = `${base}-${i}`; return c; };
  const refuseTakenCode = (code: string, except?: string) => {
    if (rows.some((r) => r.code === code && r.assetId !== except)) throw new IotApiError('conflict', 'Another asset already uses this code.', { fieldErrors: { code: 'This code is taken.' } });
  };
  const placementView = (deviceId: string): DevicePlacement => {
    const at = placementOf(deviceId);
    if (!at) return { assetId: null, path: [] };
    const r = row(at);
    return { assetId: at, path: [...ancestors(r), r].map(crumb) };
  };
  const nameOf = (type: RelationEntityType, id: string) => (type === 'ASSET' ? rows.find((r) => r.assetId === id)?.name : devices().find((d) => d.deviceId === id)?.name) ?? null;

  return {
    placementOf,
    async tree() {
      await wait();
      return { nodes: childrenOf(null).map(node), truncated: false };
    },
    async get(id) {
      await wait();
      const r = row(id);
      const up = ancestors(r);
      const record: AssetRecord = {
        assetId: r.assetId, parentId: r.parentId, code: r.code, name: r.name, kind: r.kind, description: r.description ?? null,
        lat: r.lat ?? null, lng: r.lng ?? null, timezone: r.timezone ?? null,
        effectiveTimezone: r.timezone ?? [...up].reverse().find((a) => a.timezone)?.timezone ?? null,
        attributes: { ...(r.attributes ?? {}) }, ancestors: up.map(crumb), childCount: childrenOf(r.assetId).length,
        deviceCount: subtree(r.assetId).reduce((s, x) => s + deviceCount(x), 0), createdAt: r.createdAt, updatedAt: r.createdAt,
      };
      return record;
    },
    async create(input) {
      await wait();
      if (input.parentId) row(input.parentId);
      const code = input.code ? input.code.toUpperCase() : freeCode(codeOf(input.name));
      refuseTakenCode(code);
      const r: Row = {
        assetId: `as-n${++seq}`, parentId: input.parentId ?? null, code, name: input.name, kind: input.kind.toUpperCase(),
        description: input.description ?? undefined, lat: input.lat ?? undefined, lng: input.lng ?? undefined,
        timezone: input.timezone ?? undefined, attributes: input.attributes ?? {}, createdAt: new Date(),
      };
      rows.push(r);
      return { assetId: r.assetId };
    },
    async update(id, patch) {
      await wait();
      const r = row(id);
      if (patch.code !== undefined && patch.code.toUpperCase() !== r.code) refuseTakenCode(patch.code.toUpperCase(), id);
      if (patch.name !== undefined) r.name = patch.name;
      if (patch.kind !== undefined) r.kind = patch.kind.toUpperCase();
      if (patch.code !== undefined) r.code = patch.code.toUpperCase();
      if (patch.description !== undefined) r.description = patch.description ?? undefined;
      if (patch.timezone !== undefined) r.timezone = patch.timezone ?? undefined;
      if (patch.lat !== undefined) r.lat = patch.lat ?? undefined;
      if (patch.lng !== undefined) r.lng = patch.lng ?? undefined;
      if (patch.attributes !== undefined) r.attributes = { ...patch.attributes };
    },
    async move(id, parentId) {
      await wait();
      const r = row(id);
      if (parentId) {
        row(parentId);
        if (subtree(id).includes(parentId)) throw new IotApiError('validation', 'An asset cannot be moved under itself or one of its own descendants.');
      }
      r.parentId = parentId;
    },
    async remove(id) {
      await wait();
      row(id);
      if (childrenOf(id).length) throw new IotApiError('conflict', 'This asset still has child assets: move or delete them first.');
      for (let i = relations.length - 1; i >= 0; i--) {
        const x = relations[i];
        if ((x.fromType === 'ASSET' && x.fromId === id) || (x.toType === 'ASSET' && x.toId === id)) relations.splice(i, 1);
      }
      rows.splice(rows.findIndex((r) => r.assetId === id), 1);
    },
    async devices(id, q) {
      await wait();
      row(id);
      const scope = new Set(q.recursive === false ? [id] : subtree(id));
      const items = placements().filter((x) => scope.has(x.fromId)).flatMap((x) => {
        const d = devices().find((dv) => dv.deviceId === x.toId);
        return d ? [{ device: { ...d }, placement: crumb(row(x.fromId)) }] : [];
      }).sort((a, b) => a.device.name.localeCompare(b.device.name));
      return { items: items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: items.length };
    },
    async place(id, deviceIds) {
      await wait();
      row(id);
      if (deviceIds.length > 100) throw new IotApiError('validation', 'At most 100 devices can be placed at once.');
      for (const deviceId of deviceIds) {
        if (!devices().some((d) => d.deviceId === deviceId)) throw new IotApiError('not_found', 'Device not found.');
      }
      for (const deviceId of deviceIds) {
        const i = relations.findIndex((x) => x.type === 'CONTAINS' && x.toType === 'DEVICE' && x.toId === deviceId);
        if (i >= 0) relations.splice(i, 1);
        relations.push({ relationId: `rel-n${++seq}`, fromType: 'ASSET', fromId: id, toType: 'DEVICE', toId: deviceId, type: 'CONTAINS', createdAt: new Date() });
      }
    },
    async placement(deviceId) {
      await wait();
      return placementView(deviceId);
    },
    async setPlacement(deviceId, assetId) {
      await wait();
      if (assetId) row(assetId);
      const i = relations.findIndex((x) => x.type === 'CONTAINS' && x.toType === 'DEVICE' && x.toId === deviceId);
      if (i >= 0) relations.splice(i, 1);
      if (assetId) relations.push({ relationId: `rel-n${++seq}`, fromType: 'ASSET', fromId: assetId, toType: 'DEVICE', toId: deviceId, type: 'CONTAINS', createdAt: new Date() });
      return placementView(deviceId);
    },
    async relations(entity) {
      await wait();
      return relations
        .filter((x) => (x.fromType === entity.type && x.fromId === entity.id) || (x.toType === entity.type && x.toId === entity.id))
        .map((x) => ({ ...x, fromName: nameOf(x.fromType, x.fromId), toName: nameOf(x.toType, x.toId) }));
    },
    async createRelation(input) {
      await wait();
      const type = input.type.toUpperCase();
      if (input.fromType === input.toType && input.fromId === input.toId) throw new IotApiError('validation', 'A relation needs two different ends.');
      if (type === 'CONTAINS' && input.toType === 'ASSET') throw new IotApiError('validation', 'An asset inside another asset is set by moving it.');
      if (relations.some((x) => x.fromType === input.fromType && x.fromId === input.fromId && x.toType === input.toType && x.toId === input.toId && x.type === type)) {
        throw new IotApiError('conflict', 'This relation already exists.');
      }
      const rel: AssetRelation = { ...input, type, relationId: `rel-n${++seq}`, createdAt: new Date() };
      relations.push(rel);
      return { ...rel, fromName: nameOf(rel.fromType, rel.fromId), toName: nameOf(rel.toType, rel.toId) };
    },
    async removeRelation(relationId) {
      await wait();
      const i = relations.findIndex((x) => x.relationId === relationId);
      if (i < 0) throw new IotApiError('not_found', 'Relation not found.');
      relations.splice(i, 1);
    },
  };
}
