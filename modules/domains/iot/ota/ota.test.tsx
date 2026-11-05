import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDemoOtaAdapter } from './demo-ota';
import { FirmwareDetailView } from './FirmwareDetailView';
import { FirmwareListView } from './FirmwareListView';
import { compareOtaVersions } from './FirmwareUploadDrawer';
import { OTA_MESSAGES, flattenOtaMessages, otaMessagesFrom } from './messages';
import { OtaDevicePanel } from './OtaDevicePanel';
import { OtaStateBadge } from './OtaStateBadge';
import { previewLines } from './OtaAssignDrawer';
import { mergeOtaAttempts, shownRollouts } from './OtaRolloutView';
import { OtaRolloutPanel } from './OtaRolloutPanel';
import { defaultOtaWaves, otaWavesProblem, otaWavesForApi } from './OtaWavesEditor';

const CAN = { managePackages: true, assign: true, manageKeys: true };

describe('OTA views (iot-platform 06)', () => {
  it('shows WAITING as a neutral badge with the reason in words, never as an error', () => {
    render(<OtaStateBadge state="WAITING" waitReason="metered" />);
    const badge = screen.getByText(OTA_MESSAGES.wait.metered);
    expect(badge.closest('[data-ota-state]')?.getAttribute('data-ota-state')).toBe('WAITING');
    expect(badge.closest('[data-ota-state]')?.className).not.toMatch(/error/);
  });

  it('orders versions with digit runs as numbers (D237)', () => {
    expect(compareOtaVersions('24.10.0-r1234', '24.9.1')).toBe(1);
    expect(compareOtaVersions('1.4.2', '1.4.10')).toBe(-1);
    expect(compareOtaVersions('2.0', '2.0')).toBe(0);
  });

  it('puts a dry run into plain lines, skipped devices by reason', () => {
    const { lines, skipped } = previewLines(OTA_MESSAGES, { devices: 4, offline: 1, alreadyOnTarget: 1, incompatible: { profile_mismatch: 2 } });
    expect(lines).toEqual(['4 devices are covered.', '1 are offline now; they update when they come online.', '1 already run this version.']);
    expect(skipped).toEqual([{ reason: OTA_MESSAGES.block.profile_mismatch, n: 2 }]);
  });

  it('builds every text from a host dictionary', () => {
    const keys = Object.keys(flattenOtaMessages());
    const m = otaMessagesFrom((k) => `T:${k}`);
    expect(keys.length).toBeGreaterThan(200);
    expect(m.wait.approval).toBe('T:wait.approval');
  });

  it('lists the packages with their status and opens upload and signing keys from the header', async () => {
    const adapter = createDemoOtaAdapter({ delayMs: 0 });
    render(<FirmwareListView adapter={adapter} can={CAN} packageHref={(id) => `/p/${id}`} />);
    expect(await screen.findByText('24.10.1-r1234')).toBeTruthy();
    expect(screen.getAllByText(OTA_MESSAGES.status.READY).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: OTA_MESSAGES.list.keys }));
    expect(await screen.findByText('Roltek build 2026')).toBeTruthy();
  });

  it('assigns a package through a dry run and the ConfirmDialog', async () => {
    const adapter = createDemoOtaAdapter({ delayMs: 0 });
    render(<FirmwareDetailView adapter={adapter} packageId="pkg-2" can={CAN} />);
    await userEvent.click(await screen.findByRole('button', { name: OTA_MESSAGES.detail.assign }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(drawer).getByLabelText(OTA_MESSAGES.assign.to), 'DEVICE');
    await userEvent.click(await within(drawer).findByRole('checkbox', { name: /Tank level controller/ }));
    await userEvent.click(within(drawer).getByRole('button', { name: OTA_MESSAGES.assign.check }));
    expect(await within(drawer).findByText('1 devices are covered.')).toBeTruthy();
    expect(within(drawer).getByText(`${OTA_MESSAGES.block.profile_mismatch}: 1`)).toBeTruthy();
    await userEvent.click(within(drawer).getByRole('button', { name: OTA_MESSAGES.assign.submit }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    expect(within(confirm).getByText(/Send roltek-rut-fw 24.10.1-r1234 to 1 devices\?/)).toBeTruthy();
  });

  it('keeps an LTE device waiting until updates over LTE are allowed for it, asking first (OD-7)', async () => {
    const adapter = createDemoOtaAdapter({ delayMs: 0 });
    adapter.step();
    adapter.step();
    render(<OtaDevicePanel adapter={adapter} deviceId="d-3" deviceName="Valve station (LTE)" can={CAN} pollMs={0} />);
    expect(await screen.findByText(OTA_MESSAGES.wait.metered)).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText(OTA_MESSAGES.device.meteredLabel), 'on');
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(confirm).getByRole('button', { name: OTA_MESSAGES.device.meteredOn }));
    await waitFor(async () => expect((await adapter.settings.get('device', 'd-3')).stored.allowMetered).toBe(true));
    adapter.step();
    expect((await adapter.device('d-3')).attempt?.state).toBe('DOWNLOADING');
  });
});

