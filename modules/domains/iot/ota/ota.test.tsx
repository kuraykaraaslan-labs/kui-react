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
