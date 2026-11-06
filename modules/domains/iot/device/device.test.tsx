import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeviceOnlineDot } from './DeviceOnlineDot';
import { DeviceConnectionBadge } from './DeviceConnectionBadge';
import { DeviceDetailHeader } from './DeviceDetailHeader';
import { DeviceCredentialPanel, IssuedSecretNotice } from './DeviceCredentialPanel';
import { connectionCommands, examplePayload } from './DeviceConnectionCard';
import { DeviceAttributeTable, parseValue, valueToText } from './DeviceAttributeTable';
import { DesiredReportedBadge } from './DesiredReportedBadge';
import { DeviceConnectionTimeline } from './DeviceConnectionTimeline';
import { DeviceTable, formatKeyValue } from './DeviceTable';
import { DeviceStatusBadge } from './DeviceStatusBadge';
import { DeviceAddress } from './DeviceAddress';
import { applyStatePatch } from './DeviceListView';
import { onlineStateOf, type DeviceRecord } from '../types/device';
import { formatRelative, fill } from '../format';

const NOW = new Date('2026-10-24T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms);
const MIN = 60_000;

const DEVICE: DeviceRecord = {
  deviceId: 'd1', name: 'Pump 4', label: 'Hall 2', serial: 'RT-1', deviceProfileId: 'p1', profileName: 'Pumps', status: 'ACTIVE',
  isGateway: true, fwTitle: 'esp32', fwVersion: '1.8.2', protocolMajor: 1, online: false, lastActivityAt: ago(5 * MIN), lastDisconnectReason: 'keepalive_timeout',
};

describe('format helpers', () => {
  it('formats relative times and fills placeholders', () => {
    expect(formatRelative(ago(5 * MIN), { locale: 'en', now: NOW })).toMatch(/5 min/);
    expect(formatRelative(null, { fallback: 'never' })).toBe('never');
    expect(fill('{n} of {m} {x}', { n: 1, m: 2 })).toBe('1 of 2 {x}');
    expect(onlineStateOf(true)).toBe('ONLINE');
    expect(onlineStateOf(false)).toBe('OFFLINE');
    expect(onlineStateOf(null)).toBe('LAST_SEEN');
  });
});

describe('DeviceOnlineDot', () => {
  it('draws online, offline with last seen, never connected, last seen only, and stale', () => {
    const { rerender, container } = render(<DeviceOnlineDot state="ONLINE" lastSeenAt={ago(MIN)} now={NOW} />);
    expect(screen.getByText('Online')).toBeInTheDocument();
    rerender(<DeviceOnlineDot state="OFFLINE" lastSeenAt={ago(5 * MIN)} now={NOW} locale="en" />);
    expect(screen.getByText(/Offline · Last seen 5 min/)).toBeInTheDocument();
    rerender(<DeviceOnlineDot state="OFFLINE" now={NOW} />);
    expect(screen.getByText('Offline · Never connected')).toBeInTheDocument();
    rerender(<DeviceOnlineDot state="LAST_SEEN" lastSeenAt={ago(3 * 3_600_000)} now={NOW} locale="en" />);
    expect(container.querySelector('[data-look="lastSeen"]')).not.toBeNull();
    expect(screen.queryByText(/Offline/)).toBeNull();
    rerender(<DeviceOnlineDot state="ONLINE" lastSeenAt={ago(20 * MIN)} staleAfterSeconds={600} now={NOW} locale="en" />);
    expect(container.querySelector('[data-look="stale"]')).not.toBeNull();
    // "Stale: last data 20 min. ago", never "no data for … ago" (NB 41-ui-fixes/21 1.20)
    expect(screen.getByText(/^Stale: last data 20 min/)).toBeInTheDocument();
  });
});

describe('DeviceConnectionBadge and DeviceStatusBadge (OD-1)', () => {
  it('puts the registry status first and follows the online rule', () => {
    const { rerender, container } = render(<DeviceConnectionBadge online status="QUARANTINED" />);
    expect(screen.getByText('Quarantined')).toBeInTheDocument();
    rerender(<DeviceConnectionBadge online={false} status="DISABLED" />);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    rerender(<DeviceConnectionBadge online={null} lastActivityAt={ago(MIN)} now={NOW} locale="en" />);
    expect(container.querySelector('[data-state="LAST_SEEN"]')).not.toBeNull();
    rerender(<DeviceConnectionBadge online={false} lastActivityAt={ago(MIN)} lastDisconnectReason="keepalive_timeout" now={NOW} />);
    // the reason code reads as words (NB 41-ui-fixes/21 1.21); one the kit does not know shows as it is
    expect(screen.getByRole('tooltip')).toHaveTextContent('Last disconnect: No keep-alive in time');
    rerender(<DeviceConnectionBadge online={false} lastActivityAt={ago(MIN)} lastDisconnectReason="brand_new_reason" now={NOW} />);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Last disconnect: brand_new_reason');
  });

  it('has a Quarantined state on the demo badge', () => {
    render(<DeviceStatusBadge status="QUARANTINED" />);
    expect(screen.getByText('Quarantined')).toHaveAttribute('title', expect.stringContaining('not stored'));
  });
});

describe('DeviceDetailHeader (OD-8)', () => {
  it('shows the device facts and only the host actions: no factory reset anywhere', () => {
    render(<DeviceDetailHeader device={DEVICE} profileHref="/p/p1" now={NOW} actions={<button type="button">Copy ID</button>} />);
    expect(screen.getByRole('heading', { name: 'Pump 4' })).toBeInTheDocument();
    expect(screen.getByText('Gateway')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pumps' })).toHaveAttribute('href', '/p/p1');
    expect(screen.getByText('esp32 1.8.2')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Copy ID']);
    expect(screen.queryByText(/factory reset/i)).toBeNull();
  });
});

describe('DeviceCredentialPanel', () => {
  it('shows a new secret masked, reveals and copies it, and lets it go', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onDismiss = vi.fn();
    render(<IssuedSecretNotice secret={{ token: 'SECRET-TOKEN-123' }} onDismiss={onDismiss} />);
    expect(screen.getByTestId('issued-secret')).not.toHaveTextContent('SECRET-TOKEN-123');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByTestId('issued-secret')).toHaveTextContent('SECRET-TOKEN-123');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('SECRET-TOKEN-123');
    await user.click(screen.getByRole('button', { name: 'I have stored it' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('UX-23: the connection details name the broker, the login, the topics and the HTTPS URL, with ready lines that carry the secret only while it is shown', async () => {
    const user = userEvent.setup();
    const info = { mqtt: { host: 'mqtt.example.com', port: 8883, tls: true }, httpBase: 'https://acme.example.com', telemetryKeys: [{ key: 'pressure', type: 'number' }, { key: 'running', type: 'boolean' }] };
    render(<IssuedSecretNotice secret={{ token: 'SECRET-TOKEN-123' }} connection={info} credentialType="ACCESS_TOKEN" />);
    const card = screen.getByRole('region', { name: 'Connection details' });
    expect(card).toHaveTextContent('mqtt.example.com:8883');
    expect(card).toHaveTextContent('Username = the access token, password empty');
    expect(card).toHaveTextContent('v1/telemetry');
    expect(card).toHaveTextContent('v1/rpc/req/+');
    expect(card).toHaveTextContent('POST https://acme.example.com/api/v1/telemetry');
    expect(card).toHaveTextContent('{"pressure":21.5,"running":true}');
    expect(card).not.toHaveTextContent('SECRET-TOKEN-123');
    expect(card).toHaveTextContent("mosquitto_pub -h mqtt.example.com -p 8883 --capath /etc/ssl/certs -u '<ACCESS_TOKEN>' -t v1/telemetry");
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(card).toHaveTextContent("-u 'SECRET-TOKEN-123'");
    expect(card).toHaveTextContent("-H 'Authorization: Bearer SECRET-TOKEN-123'");
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(card).not.toHaveTextContent('SECRET-TOKEN-123');

    // the Credentials tab without a fresh secret: the card under the credential, with placeholders; nothing without endpoints
    const { rerender } = render(<DeviceCredentialPanel credential={{ type: 'ACCESS_TOKEN' }} connection={{ mqtt: null, httpBase: 'https://acme.example.com' }} />);
    expect(screen.getAllByRole('region', { name: 'Connection details' })).toHaveLength(2);
    rerender(<DeviceCredentialPanel credential={{ type: 'ACCESS_TOKEN' }} connection={{}} />);
    expect(screen.getAllByRole('region', { name: 'Connection details' })).toHaveLength(1);
    expect(examplePayload([])).toBe('{"temperature":21.5}');
    const basic = connectionCommands({ info, credentialType: 'MQTT_BASIC', username: 'pump-4', clientId: 'c-1', placeholders: { token: '<T>', password: '<P>' } });
    expect(basic.mqtt).toContain("-i 'c-1' -u 'pump-4' -P '<P>'");
    expect(basic.http).toBeNull();
    expect(connectionCommands({ info, credentialType: 'X509_CERTIFICATE', placeholders: { token: '<T>', password: '<P>' } })).toEqual({ mqtt: null, http: null });
  });

  it('UX-23: names the topics of the device\'s profile (a Legacy profile has no command topics)', () => {
    const info = { mqtt: { host: 'mqtt.example.com', port: 8883, tls: true }, httpBase: null, topics: { telemetry: 'v1/devices/me/telemetry', attributes: 'v1/devices/me/attributes', rpcRequest: null } };
    render(<DeviceCredentialPanel credential={{ type: 'ACCESS_TOKEN' }} connection={info} />);
    const card = screen.getByRole('region', { name: 'Connection details' });
    expect(card).toHaveTextContent('v1/devices/me/attributes');
    expect(card).not.toHaveTextContent('v1/rpc/req/+');
    expect(card).not.toHaveTextContent('Commands');
    expect(card).toHaveTextContent("-t v1/devices/me/telemetry -m '{\"temperature\":21.5}'");
  });

  it('lists non-secret fields and rotates behind a confirmation; X.509 has no rotate', async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<DeviceCredentialPanel credential={{ type: 'MQTT_BASIC', username: 'pump-4', clientId: 'c-1' }} onRotate={onRotate} />);
    expect(screen.getByText('pump-4')).toBeInTheDocument();
    expect(screen.getByText('c-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rotate secret' }));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Rotate secret' }));
    await waitFor(() => expect(onRotate).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    rerender(<DeviceCredentialPanel credential={{ type: 'X509_CERTIFICATE', certFingerprint: 'ab'.repeat(32) }} onRotate={onRotate} />);
    expect(screen.queryByRole('button', { name: 'Rotate secret' })).toBeNull();
    expect(screen.getByText(/private key stays on the device/)).toBeInTheDocument();
    rerender(<DeviceCredentialPanel credential={null} />);
    expect(screen.getByText(/The device has no active credential/)).toBeInTheDocument();
  });
});

describe('DeviceAttributeTable', () => {
  it('parses and prints JSON values', () => {
    expect(parseValue('42')).toEqual({ ok: true, value: 42 });
    expect(parseValue('"on"')).toEqual({ ok: true, value: 'on' });
    expect(parseValue('on')).toEqual({ ok: false });
    expect(parseValue('null')).toEqual({ ok: false });
    expect(valueToText({ a: 1 })).toContain('"a": 1');
  });

  it('opens a scope lazily, refuses invalid JSON before any request, saves a valid value, hides secrets', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onScopeOpen = vi.fn();
    render(
      <DeviceAttributeTable
        defaultScope="SHARED"
        canWrite
        onSave={onSave}
        onScopeOpen={onScopeOpen}
        entries={{ SHARED: [{ key: 'cfg.speed', value: 10, sync: 'pending' }, { key: 'cfg.psk', value: null, secret: true }] }}
        now={NOW}
      />,
    );
    expect(onScopeOpen).toHaveBeenCalledWith('SHARED');
    expect(onScopeOpen).not.toHaveBeenCalledWith('CLIENT');
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Write-only')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit cfg.speed' }));
    const box = screen.getByLabelText('Value');
    await user.clear(box);
    await user.type(box, 'fast');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Not valid JSON/)).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('SHARED', 'cfg.speed', 20));
  });

  it('keeps the client scope read-only', async () => {
    const user = userEvent.setup();
    render(<DeviceAttributeTable canWrite onSave={vi.fn()} entries={{ CLIENT: [{ key: 'fw', value: '1.0' }] }} />);
    await user.click(screen.getByRole('tab', { name: /Client/ }));
    expect(screen.getByText(/reported by the device/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add attribute' })).toBeNull();
  });
});