describe('rollouts in waves (NB iot_ota 03)', () => {
  it('the usual plan is a small canary, 10 %, 50 % and the rest; a broken plan is put into words; the last wave goes to the API as the rest', () => {
    const plan = defaultOtaWaves(500);
    expect(plan.map((w) => w.size)).toEqual([{ count: 5 }, { percent: 10 }, { percent: 50 }, { percent: 100 }]);
    expect(otaWavesProblem(OTA_MESSAGES, plan)).toBeNull();
    expect(otaWavesProblem(OTA_MESSAGES, [{ ...plan[0]!, size: { percent: 0 } }, plan[3]!])).toContain(OTA_MESSAGES.waves.problemSize);
    expect(otaWavesProblem(OTA_MESSAGES, [{ ...plan[0]!, maxDurationMin: 1 }])).toContain(OTA_MESSAGES.waves.problemDuration);
    expect(otaWavesProblem(OTA_MESSAGES, [{ ...plan[0]!, maxFailurePct: Number.NaN }])).toContain(OTA_MESSAGES.waves.problemPct);
    expect(otaWavesForApi([plan[0]!, { ...plan[1]!, size: { count: 3 } }]).at(-1)!.size).toEqual({ percent: 100 });
  });

  it('merges the changed devices of a live event into the table and keeps the newest ended rollout with the running ones', () => {
    const base = { packageId: 'p', assignmentId: null, waitReason: null, fromVersion: '1', toVersion: '2', fwError: null, attempts: 1, progress: null, stateChangedAt: '2026-01-01T00:00:00Z', startedAt: null, finishedAt: null } as const;
    const rows = [{ ...base, deviceId: 'a', deviceName: 'A', state: 'QUEUED' as const }];
    const merged = mergeOtaAttempts(rows, [{ ...base, deviceId: 'a', state: 'DOWNLOADING' }, { ...base, deviceId: 'b', state: 'INITIATED' }, { ...base, packageId: 'x', deviceId: 'c', state: 'UPDATED' }], 'p');
    expect(merged.map((r) => [r.deviceId, r.state, r.deviceName ?? null])).toEqual([['b', 'INITIATED', null], ['a', 'DOWNLOADING', 'A']]);
    const ro = (id: string, status: 'RUNNING' | 'COMPLETED' | 'ABORTED', finishedAt: string | null) => ({ rolloutId: id, status, finishedAt, createdAt: '2026-01-01T00:00:00Z' }) as never;
    expect(shownRollouts([ro('old', 'COMPLETED', '2026-01-02T00:00:00Z'), ro('run', 'RUNNING', null), ro('new', 'ABORTED', '2026-01-03T00:00:00Z')]).map((r: { rolloutId: string }) => r.rolloutId)).toEqual(['run', 'new']);
  });

  it('sends a profile in waves: only the canary gets the update first, the plan shows in the check, and the waves follow on the package page', async () => {
    const adapter = createDemoOtaAdapter({ delayMs: 0 });
    render(<FirmwareDetailView adapter={adapter} packageId="pkg-2" can={CAN} />);
    await userEvent.click(await screen.findByRole('button', { name: OTA_MESSAGES.detail.assign }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(drawer).getByLabelText(OTA_MESSAGES.assign.profile), 'p-rut');
    await userEvent.click(within(drawer).getByRole('checkbox', { name: OTA_MESSAGES.waves.toggle }));
    expect(within(drawer).getByRole('region', { name: OTA_MESSAGES.waves.editorTitle })).toBeTruthy();
    // two waves: one device, then the rest
    for (const n of [3, 2]) await userEvent.click(within(drawer).getByRole('button', { name: `Remove wave ${n}` }));
    await userEvent.click(within(drawer).getByRole('button', { name: OTA_MESSAGES.assign.check }));
    expect(await within(drawer).findByText('In waves: wave 1 1, wave 2 3.')).toBeTruthy();
    await userEvent.click(within(drawer).getByRole('button', { name: OTA_MESSAGES.assign.submit }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(confirm).getByRole('button', { name: OTA_MESSAGES.assign.submit }));
    const panel = await screen.findByRole('region', { name: OTA_MESSAGES.waves.title });
    expect(within(panel).getByText(/Wave 1 of 2/)).toBeTruthy();
    const states = (await adapter.attempts({ packageId: 'pkg-2' })).filter((a) => a.rolloutId);
    expect(states.filter((a) => a.state === 'INITIATED')).toHaveLength(1);
    expect(states.filter((a) => a.state === 'QUEUED' && a.wave === 1)).toHaveLength(3);
  });

  it('pauses, resumes and aborts a rollout only through the ConfirmDialog', async () => {
    const adapter = createDemoOtaAdapter({ delayMs: 0 });
    await adapter.assignments.create('pkg-2', { targetType: 'PROFILE', targetId: 'p-rut' }, { waves: [{ ...defaultOtaWaves()[0]! }, { ...defaultOtaWaves()[3]! }] });
    const [r] = await adapter.rollouts!.list({ packageId: 'pkg-2' });
    render(<OtaRolloutPanel adapter={adapter} rollout={r!} title="roltek-rut-fw" version="24.10.1-r1234" canAct />);
    await userEvent.click(screen.getByRole('button', { name: OTA_MESSAGES.waves.pause }));
    let confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    expect(within(confirm).getByText('Pause the rollout of roltek-rut-fw 24.10.1-r1234?')).toBeTruthy();
    expect((await adapter.rollouts!.list({ packageId: 'pkg-2' }))[0]!.status).toBe('RUNNING');
    await userEvent.click(within(confirm).getByRole('button', { name: OTA_MESSAGES.waves.pause }));
    await waitFor(async () => expect((await adapter.rollouts!.list({ packageId: 'pkg-2' }))[0]!.status).toBe('PAUSED'));
    await userEvent.click(screen.getByRole('button', { name: OTA_MESSAGES.waves.abort }));
    confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(confirm).getByRole('button', { name: OTA_MESSAGES.waves.abort }));
    await waitFor(async () => expect((await adapter.rollouts!.list({ packageId: 'pkg-2' }))[0]!.status).toBe('ABORTED'));
  });

  it('a wave whose failures pass the limit pauses the rollout and the panel says why', async () => {
    const adapter = createDemoOtaAdapter({ delayMs: 0 });
    // the reservoir router fails once at verify: as the only device of the first wave it is 100 % failed
    await adapter.assignments.create('pkg-2', { targetType: 'GROUP', deviceIds: ['d-2', 'd-1'] }, { waves: [{ ...defaultOtaWaves()[0]!, size: { count: 1 } }, defaultOtaWaves()[3]!] });
    const first = (await adapter.attempts({ packageId: 'pkg-2' })).find((a) => a.rolloutId && a.wave === 0)!;
    expect(first.deviceId).toBe('d-2');
    for (let i = 0; i < 6; i += 1) adapter.step();
    const [r] = await adapter.rollouts!.list({ packageId: 'pkg-2' });
    expect(r).toMatchObject({ status: 'PAUSED', pausedReason: 'failure_gate' });
    render(<OtaRolloutPanel adapter={adapter} rollout={r!} title="t" version="v" canAct />);
    expect(screen.getByText(`Paused: ${OTA_MESSAGES.pauseReason.failure_gate}.`)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: OTA_MESSAGES.waves.resume }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    expect(within(confirm).getByText(/Resuming accepts what happened so far/)).toBeTruthy();
  });
});
