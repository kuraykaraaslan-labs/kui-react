import { OtaApiError, type OtaAdapter } from './ota-adapter';
import type {
  OtaAssignment, OtaAttempt, OtaEvent, OtaOption, OtaPackage, OtaProfileSettings, OtaSettingsInput, OtaSigningKey, OtaState,
} from './types';

/**
 * The in-memory OTA adapter of the kui-react demo (`/theme/iot/firmware`). Seeded with packages, a key, an assignment and devices on their
 * way; every `step()` moves the devices one state on (one fails, then succeeds on retry), an LTE device with updates over LTE off stays
 * WAITING (metered) until it is allowed, and a router that asks first stays WAITING (approval) until `approve()` (OD-7, OD-13).
 */

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
const PROFILES: OtaOption[] = [{ id: 'p-rut', name: 'Roltek RUT routers' }, { id: 'p-esp', name: 'DC620 controllers' }];
const DEVICES: Array<OtaOption & { profileId: string; fw: string; lte?: boolean; approval?: boolean; failOnce?: boolean }> = [
  { id: 'd-1', name: 'Pump house router', profileId: 'p-rut', fw: '24.10.0-r1100', hint: 'Roltek RUT routers' },
  { id: 'd-2', name: 'Reservoir router', profileId: 'p-rut', fw: '24.10.0-r1100', hint: 'Roltek RUT routers', failOnce: true },
  { id: 'd-3', name: 'Valve station (LTE)', profileId: 'p-rut', fw: '24.10.0-r1100', hint: 'Roltek RUT routers', lte: true },
  { id: 'd-4', name: 'Office router', profileId: 'p-rut', fw: '24.10.0-r1100', hint: 'Roltek RUT routers', approval: true },
  { id: 'd-5', name: 'Tank level controller', profileId: 'p-esp', fw: '1.4.2', hint: 'DC620 controllers' },
];
const ORDER: OtaState[] = ['QUEUED', 'INITIATED', 'DOWNLOADING', 'DOWNLOADED', 'VERIFIED', 'UPDATING', 'UPDATED'];

export interface DemoOtaAdapter extends OtaAdapter {
  /** One tick of the simulation. */
  step(): void;
  /** The router waiting for its own approval gets it. */
  approve(deviceId: string): void;
}

