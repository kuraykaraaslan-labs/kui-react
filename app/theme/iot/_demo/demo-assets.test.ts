import { describe, it, expect } from 'vitest';
import { createDemoAssets } from './demo-assets';
import type { DeviceRecord } from '@/modules/domains/iot/types/device';
import { flattenAssets } from '@/modules/domains/iot/types/asset';

const DEVICES: DeviceRecord[] = ['dev-001', 'dev-002', 'dev-003', 'dev-x'].map((deviceId) => ({
  deviceId, name: deviceId, deviceProfileId: 'p', status: 'ACTIVE', isGateway: false, online: true,
}));
const make = () => createDemoAssets(() => DEVICES, async () => undefined);

describe('demo sites and assets (the rules NB iot_asset enforces)', () => {
  it('builds the plant tree with direct device counts and inherited time zones', async () => {
    const api = make();
    const { nodes } = await api.tree();
    expect(nodes.map((n) => n.name)).toEqual(['Berlin logistics hub', 'Berlin plant']);
    const press = flattenAssets(nodes).find((n) => n.assetId === 'as-press-3')!;
    expect(press.deviceCount).toBe(1);
    const rec = await api.get('as-press-3');
    expect(rec.ancestors.map((a) => a.name)).toEqual(['Berlin plant', 'Hall A', 'Press line']);
    expect(rec.effectiveTimezone).toBe('Europe/Berlin');
  });

  it('refuses a move under itself or a descendant, and a delete while children remain', async () => {
    const api = make();
    await expect(api.move('as-hall-a', 'as-press-3')).rejects.toMatchObject({ code: 'validation' });
    await expect(api.move('as-hall-a', 'as-hall-a')).rejects.toMatchObject({ code: 'validation' });
    await expect(api.remove('as-hall-a')).rejects.toMatchObject({ code: 'conflict' });
    await api.move('as-press-line', 'as-hall-b');
    expect((await api.get('as-press-3')).ancestors.map((a) => a.name)).toEqual(['Berlin plant', 'Hall B', 'Press line']);
  });

  it('keeps one placement per device, finds devices below a node, and derives free codes', async () => {
    const api = make();
    await api.place('as-hall-a', ['dev-001']);
    expect((await api.placement('dev-001')).path.map((p) => p.name)).toEqual(['Berlin plant', 'Hall A']);
    expect((await api.devices('as-plant', { page: 1, pageSize: 50 })).items.map((i) => i.device.deviceId).sort()).toEqual(['dev-001', 'dev-002', 'dev-003']);
    expect((await api.devices('as-plant', { page: 1, pageSize: 50, recursive: false })).total).toBe(0);
    const a = await api.create({ name: 'Hall A', kind: 'building', parentId: 'as-plant' });
    expect((await api.get(a.assetId)).code).toBe('HALL-A-2');
    await expect(api.create({ name: 'X', kind: 'AREA', code: 'zone-c' })).rejects.toMatchObject({ code: 'conflict' });
    await api.setPlacement('dev-001', null);
    expect(api.placementOf('dev-001')).toBeNull();
  });

  it('answers the table (place, counts rolled up, active alarms, filters, sort, paging) and the summary', async () => {
    const alarms = [
      { deviceId: 'dev-002', severity: 'MINOR' as const, status: 'OPEN' as const },
      { deviceId: 'dev-002', severity: 'CRITICAL' as const, status: 'ACKNOWLEDGED' as const },
      { deviceId: 'dev-001', severity: 'MAJOR' as const, status: 'RESOLVED' as const },
    ];
    const api = createDemoAssets(() => DEVICES, async () => undefined, () => alarms);
    const all = await api.list({ page: 1, pageSize: 100 });
    expect(all.alarms).toBe(true);
    const plant = all.items.find((r) => r.assetId === 'as-plant')!;
    expect(plant).toMatchObject({ location: [], deviceCount: 3, alarmCount: 2, worstSeverity: 'CRITICAL' });
    const press = all.items.find((r) => r.assetId === 'as-press-3')!;
    expect(press.location.map((l) => l.name)).toEqual(['Berlin plant', 'Hall A', 'Press line']);
    // tree order without a sort: a site, then what is under it
    expect(all.items.findIndex((r) => r.assetId === 'as-plant')).toBeLessThan(all.items.findIndex((r) => r.assetId === 'as-hall-a'));
    expect((await api.list({ page: 1, pageSize: 100, search: 'press' })).items.every((r) => /press/i.test(r.name) || r.location.some((l) => /press/i.test(l.name)))).toBe(true);
    expect((await api.list({ page: 1, pageSize: 100, alarmed: true })).items.every((r) => (r.alarmCount ?? 0) > 0)).toBe(true);
    expect((await api.list({ page: 1, pageSize: 100, site: 'as-plant' })).items.every((r) => r.assetId === 'as-plant' || r.location[0]?.assetId === 'as-plant')).toBe(true);
    expect((await api.list({ page: 1, pageSize: 100, parentId: 'as-plant' })).items.every((r) => r.parentId === 'as-plant')).toBe(true);
    const byAlarm = await api.list({ page: 1, pageSize: 2, sort: { key: 'alarms', dir: 'desc' } });
    expect(byAlarm.items).toHaveLength(2);
    expect(byAlarm.items[0].worstSeverity).toBe('CRITICAL');
    expect(byAlarm.total).toBe(all.total);
    const s = await api.summary();
    expect(s).toMatchObject({ sites: 2, assets: all.total, devices: 4, activeAlarms: 2, sitesWithAlarms: 1, alarms: true });
    expect(s.siteList[0]).toMatchObject({ assetId: 'as-plant', alarmsBySeverity: { CRITICAL: 1, MINOR: 1 } });
  });
});