describe('DesiredReportedBadge and DeviceConnectionTimeline', () => {
  it('names the sync states', () => {
    render(<><DesiredReportedBadge state="in_sync" /><DesiredReportedBadge state="rejected" reason="out_of_range" /></>);
    expect(screen.getByText('In sync')).toBeInTheDocument();
    expect(screen.getByText('Reason: out_of_range')).toBeInTheDocument();
  });

  it('lists connection events with reasons and pages', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <DeviceConnectionTimeline
        hasMore
        onLoadMore={onLoadMore}
        events={[
          { id: '1', at: ago(MIN), kind: 'disconnected', reason: 'keepalive_timeout', transport: 'mqtts', remoteIp: '203.0.113.7' },
          { id: '2', at: ago(2 * MIN), kind: 'connected' },
          { id: '3', at: ago(3 * MIN), kind: 'brand_new_kind' },
        ]}
      />,
    );
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText(/Reason: keepalive_timeout · via mqtts · from 203.0.113.7/)).toBeInTheDocument();
    expect(screen.getByText('Connection event')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});

describe('DeviceTable', () => {
  it('formats key values with unit and decimals', () => {
    expect(formatKeyValue(61.376, { key: 't', unit: '°C', decimals: 1 }, 'en')).toBe('61.4 °C');
    expect(formatKeyValue(null, { key: 't' })).toBe('—');
    expect(formatKeyValue(true, { key: 'on' })).toBe('1');
    expect(formatKeyValue({ a: 1 }, { key: 'x' })).toBe('{"a":1}');
  });

  it('draws the connection, the key columns, the quarantined badge, and reports a row click', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DeviceTable
        now={NOW}
        locale="en"
        onRowClick={onRowClick}
        keyColumns={[{ key: 'temperature', label: 'Temp', unit: '°C', decimals: 1 }]}
        staleAfterSeconds={600}
        rows={[
          { id: 'd1', name: 'Pump 4', online: true, lastSeenAt: ago(20 * MIN), values: { temperature: 61.37 } },
          { id: 'd2', name: 'Probe', status: 'QUARANTINED', online: true },
        ]}
      />,
    );
    expect(screen.getByText('61.4 °C')).toBeInTheDocument();
    expect(screen.getByText(/Stale/)).toBeInTheDocument();
    expect(screen.getByText('Quarantined')).toBeInTheDocument();
    await user.click(screen.getByText('Pump 4'));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });
});