export function createDemoOtaAdapter(opts: { delayMs?: number } = {}): DemoOtaAdapter {
  const wait = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), opts.delayMs ?? 120));
  let seq = 10;
  const id = (p: string) => `${p}-${++seq}`;
  const keys: OtaSigningKey[] = [{ keyId: 'k-1', scheme: 'usign-ed25519', fingerprint: 'RWQ2c3VzaWduX2RlbW8', label: 'Roltek build 2026', createdAt: iso(40 * 86_400_000), revokedAt: null }];
  const base = { type: 'FIRMWARE' as const, hardwareModels: [], minFromVersion: null, checksumAlgorithm: 'SHA256', rejectReason: null };
  const packages: OtaPackage[] = [
    { ...base, packageId: 'pkg-1', title: 'roltek-rut-fw', version: '24.10.0-r1100', profileId: 'p-rut', size: 14_200_000, checksum: 'a3f1c2'.padEnd(64, '0'), signatureScheme: 'usign-ed25519', signingKeyId: 'k-1', status: 'DEPRECATED', releaseNotes: 'Spring release.', createdAt: iso(30 * 86_400_000), readyAt: iso(30 * 86_400_000) },
    { ...base, packageId: 'pkg-2', title: 'roltek-rut-fw', version: '24.10.1-r1234', profileId: 'p-rut', size: 14_450_112, checksum: '9b2e7d'.padEnd(64, '1'), signatureScheme: 'usign-ed25519', signingKeyId: 'k-1', status: 'READY', releaseNotes: 'Security fixes for the web panel.\nFaster LTE reconnect.', createdAt: iso(2 * 86_400_000), readyAt: iso(2 * 86_400_000) },
    { ...base, packageId: 'pkg-3', title: 'dc620-fw', version: '1.5.0', profileId: 'p-esp', size: 1_310_720, checksum: '44aa01'.padEnd(64, '2'), signatureScheme: 'esp32-secure-boot-v2', signingKeyId: null, status: 'DRAFT', releaseNotes: null, createdAt: iso(600_000), readyAt: null },
  ];
  const assignments: OtaAssignment[] = [{ assignmentId: 'a-1', targetType: 'PROFILE', targetId: 'p-rut', targetName: 'Roltek RUT routers', packageId: 'pkg-2', deviceCount: null, createdAt: iso(3_600_000) }];
  const settings = new Map<string, OtaSettingsInput>([['profile:p-rut', { otaEnabled: true }]]);
  const attempts = new Map<string, OtaAttempt>();
  const events = new Map<string, OtaEvent[]>();
  const failed = new Set<string>();
  const approved = new Set<string>();

  const profileSettings = (profileId: string): OtaProfileSettings => ({
    otaEnabled: false, allowMetered: false, allowUnsigned: false, downloadTimeoutMin: 60, updateTimeoutMin: 20, maxAttempts: 3,
    ...(settings.get(`profile:${profileId}`) as Partial<OtaProfileSettings> | undefined),
  });
  const meteredOk = (d: (typeof DEVICES)[number]) => {
    const own = settings.get(`device:${d.id}`)?.allowMetered;
    return typeof own === 'boolean' ? own : profileSettings(d.profileId).allowMetered;
  };
  const log = (deviceId: string, packageId: string, from: string, to: string, fwError: string | null = null) => {
    const list = events.get(deviceId) ?? [];
    list.unshift({ at: new Date().toISOString(), packageId, from, to, kind: 'moved', fwError });
    events.set(deviceId, list.slice(0, 50));
  };
  const move = (a: OtaAttempt, to: OtaState, extra: Partial<OtaAttempt> = {}) => {
    log(a.deviceId, a.packageId, a.state, to, extra.fwError ?? null);
    Object.assign(a, { state: to, stateChangedAt: new Date().toISOString(), ...extra });
    if (to === 'UPDATED') { const d = DEVICES.find((x) => x.id === a.deviceId); if (d) d.fw = a.toVersion; a.finishedAt = a.stateChangedAt; }
  };
  const start = (deviceId: string, packageId: string, assignmentId: string | null) => {
    const d = DEVICES.find((x) => x.id === deviceId)!;
    const pkg = packages.find((p) => p.packageId === packageId)!;
    const a: OtaAttempt = {
      deviceId, deviceName: d.name, packageId, assignmentId, state: 'QUEUED', waitReason: null, fromVersion: d.fw, toVersion: pkg.version, fwError: null,
      attempts: 1, progress: null, stateChangedAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: null,
    };
    if (pkg.profileId && pkg.profileId !== d.profileId) { a.state = 'SKIPPED'; a.fwError = 'profile_mismatch'; }
    else if (d.fw === pkg.version) { a.state = 'UPDATED'; }
    attempts.set(deviceId, a);
    log(deviceId, packageId, 'QUEUED', a.state, a.fwError);
  };
  const covered = (a: { targetType: string; targetId: string; deviceIds?: string[] }) =>
    a.targetType === 'DEVICE' ? [a.targetId] : a.targetType === 'GROUP' ? a.deviceIds ?? [] : DEVICES.filter((d) => d.profileId === a.targetId).map((d) => d.id);
  // seed: the profile assignment's devices on their way
  for (const d of DEVICES.filter((x) => x.profileId === 'p-rut')) start(d.id, 'pkg-2', 'a-1');
  const seedA = attempts.get('d-1')!; move(seedA, 'INITIATED'); move(seedA, 'DOWNLOADING', { progress: 40 });

  function step() {
    for (const a of attempts.values()) {
      const d = DEVICES.find((x) => x.id === a.deviceId)!;
      if (['UPDATED', 'FAILED', 'TIMEOUT', 'ROLLED_BACK', 'SKIPPED', 'CANCELLED'].includes(a.state)) continue;
      if (a.state === 'INITIATED' || a.state === 'WAITING') {
        if (d.lte && !meteredOk(d)) { if (a.state !== 'WAITING' || a.waitReason !== 'metered') move(a, 'WAITING', { waitReason: 'metered' }); continue; }
        if (d.approval && !approved.has(d.id)) { if (a.state !== 'WAITING' || a.waitReason !== 'approval') move(a, 'WAITING', { waitReason: 'approval' }); continue; }
        move(a, 'DOWNLOADING', { waitReason: null, progress: 10 });
        continue;
      }
      if (a.state === 'DOWNLOADING' && (a.progress ?? 0) < 100) { a.progress = Math.min(100, (a.progress ?? 0) + 45); a.stateChangedAt = new Date().toISOString(); if (a.progress < 100) continue; }
      if (a.state === 'VERIFIED' && d.failOnce && !failed.has(d.id)) { failed.add(d.id); move(a, 'FAILED', { fwError: 'verify_failed' }); continue; }
      const next = ORDER[ORDER.indexOf(a.state) + 1];
      if (next) move(a, next, next === 'DOWNLOADED' ? { progress: 100 } : {});
    }
  }

  const adapter: DemoOtaAdapter = {
    step,
    approve(deviceId) { approved.add(deviceId); },
    packages: {
      list: () => wait(packages),
      get: (packageId) => {
        const pkg = packages.find((p) => p.packageId === packageId);
        if (!pkg) return Promise.reject(new OtaApiError('Firmware package not found.', 404));
        const states: Partial<Record<OtaState, number>> = {};
        for (const a of attempts.values()) if (a.packageId === packageId) states[a.state] = (states[a.state] ?? 0) + 1;
        return wait({ package: pkg, states });
      },
      async upload(file, meta, onProgress) {
        for (const f of [0.25, 0.5, 0.75, 1]) { await new Promise((r) => setTimeout(r, 120)); onProgress?.(f); }
        if (packages.some((p) => p.title === meta.title && p.version === meta.version)) throw new OtaApiError('exists', 409, { reason: 'package_exists' });
        if (meta.signatureScheme === 'usign-ed25519' && !meta.signature?.trim()) throw new OtaApiError('bad signature', 422, { reason: 'signature_malformed' });
        const pkg: OtaPackage = {
          ...base, packageId: id('pkg'), type: meta.type ?? 'FIRMWARE', title: meta.title, version: meta.version, profileId: meta.profileId ?? null, size: file.size,
          hardwareModels: meta.hardwareModels ?? [], minFromVersion: meta.minFromVersion ?? null, checksum: meta.checksum, signatureScheme: meta.signatureScheme,
          signingKeyId: meta.signatureScheme === 'usign-ed25519' ? 'k-1' : null, status: 'READY', releaseNotes: meta.releaseNotes ?? null,
          createdAt: new Date().toISOString(), readyAt: new Date().toISOString(),
        };
        packages.unshift(pkg);
        return structuredClone(pkg);
      },
      update: (packageId, input) => {
        const pkg = packages.find((p) => p.packageId === packageId)!;
        if (input.status) pkg.status = input.status;
        if (input.releaseNotes !== undefined) pkg.releaseNotes = input.releaseNotes;
        if (input.status === 'REVOKED') for (const a of attempts.values()) if (a.packageId === packageId && ['QUEUED', 'INITIATED', 'WAITING', 'DOWNLOADING', 'DOWNLOADED', 'VERIFIED'].includes(a.state)) move(a, 'CANCELLED', { fwError: 'package_revoked' });
        return wait(pkg);
      },
      remove: (packageId) => {
        if (assignments.some((a) => a.packageId === packageId) || [...attempts.values()].some((a) => a.packageId === packageId)) {
          return Promise.reject(new OtaApiError('referenced', 409, { reason: 'package_referenced' }));
        }
        packages.splice(packages.findIndex((p) => p.packageId === packageId), 1);
        return wait(undefined);
      },
    },
    keys: {
      list: () => wait(keys),
      add: (input) => {
        if (input.scheme === 'esp32-secure-boot-v2' && !/^[0-9a-f]{64}$/i.test(input.publicKey)) return Promise.reject(new OtaApiError('invalid', 422, { reason: 'key_invalid' }));
        const k: OtaSigningKey = { keyId: id('k'), scheme: input.scheme, fingerprint: input.publicKey.replace(/\s+/g, '').slice(-19), label: input.label, createdAt: new Date().toISOString(), revokedAt: null };
        keys.unshift(k);
        return wait(k);
      },
      revoke: (keyId) => {
        const k = keys.find((x) => x.keyId === keyId)!;
        k.revokedAt = new Date().toISOString();
        let revokedPackages = 0;
        for (const p of packages) if (p.signingKeyId === keyId && p.status !== 'REVOKED') { p.status = 'REVOKED'; revokedPackages += 1; }
        return wait({ revokedPackages, cancelled: 0 });
      },
    },
    assignments: {
      list: (q) => wait(assignments.filter((a) => (!q.packageId || a.packageId === q.packageId) && (!q.targetType || a.targetType === q.targetType) && (!q.targetId || a.targetId === q.targetId))),
      create: (packageId, target, o) => {
        const pkg = packages.find((p) => p.packageId === packageId)!;
        if (pkg.status !== 'READY') return Promise.reject(new OtaApiError('not ready', 409, { reason: 'package_not_ready' }));
        if (target.targetType === 'PROFILE' && !profileSettings(target.targetId).otaEnabled) return Promise.reject(new OtaApiError('off', 409, { reason: 'ota_disabled' }));
        const deviceIds = target.targetType === 'GROUP'
          ? ('selector' in target ? DEVICES.filter((d) => d.profileId === target.selector.profileId).map((d) => d.id) : target.deviceIds)
          : covered(target);
        const incompatible: Record<string, number> = {};
        let alreadyOnTarget = 0;
        for (const did of deviceIds) {
          const d = DEVICES.find((x) => x.id === did)!;
          if (pkg.profileId && pkg.profileId !== d.profileId) incompatible.profile_mismatch = (incompatible.profile_mismatch ?? 0) + 1;
          else if (!profileSettings(d.profileId).otaEnabled) incompatible.ota_disabled = (incompatible.ota_disabled ?? 0) + 1;
          else if (d.fw === pkg.version) alreadyOnTarget += 1;
        }
        const preview = { devices: deviceIds.length, offline: deviceIds.includes('d-3') ? 1 : 0, incompatible, alreadyOnTarget };
        if (o?.dryRun) return wait({ assignment: null, preview });
        const targetId = target.targetType === 'GROUP' ? id('g') : target.targetId;
        const a: OtaAssignment = {
          assignmentId: target.targetType === 'GROUP' ? targetId : id('a'), targetType: target.targetType, targetId,
          targetName: target.targetType === 'PROFILE' ? PROFILES.find((p) => p.id === targetId)?.name : target.targetType === 'DEVICE' ? DEVICES.find((d) => d.id === targetId)?.name : null,
          packageId, deviceCount: target.targetType === 'GROUP' ? deviceIds.length : null, createdAt: new Date().toISOString(),
        };
        if (target.targetType !== 'GROUP') for (let i = assignments.length - 1; i >= 0; i--) if (assignments[i]!.targetType === target.targetType && assignments[i]!.targetId === targetId) assignments.splice(i, 1);
        assignments.unshift(a);
        for (const did of deviceIds) start(did, packageId, a.assignmentId);
        for (const did of deviceIds) { const at = attempts.get(did)!; if (at.state === 'QUEUED') move(at, 'INITIATED'); }
        return wait({ assignment: a, preview });
      },
      remove: (assignmentId) => {
        const i = assignments.findIndex((a) => a.assignmentId === assignmentId);
        if (i >= 0) {
          const [a] = assignments.splice(i, 1);
          for (const at of attempts.values()) if (at.assignmentId === a!.assignmentId && !['UPDATED', 'UPDATING', 'FAILED', 'SKIPPED', 'CANCELLED'].includes(at.state)) move(at, 'CANCELLED', { fwError: 'assignment_removed' });
        }
        return wait(undefined);
      },
    },
    attempts: (q) => wait([...attempts.values()].filter((a) => (!q.packageId || a.packageId === q.packageId) && (!q.state || a.state === q.state)).sort((x, y) => y.stateChangedAt.localeCompare(x.stateChangedAt)).slice(0, q.limit ?? 100)),
    device: (deviceId) => {
      const d = DEVICES.find((x) => x.id === deviceId);
      if (!d) return Promise.reject(new OtaApiError('Device not found.', 404));
      return wait({ deviceId, currentVersion: d.fw, currentTitle: d.profileId === 'p-rut' ? 'roltek-rut-fw' : 'dc620-fw', attempt: attempts.get(deviceId) ?? null, events: events.get(deviceId) ?? [] });
    },
    retry: (deviceId) => {
      const a = attempts.get(deviceId);
      if (!a || !['FAILED', 'TIMEOUT', 'ROLLED_BACK'].includes(a.state)) return Promise.reject(new OtaApiError('not retryable', 409, { reason: 'not_retryable' }));
      a.attempts += 1;
      move(a, 'QUEUED', { fwError: null, progress: null });
      move(a, 'INITIATED');
      return wait(a);
    },
    settings: {
      get: (targetType, targetId) => {
        if (targetType === 'profile') {
          const stored = settings.get(`profile:${targetId}`) ?? {};
          return wait({ targetType, targetId, stored, effective: profileSettings(targetId) });
        }
        const d = DEVICES.find((x) => x.id === targetId)!;
        const own = settings.get(`device:${targetId}`)?.allowMetered ?? null;
        return wait({ targetType, targetId, stored: { allowMetered: own }, effective: { allowMetered: typeof own === 'boolean' ? own : profileSettings(d.profileId).allowMetered } });
      },
      put: (targetType, targetId, input) => {
        const k = `${targetType}:${targetId}`;
        settings.set(k, { ...(settings.get(k) ?? {}), ...input });
        return adapter.settings.get(targetType, targetId);
      },
    },
    profiles: () => wait(PROFILES),
    devices: (q) => wait(DEVICES.filter((d) => (!q.profileId || d.profileId === q.profileId) && (!q.search || d.name.toLowerCase().includes(q.search.toLowerCase()))).slice(0, q.pageSize).map(({ id: i, name, hint }) => ({ id: i, name, hint }))),
  };
  return adapter;
}
