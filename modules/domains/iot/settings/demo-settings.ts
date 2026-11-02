import { SettingsApiError, type DeviceSettingsAdapter, type SettingsDeviceOption, type SettingsFleetAdapter } from './settings-adapter';
import { annotationsOf, differences, pathOf, schemaAt, secretPaths, validateValues, valueAt } from './settings-schema';
import type {
  DeviceSettings, SettingClass, SettingsBaseline, SettingsHistoryEntry, SettingsJob, SettingsJobTarget, SettingsSchemaNode, SettingsSection,
  SettingsTargetState, SettingsWaveCounters,
} from '../types/settings';
import { DEMO_SETTINGS_MANIFEST } from './demo-settings-manifest';

/**
 * The settings demo (next-boilerplate docs/concepts/iot-device-settings 05), for the IoT demo and the showcase: one Roltek router that
 * takes settings from the cloud, a sensor that does not, a prototype whose model is not described yet (their ids are the caller's), and a
 * fleet of 25 shop routers for the baselines and jobs pages. Nothing leaves the browser; a demo file, never vendored. A change goes "on its way", is "tried" by the device when it can cut it off, then
 * "applied" a few seconds later; the firewall rules start "changed on the device" so the drift view has something to show.
 */

export interface DemoSettingsDevices { router: string; unsupported: string; unknown: string }
const DEFAULT_DEVICES: DemoSettingsDevices = { router: 'demo-router', unsupported: 'demo-sensor', unknown: 'demo-prototype' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

const SEED: Record<string, Record<string, unknown>> = {
  firewall: {
    zones: [
      { name: 'lan', networks: ['lan'], input: 'ACCEPT', output: 'ACCEPT', forward: 'ACCEPT', masquerade: false },
      { name: 'wan', networks: ['wan', 'wan6'], input: 'REJECT', output: 'ACCEPT', forward: 'REJECT', masquerade: true },
      { name: 'guest', networks: ['guest'], input: 'REJECT', output: 'ACCEPT', forward: 'REJECT', masquerade: false },
    ],
    forwardings: [{ src: 'lan', dest: 'wan' }, { src: 'guest', dest: 'wan' }],
  },
  firewall_rules: {
    rules: [
      { name: 'Office to internet', enabled: true, src: 'lan', dest: 'wan', proto: 'any', target: 'ACCEPT', exposesWan: false },
      { name: 'Keep guests off the office', enabled: true, src: 'guest', dest: 'lan', proto: 'any', target: 'REJECT', exposesWan: false },
    ],
  },
  firewall_redirects: { redirects: [] },
  wifi: {
    country: 'TR',
    radios: [{ band: '2g', channel: 'auto', width: 'HT20' }, { band: '5g', channel: 36, width: 'VHT80' }],
    ssids: [
      { ssid: 'Office', band: '2g', security: 'wpa2-psk', key: { set: true }, hidden: false, isolate: false },
      { ssid: 'Office-5G', band: '5g', security: 'wpa3-sae', key: { set: true }, hidden: false, isolate: false },
    ],
  },
  lte: {
    apns: [{ name: 'Internet', apn: 'internet', auth: 'none', ipType: 'ipv4v6' }],
    activeApn: 'Internet',
    bands: [1, 3, 7, 20],
    mode: 'auto',
    roamingGuard: true,
  },
};

const CLASS_RANK: SettingClass[] = ['read', 'operate', 'admin', 'dangerous'];
function classAt(schema: SettingsSchemaNode, path: string): SettingClass {
  let cls: SettingClass = annotationsOf(schema).class ?? 'admin';
  const segs = pathOf(path);
  for (let i = 1; i <= segs.length; i++) {
    const n = schemaAt(schema, segs.slice(0, i));
    if (!n) return 'dangerous';
    cls = annotationsOf(n).class ?? cls;
  }
  return cls;
}

/** A desired document as the platform shows it: a secret is `{ set: true }`. */
function masked(schema: SettingsSchemaNode, values: Record<string, unknown>): Record<string, unknown> {
  const out = structuredClone(values);
  for (const p of secretPaths(schema, out)) {
    let cur = out as Record<string | number, unknown>;
    for (let i = 0; i < p.length - 1; i++) cur = cur[p[i] as never] as Record<string | number, unknown>;
    cur[p[p.length - 1] as never] = { set: true };
  }
  return out;
}

function makeSection(id: string, doc: Record<string, unknown>): SettingsSection {
  return {
    section: id, title: DEMO_SETTINGS_MANIFEST.sections[id].title ?? null, class: annotationsOf(DEMO_SETTINGS_MANIFEST.sections[id].schema).class ?? 'admin',
    manifestHash: DEMO_SETTINGS_MANIFEST.hash, manifestCurrent: true, state: 'applied', desiredRev: 1, desired: structuredClone(doc), reportedRev: 1,
    reported: structuredClone(doc), reportedState: 'applied', origin: 'cloud', error: null, appliedAt: now(), drift: false, pendingSince: null, expiresAt: null,
  };
}

export function createDemoSettingsAdapter(opts: { latencyMs?: number; applyMs?: number; devices?: Partial<DemoSettingsDevices> } = {}): DeviceSettingsAdapter {
  const { router: DEMO_SETTINGS_ROUTER, unsupported: UNSUPPORTED, unknown: UNKNOWN } = { ...DEFAULT_DEVICES, ...opts.devices };
  const latency = opts.latencyMs ?? 150;
  const applyMs = opts.applyMs ?? 3000;
  const sections = new Map(Object.entries(SEED).map(([id, doc]) => [id, makeSection(id, doc)]));
  // drift: someone added a rule on the router itself
  const rules = sections.get('firewall_rules')!;
  rules.reported = { rules: [...(rules.reported!.rules as unknown[]), { name: 'Camera viewer', enabled: true, src: 'wan', proto: 'tcp', destPort: 8554, target: 'ACCEPT', exposesWan: true }] };
  rules.drift = true;
  rules.origin = 'local';
  let seq = 0;
  const history: SettingsHistoryEntry[] = [...sections.keys()].map((s) => ({ id: `h${++seq}`, section: s, at: now(), kind: 'applied', rev: 1, actor: null, detail: {} }));
  history.push({ id: `h${++seq}`, section: 'firewall_rules', at: now(), kind: 'local', rev: 2, actor: null, detail: {} });

  const settle = (id: string, rev: number) => {
    const s = sections.get(id)!;
    const connectivity = !!annotationsOf(DEMO_SETTINGS_MANIFEST.sections[id].schema).connectivity;
    if (connectivity) {
      setTimeout(() => {
        if (s.desiredRev !== rev) return;
        s.state = 'confirming';
        history.unshift({ id: `h${++seq}`, section: id, at: now(), kind: 'confirming', rev, actor: null, detail: {} });
      }, applyMs / 3);
    }
    setTimeout(() => {
      if (s.desiredRev !== rev) return;
      Object.assign(s, { state: 'applied', reported: structuredClone(s.desired), reportedRev: rev, reportedState: 'applied', origin: 'cloud', appliedAt: now(), drift: false, pendingSince: null });
      history.unshift({ id: `h${++seq}`, section: id, at: now(), kind: 'applied', rev, actor: null, detail: {} });
    }, applyMs);
  };

  const view = (deviceId: string): DeviceSettings => {
    if (deviceId === UNSUPPORTED) return { deviceId, model: 'Nexus S200', fw: 'v2.4.1', supported: false, reason: 'settings_unsupported', writable: false, sections: [] };
    if (deviceId === UNKNOWN) return { deviceId, model: 'roltek-520', fw: '0.3.2-beta', supported: false, reason: 'manifest_unknown', writable: false, sections: [] };
    if (deviceId !== DEMO_SETTINGS_ROUTER) throw new SettingsApiError('This device does not take settings by section.', 409, { reason: 'settings_unsupported' });
    return {
      deviceId, model: DEMO_SETTINGS_MANIFEST.model, fw: DEMO_SETTINGS_MANIFEST.fw, supported: true,
      manifest: { hash: DEMO_SETTINGS_MANIFEST.hash, verified: true, released: DEMO_SETTINGS_MANIFEST.released }, writable: true,
      sections: [...sections.values()].map((s) => structuredClone(s)), viewer: { classes: ['operate', 'admin', 'dangerous'] },
    };
  };

  return {
    async read(deviceId) {
      await sleep(latency);
      return deviceId === DEMO_SETTINGS_ROUTER || deviceId === UNSUPPORTED || deviceId === UNKNOWN
        ? view(deviceId)
        : { deviceId, model: null, fw: null, supported: false, reason: 'settings_unsupported', writable: false, sections: [] };
    },
    async schema() {
      await sleep(latency);
      return structuredClone(DEMO_SETTINGS_MANIFEST);
    },
    async history(_deviceId, q) {
      await sleep(latency);
      const rows = history.filter((h) => !q.section || h.section === q.section);
      const sorted = q.dir === 'asc' ? [...rows].reverse() : rows;
      return { data: sorted.slice(q.page * q.pageSize, (q.page + 1) * q.pageSize), total: rows.length };
    },
    async write(_deviceId, id, input) {
      await sleep(latency);
      const s = sections.get(id);
      const schema = DEMO_SETTINGS_MANIFEST.sections[id]?.schema;
      if (!s || !schema) throw new SettingsApiError('This device has no such settings section.', 404, { reason: 'section_unknown' });
      if (input.ifMatch !== s.desiredRev) throw new SettingsApiError('The section changed since it was read.', 412, { reason: 'rev_mismatch' });
      const issues = validateValues(schema, input.values);
      if (issues.length) throw new SettingsApiError('Some values do not fit the device.', 422, { reason: 'invalid_values', issues });
      // a value only the device can change keeps the device's
      const values = structuredClone(input.values);
      for (const [k, p] of Object.entries(schema.properties ?? {})) if (annotationsOf(p).remote === false && s.reported?.[k] !== undefined) values[k] = s.reported[k];
      const next = masked(schema, values);
      const changes = differences(schema, s.desired, next).map((d) => ({ path: d.path, ...(d.sensitive ? { sensitive: true as const } : { before: d.desired, after: d.reported }) }));
      for (const p of secretPaths(schema, values)) {
        const v = valueAt(values, p);
        if (typeof v === 'string') changes.push({ path: p.join('.'), sensitive: true });
      }
      const cls = changes.reduce<SettingClass>((acc, c) => (CLASS_RANK.indexOf(classAt(schema, c.path)) > CLASS_RANK.indexOf(acc) ? classAt(schema, c.path) : acc), 'operate');
      const dangerous = changes.some((c) => classAt(schema, c.path) === 'dangerous');
      if (!changes.length && s.state === 'applied' && !s.drift) return { section: id, rev: s.desiredRev, state: s.state, delivered: true, manifestHash: DEMO_SETTINGS_MANIFEST.hash, manifestVerified: true, unchanged: true };
      if (input.dryRun) return { dryRun: true, section: id, rev: s.desiredRev + 1, class: cls, paths: changes, needsConfirm: dangerous, secrets: 0, manifestHash: DEMO_SETTINGS_MANIFEST.hash };
      if (dangerous && !input.confirm) throw new SettingsApiError('Confirm it to go on.', 422, { reason: 'confirm_required' });
      const rev = s.desiredRev + 1;
      Object.assign(s, { desired: next, desiredRev: rev, state: 'pending', drift: false, pendingSince: now() });
      history.unshift({ id: `h${++seq}`, section: id, at: now(), kind: 'desired', rev, actor: 'user:demo', detail: { changes } });
      settle(id, rev);
      return { section: id, rev, state: 'pending', delivered: true, manifestHash: DEMO_SETTINGS_MANIFEST.hash, manifestVerified: true };
    },
    async reapply(_deviceId, id, input) {
      await sleep(latency);
      const s = sections.get(id);
      if (!s?.desired) throw new SettingsApiError('Nothing to send again.', 409, { reason: 'nothing_desired' });
      if (input.ifMatch !== s.desiredRev) throw new SettingsApiError('The section changed since it was read.', 412, { reason: 'rev_mismatch' });
      const schema = DEMO_SETTINGS_MANIFEST.sections[id].schema;
      const dangerous = differences(schema, s.reported, s.desired).some((d) => classAt(schema, d.path) === 'dangerous');
      if (dangerous && !input.confirm) throw new SettingsApiError('Confirm it to go on.', 422, { reason: 'confirm_required' });
      const rev = s.desiredRev + 1;
      Object.assign(s, { desiredRev: rev, state: 'pending', drift: false, pendingSince: now() });
      history.unshift({ id: `h${++seq}`, section: id, at: now(), kind: 'desired', rev, actor: 'user:demo', detail: { reapply: true } });
      settle(id, rev);
      return { section: id, rev, state: 'pending', delivered: true, manifestHash: DEMO_SETTINGS_MANIFEST.hash, manifestVerified: true };
    },
  };
}

// ── The fleet: baselines and jobs over 25 shop routers ───────────────────────────────────────────────────────────────────

const FLEET: SettingsDeviceOption[] = Array.from({ length: 25 }, (_, i) => ({ deviceId: `demo-router-${String(i + 1).padStart(2, '0')}`, name: `Shop ${String(i + 1).padStart(2, '0')} router`, model: 'roltek-420' }));
const WAVE_MS = 6000;

const emptyCounters = (): SettingsWaveCounters => ({ queued: 0, sent: 0, applied: 0, reverted: 0, rejected: 0, skipped: 0, offline: 0, superseded: 0, total: 0 });

export function createDemoFleetAdapter(opts: { latencyMs?: number; canManage?: boolean; seedJob?: boolean } = {}): SettingsFleetAdapter {
  const canManage = opts.canManage ?? true;
  const latency = opts.latencyMs ?? 150;
  const baselines = new Map<string, SettingsBaseline>();
  const seedBaseline: SettingsBaseline = {
    baselineId: 'b-shops', name: 'Shop Wi-Fi', description: 'The Wi-Fi every shop runs.', models: ['roltek-420'],
    sections: { wifi: { ssids: [{ ssid: 'Shop', band: '2g', security: 'wpa2-psk', hidden: false, isolate: true }] } }, driftPolicy: 'REPORT', offlineExpiryDays: 7,
    createdBy: 'demo', createdAt: now(), updatedAt: now(),
  };
  baselines.set(seedBaseline.baselineId, seedBaseline);
  const jobs = new Map<string, { job: SettingsJob; targets: SettingsJobTarget[]; startedAt: number; pausedFor: number; pausedAt: number | null }>();
  let n = 0;

  /** Moves a job on with the clock: a wave every few seconds, one device of the second wave gives its change back. */
  const advance = (id: string) => {
    const j = jobs.get(id)!;
    if (j.job.state !== 'running') return;
    const elapsed = Date.now() - j.startedAt - j.pausedFor;
    const reached = Math.min(j.job.waveSizes.length - 1, Math.floor(elapsed / WAVE_MS));
    for (const t of j.targets) {
      if (t.wave > reached || t.state === 'applied' || t.state === 'reverted') continue;
      const done = elapsed > (t.wave + 0.6) * WAVE_MS;
      t.state = done ? (t.wave === 1 && t.deviceId.endsWith('07') ? 'reverted' : 'applied') : 'sent';
      t.sentAt = t.sentAt ?? Date.now();
      t.detail = { wifi: { rev: 2, outcome: t.state === 'sent' ? 'waiting' : t.state } };
    }
    j.job.currentWave = reached;
    if (elapsed > j.job.waveSizes.length * WAVE_MS) { j.job.state = 'completed'; j.job.finishedAt = Date.now(); }
  };
  const countersOf = (targets: SettingsJobTarget[]) => {
    const c = emptyCounters();
    for (const t of targets) { c[t.state as SettingsTargetState] += 1; c.total += 1; }
    return c;
  };

  const adapter: SettingsFleetAdapter = {
    async models() { await sleep(latency); return [{ model: 'roltek-420', devices: FLEET.length + 1, firmwares: ['1.4.2'], manifest: { hash: DEMO_SETTINGS_MANIFEST.hash, fw: '1.4.2', released: '2026-10-01', verified: true } }]; },
    async modelSchema() { await sleep(latency); return structuredClone(DEMO_SETTINGS_MANIFEST); },
    async profiles() { await sleep(latency); return [{ id: 'p-routers', name: 'Roltek routers' }]; },
    async devices(q) {
      await sleep(latency);
      const rows = FLEET.filter((d) => !q.search || d.name.toLowerCase().includes(q.search.toLowerCase()));
      return { data: rows.slice(q.page * q.pageSize, (q.page + 1) * q.pageSize), total: rows.length };
    },
    baselines: {
      async list(q) {
        await sleep(latency);
        const rows = [...baselines.values()].filter((b) => !q.search || b.name.toLowerCase().includes(q.search.toLowerCase())).sort((a, b) => (q.dir === 'desc' ? -1 : 1) * a.name.localeCompare(b.name));
        return { data: rows.slice(q.page * q.pageSize, (q.page + 1) * q.pageSize), total: rows.length, canManage };
      },
      async get(id) { await sleep(latency); const b = baselines.get(id); if (!b) throw new SettingsApiError('Baseline not found.', 404, { reason: 'baseline_not_found' }); return structuredClone(b); },
      async create(input) {
        await sleep(latency);
        if ([...baselines.values()].some((b) => b.name === input.name)) throw new SettingsApiError('Name taken.', 409, { reason: 'name_taken' });
        const b: SettingsBaseline = { ...structuredClone(input), baselineId: `b-${++n}`, createdBy: 'demo', createdAt: now(), updatedAt: now() };
        baselines.set(b.baselineId, b);
        return b;
      },
      async update(id, input) {
        await sleep(latency);
        const cur = baselines.get(id);
        if (!cur) throw new SettingsApiError('Baseline not found.', 404, { reason: 'baseline_not_found' });
        const b = { ...cur, ...structuredClone(input), updatedAt: now() };
        baselines.set(id, b);
        return b;
      },
      async remove(id) { await sleep(latency); baselines.delete(id); },
    },
    jobs: {
      async list(q) {
        await sleep(latency);
        for (const id of jobs.keys()) advance(id);
        const rows = [...jobs.values()].map((j) => j.job).filter((j) => !q.state?.length || q.state.includes(j.state)).sort((a, b) => (q.dir === 'asc' ? 1 : -1) * (a.createdAt - b.createdAt));
        return { data: rows.slice(q.page * q.pageSize, (q.page + 1) * q.pageSize).map((j) => structuredClone(j)), total: rows.length, canManage };
      },
      async get(id) {
        await sleep(latency);
        const j = jobs.get(id);
        if (!j) throw new SettingsApiError('Job not found.', 404, { reason: 'job_not_found' });
        advance(id);
        const waves = j.job.waveSizes.map((size, wave) => {
          const counters = countersOf(j.targets.filter((t) => t.wave === wave));
          const settled = counters.queued + counters.sent === 0 && counters.total > 0;
          return { wave, size, counters, verdict: settled ? ('ok' as const) : null, overridden: false };
        });
        return { job: structuredClone(j.job), waves, totals: countersOf(j.targets), canManage };
      },
      async targets(id, q) {
        await sleep(latency);
        const j = jobs.get(id);
        if (!j) throw new SettingsApiError('Job not found.', 404, { reason: 'job_not_found' });
        advance(id);
        const rows = j.targets.filter((t) => (!q.state?.length || q.state.includes(t.state)) && (!q.wave?.length || q.wave.includes(t.wave)));
        const sorted = q.dir === 'desc' ? [...rows].reverse() : rows;
        return { data: sorted.slice(q.page * q.pageSize, (q.page + 1) * q.pageSize).map((t) => structuredClone(t)), total: rows.length };
      },
      async create(input, o) {
        await sleep(latency);
        const picked = input.selector.deviceIds?.length ? FLEET.filter((d) => input.selector.deviceIds!.includes(d.deviceId)) : FLEET;
        if (!picked.length) throw new SettingsApiError('No device matches.', 422, { reason: 'no_devices' });
        const percents = input.waves && 'percent' in input.waves ? input.waves.percent : [1, 10];
        const sizes: number[] = [];
        let left = picked.length;
        for (const p of percents) { if (left <= 0) break; const take = Math.min(left, Math.max(1, Math.ceil((picked.length * p) / 100))); sizes.push(take); left -= take; }
        if (left > 0) sizes.push(left);
        if (o.dryRun) {
          return { dryRun: true, plan: { devices: picked.length, excludedByModel: 0, skipped: 0, waveSizes: sizes, coverage: [{ model: 'roltek-420', fw: '1.4.2', devices: picked.length, manifestKnown: true, sections: { wifi: { class: 'admin', paths: 6 } }, needsConfirm: false }], needsConfirm: false } };
        }
        const jobId = `job-${++n}`;
        let i = 0;
        const targets: SettingsJobTarget[] = [];
        sizes.forEach((size, wave) => { for (let k = 0; k < size; k++, i++) targets.push({ deviceId: picked[i].deviceId, name: picked[i].name, model: picked[i].model, wave, state: 'queued', detail: {}, sentAt: null }); });
        const job: SettingsJob = {
          jobId, name: input.name, baselineId: input.baselineId ?? null, sections: baselines.get(input.baselineId ?? '')?.sections ?? {}, selector: input.selector,
          waveSizes: sizes, gates: { minApplied: input.gates?.minApplied ?? 0.95, maxReverted: input.gates?.maxReverted ?? 0.01 }, onConflict: input.onConflict ?? 'queue',
          offlineExpiryDays: 7, waveTimeoutMin: 30, confirmDangerous: !!input.confirm, state: 'running', settling: false, pauseReason: null, currentWave: 0,
          waveStartedAt: Date.now(), createdBy: 'demo', createdAt: Date.now(), finishedAt: null,
        };
        jobs.set(jobId, { job, targets, startedAt: Date.now(), pausedFor: 0, pausedAt: null });
        return structuredClone(job);
      },
      async pause(id) { await sleep(latency); const j = jobs.get(id)!; advance(id); j.job.state = 'paused'; j.job.pauseReason = 'manual'; j.pausedAt = Date.now(); return structuredClone(j.job); },
      async resume(id) {
        await sleep(latency);
        const j = jobs.get(id)!;
        if (j.pausedAt) j.pausedFor += Date.now() - j.pausedAt;
        j.pausedAt = null;
        j.job.state = 'running';
        j.job.pauseReason = null;
        return structuredClone(j.job);
      },
      async cancel(id) {
        await sleep(latency);
        const j = jobs.get(id)!;
        advance(id);
        for (const t of j.targets) if (t.state === 'queued') { t.state = 'skipped'; t.detail = { wifi: { outcome: 'skipped', reason: 'cancelled' } }; }
        j.job.state = 'cancelled';
        j.job.finishedAt = Date.now();
        return structuredClone(j.job);
      },
    },
  };
  if (opts.seedJob ?? true) {
    void adapter.jobs.create({ name: 'Shop Wi-Fi to every shop', baselineId: seedBaseline.baselineId, selector: { models: ['roltek-420'] } }, {});
  }
  return adapter;
}