describe('the device address (iot-device 03 §3.6)', () => {
  it('shows the newest connect\'s address with its transport, and a dash before the first connect', () => {
    const { unmount } = render(<DeviceAddress ip="203.0.113.7" transport="mqtt" />);
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument();
    expect(screen.getByText('MQTT')).toBeInTheDocument();
    expect(screen.getByTitle('203.0.113.7 over MQTT, the address of the newest connect')).toBeInTheDocument();
    unmount();
    render(<DeviceAddress ip={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('the device header names it', () => {
    render(<DeviceDetailHeader device={{ ...DEVICE, lastRemoteIp: '198.51.100.4', lastTransport: 'http' }} now={NOW} />);
    expect(screen.getByText('IP address:')).toBeInTheDocument();
    expect(screen.getByText('198.51.100.4')).toBeInTheDocument();
    expect(screen.getByText('HTTP')).toBeInTheDocument();
  });

  it('a live state change carries the new address onto the list row, and one without it keeps the old', () => {
    const row = { ...DEVICE, lastRemoteIp: '203.0.113.7', lastTransport: 'mqtt' };
    expect(applyStatePatch(row, { deviceId: 'd1', online: true, remoteIp: '198.51.100.9', transport: 'mqtt' })).toMatchObject({ online: true, lastRemoteIp: '198.51.100.9' });
    expect(applyStatePatch(row, { deviceId: 'd1', online: false })).toMatchObject({ online: false, lastRemoteIp: '203.0.113.7' });
  });

  it('the board table has an address column on request', () => {
    render(<DeviceTable rows={[{ id: 'd1', name: 'Pump 4', remoteIp: '203.0.113.7' }]} columns={['name', 'address']} now={NOW} tickMs={0} />);
    expect(screen.getByRole('columnheader', { name: 'IP address' })).toBeInTheDocument();
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument();
  });
});

describe('DeviceTable: a row with no connection field (next-boilerplate run 3 notes 13 and 75)', () => {
  it('reads "Not known" with its hint and no last-seen time, never "Never connected"; a row with its fields keeps the dot', () => {
    render(
      <DeviceTable
        now={NOW} locale="en" tickMs={0} columns={['name', 'connection', 'lastSeen']}
        rows={[{ id: 'd1', name: 'Pump 4', connectionKnown: false }, { id: 'd2', name: 'Probe', online: false }]}
      />,
    );
    const unknown = screen.getByText('Not known');
    expect(unknown).toHaveAttribute('data-state', 'UNKNOWN');
    expect(unknown).toHaveAttribute('title', 'These rows carry no connection state: show them from the devices source to see it.');
    const row = screen.getByText('Pump 4').closest('tr')!;
    expect(within(row).queryByText(/Never connected/)).toBeNull();
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(within(screen.getByText('Probe').closest('tr')!).getAllByText(/Never connected/).length).toBeGreaterThan(0);
  });
});
