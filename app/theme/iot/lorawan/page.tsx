'use client';
import { useState } from 'react';
import { Card } from '@/modules/ui/Card';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { PageHeader } from '@/modules/ui/PageHeader';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import {
  CODEC_OUTLINE, LoraCodecDetail, LoraCodecEditor, LoraCodecTable, LoraDeviceForm, LoraDevicePanel, LoraDeviceTable, LoraFrameTable, LoraGatewayForm,
  LoraGatewayMap, LoraGatewayTable, LoraProfilePanel, LoraStationSetup,
} from '@/modules/domains/iot/lorawan';
import type {
  LoraBenchFrame, LoraCodecCheck, LoraCodecDoc as CodecDetail, LoraCodecRow, LoraDeviceRow, LoraFrameRow, LoraGatewayRow, LoraIssuedToken, LoraProfileView,
} from '@/modules/domains/iot/lorawan';

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const GATEWAYS: LoraGatewayRow[] = [
  { gatewayId: 'g1', name: 'Roof, north side', eui: 'AA555A0000000001', protocol: 'BASICS_STATION', status: 'ACTIVE', region: 'EU868', lastSeenAt: ago(1), live: { online: true, rttMs: 42, connectedAt: now - 3 * 3_600_000 }, latitude: 41.0151, longitude: 28.9795 },
  { gatewayId: 'g2', name: 'Warehouse LTE', eui: 'AA555A0000000002', protocol: 'BASICS_STATION', status: 'ACTIVE', region: 'EU868', lastSeenAt: ago(2), live: { online: true, rttMs: 940, connectedAt: now - 600_000 }, latitude: 41.0422, longitude: 29.0083 },
  { gatewayId: 'g3', name: 'Roltek M1 – plant', eui: '0016C001F150B0BB', protocol: 'ROLTEK_LINK', status: 'ACTIVE', region: 'EU868', lastSeenAt: ago(95), live: { online: false, rttMs: null, connectedAt: null }, latitude: 40.9923, longitude: 29.1244 },
  { gatewayId: 'g4', name: 'Old gateway', eui: 'AA555A0000000004', protocol: 'BASICS_STATION', status: 'DISABLED', region: 'EU868', lastSeenAt: ago(60 * 24 * 9) },
];
const DEVICES: LoraDeviceRow[] = [
  { deviceId: 'd1', name: 'Cold room 1', devEui: 'A840410000000001', joinEui: '0000000000000001', class: 'A', macVersion: '1.0.3', lastJoin: { state: 'joined', at: now - 7_200_000 }, session: { devAddr: '26011234', fCntUp: 812, fCntDown: 14, lastUplinkAt: ago(3), status: 'ACTIVE' } },
  { deviceId: 'd2', name: 'Door sensor', devEui: '24E124136B502217', joinEui: '24E124C0002A0001', class: 'A', macVersion: '1.0.2', lastJoin: { state: 'join_mic_failed', at: now - 60_000 }, session: null },
  { deviceId: 'd3', name: 'Pump controller', devEui: '2CF7F12000000003', joinEui: '0000000000000000', class: 'C', macVersion: '1.0.4', lastJoin: null, session: null },
];
const gws = (n: number) => GATEWAYS.slice(0, n).map((g, i) => ({ gatewayId: g.gatewayId, eui: g.eui, rssi: -78 - i * 14, snr: 7.5 - i * 6 }));
const FRAMES: LoraFrameRow[] = [
  { t: now - 30_000, type: 'up', result: 'processed', deviceId: 'd1', devEui: 'A840410000000001', fCnt: 812, fPort: 2, dr: 5, freq: 868_100_000, gateways: gws(3), decoded: { temperature: 3.2 } },
  { t: now - 29_000, type: 'down', result: 'sent', deviceId: 'd1', fCnt: 14, dr: 5, freq: 868_100_000, gateways: [], chosenGatewayId: 'g1', window: 'rx1' },
  { t: now - 60_000, type: 'join', result: 'dropped', reason: 'join_mic_failed', deviceId: 'd2', dr: 0, freq: 868_300_000, gateways: gws(1) },
  { t: now - 90_000, type: 'dropped', result: 'dropped', reason: 'foreign_tenant', dr: 2, freq: 868_500_000, gateways: gws(2) },
  { t: now - 120_000, type: 'cup', result: 'retransmission', deviceId: 'd1', fCnt: 811, gateways: gws(1) },
  // a device that is not in the device list above: the row carries its name (the host's frames read)
  { t: now - 150_000, type: 'up', result: 'processed', deviceId: 'd7', deviceName: 'Water meter 7', devEui: 'A840410000000007', fCnt: 96, fPort: 1, dr: 3, freq: 867_700_000, gateways: gws(2) },
];
const CODECS: LoraCodecRow[] = [
  { id: 'milesight-em300-th', title: 'Milesight EM300-TH temperature & humidity', vendor: 'Milesight', models: ['EM300-TH', 'EM320-TH'], fports: [85], oui: ['24E124'], kind: 'tlv', origin: 'clean-room', verified: false, rev: 1, updatedAt: ago(60 * 24), scope: 'public', status: 'PUBLISHED' },
  { id: 'dragino-lht65n', title: 'Dragino LHT65N temperature & humidity', vendor: 'Dragino', models: ['LHT65N'], fports: [2], oui: ['A84041'], kind: 'layout', origin: 'clean-room', verified: true, rev: 2, updatedAt: ago(60 * 48), scope: 'public', status: 'PUBLISHED' },
  { id: 't.cold-room', title: 'Cold room probe (our firmware)', vendor: 'Acme', models: ['CR-1'], fports: [85], oui: [], kind: 'tlv', origin: 'tenant', verified: false, rev: 3, updatedAt: ago(30), scope: 'tenant', status: 'PUBLISHED' },
];
const EM300: CodecDetail = {
  id: 'milesight-em300-th', rev: 1, sha256: 'f76f06c922d4e1bd528325e6af190dbe66135d178e8992bfece348f3f18ed18d', scope: 'public',
  document: { id: 'milesight-em300-th', title: 'Milesight EM300-TH temperature & humidity', vendor: 'Milesight', models: ['EM300-TH', 'EM320-TH'], fports: [85], oui: ['24E124'], origin: 'clean-room', extends: 'milesight-tlv', tests: [{ name: 'README example', fport: 85, hex: '01755C03673401046865', expect: { battery: 92, temperature: 30.8, humidity: 50.5 } }] },
  outputSet: { battery: '%', temperature: '°C', humidity: '%RH' },
};
const BENCH: LoraBenchFrame = { fields: { battery: 92, temperature: 30.8, humidity: 50.5 }, units: { battery: '%', temperature: '°C', humidity: '%RH' }, keys: { battery: '%', temperature: '°C', humidity: '%RH' } };
const CHECK: LoraCodecCheck = { verdict: { ok: true, outputSet: { battery: '%' } }, vectors: [{ index: 0, name: 'battery 92 %', ok: true, problems: [] }], frame: { fields: { battery: 92 }, units: { battery: '%' }, keys: { battery: '%' } } };
const PROFILE: LoraProfileView = {
  settings: { region: 'EU868', macVersion: '1.0.3', class: 'A', rx1DelayS: 5, adrEnabled: true, minDr: 0, maxDr: 5, dedupMs: 200, anyJoinEui: false, codecId: 'auto', storeRadioKeys: true },
  hasSharedAppKey: false, onlineRule: 'UPLINK_WINDOW', expectedIntervalS: 600,
};
const CODEC_OPTIONS = [{ value: 'auto', label: 'Automatic (by maker and port)' }, { value: 'none', label: 'None (raw payload to the flows)' }, ...CODECS.map((c) => ({ value: c.id, label: `${c.title} (${c.id})` }))];
const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 300));

const SETUP = { lnsUrl: 'wss://acme.lns.example.com', routerInfoUrl: 'wss://acme.lns.example.com/router-info', trustAvailable: true };
const ISSUED: LoraIssuedToken = {
  token: 'lns_Q2xvdWQgTG9SYVdBTiBkZW1vIHRva2VuIG9ubHkgb25jZQ',
  files: [{ name: 'tc.uri', content: 'wss://acme.lns.example.com\n' }, { name: 'tc.trust', content: '-----BEGIN CERTIFICATE-----\n…\n' }, { name: 'tc.key', content: 'Authorization: Bearer lns_…\n' }],
};

/** /theme/iot/lorawan — the cloud LoRaWAN screens (NB iot_lorawan 13): gateways with their connection, the setup a customer follows alone, end devices with their join state, the frames log. */
export default function LorawanPage() {
  const [addGw, setAddGw] = useState(false);
  const [addDev, setAddDev] = useState(false);
  const [issued, setIssued] = useState<LoraIssuedToken | null>(null);
  const [open, setOpen] = useState<LoraGatewayRow | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [gateways, setGateways] = useState(GATEWAYS);
  const [mapOpen, setMapOpen] = useState(false);
  const [codecsOpen, setCodecsOpen] = useState(false);
  const [codecView, setCodecView] = useState<'list' | 'detail' | 'edit'>('list');
  return (
    <>
      <DocumentTitle text="LoRaWAN — IoT Theme" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <PageHeader title="LoRaWAN" subtitle="Gateways, end devices and the frames the cloud network server heard." actions={[
          { label: 'Add gateway', onClick: () => setAddGw(true), variant: 'primary' },
          { label: 'Map', onClick: () => setMapOpen(true), variant: 'outline' },
          { label: 'Codecs', onClick: () => { setCodecView('list'); setCodecsOpen(true); }, variant: 'outline' },
        ]} />
        <Card title="Gateways" className="p-4"><LoraGatewayTable rows={GATEWAYS} onOpen={(g) => { setOpen(g); setIssued(null); }} now={now} /></Card>
        <Card title="End devices" className="space-y-3 p-4">
          <div className="flex justify-end"><Button variant="outline" onClick={() => setAddDev(true)}>Add device</Button></div>
          <LoraDeviceTable rows={DEVICES} now={now} />
        </Card>
        <Card title="Device page: the LoRaWAN tab (Cold room 1)" className="p-4">
          <LoraDevicePanel device={{ ...DEVICES[0], codecId: 'auto' }} frames={FRAMES.filter((f) => f.deviceId === 'd1')} codecOptions={CODEC_OPTIONS}
            gatewayName={(id) => GATEWAYS.find((g) => g.gatewayId === id)?.name} onCodecChange={() => later(undefined)} onResetSession={() => undefined} />
        </Card>
        <Card title="Device profile page: the LoRaWAN tab" className="p-4">
          <LoraProfilePanel view={PROFILE} codecOptions={CODEC_OPTIONS} onSave={() => later(undefined)} onlineRuleLabel={() => 'Recent message'} />
        </Card>
        <Card title="Frames" className="p-4"><LoraFrameTable rows={FRAMES} deviceName={(id) => DEVICES.find((d) => d.deviceId === id)?.name ?? undefined} gatewayName={(id) => GATEWAYS.find((g) => g.gatewayId === id)?.name} /></Card>
      </div>
      <Drawer open={addGw} onClose={() => setAddGw(false)} title="Add a gateway">
        <LoraGatewayForm onCancel={() => setAddGw(false)} onSubmit={(v) => { setAddGw(false); setIssued(ISSUED); setOpen({ ...GATEWAYS[0], gatewayId: 'new', name: v.name, eui: v.eui, live: { online: false, rttMs: null, connectedAt: null } }); }} />
      </Drawer>
      <Drawer open={addDev} onClose={() => setAddDev(false)} title="Add a LoRaWAN device">
        <LoraDeviceForm onCancel={() => setAddDev(false)} onSubmit={() => setAddDev(false)} />
      </Drawer>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''} footer={open?.protocol === 'BASICS_STATION' ? <Button variant="outline" onClick={() => setConfirm(true)}>Rotate token</Button> : undefined}>
        {open && <LoraStationSetup gateway={open} setup={SETUP} issued={issued} onDownload={() => undefined} />}
      </Drawer>
      <Drawer open={mapOpen} onClose={() => setMapOpen(false)} title="Gateway map" className="w-[72rem]">
        <LoraGatewayMap gateways={gateways} now={now} onOpen={(g) => { setMapOpen(false); setOpen(g); }}
          onMove={(g, [latitude, longitude]) => setGateways((all) => all.map((x) => (x.gatewayId === g.gatewayId ? { ...x, latitude, longitude } : x)))} />
      </Drawer>
      <Drawer open={codecsOpen} onClose={() => setCodecsOpen(false)} title="Codecs" className="w-[72rem]">
        {codecView === 'list' && (
          <div className="space-y-3">
            <div className="flex justify-end"><Button onClick={() => setCodecView('edit')}>New codec</Button></div>
            <LoraCodecTable rows={CODECS} onOpen={() => setCodecView('detail')} />
          </div>
        )}
        {codecView === 'detail' && (
          <LoraCodecDetail codec={EM300} onTest={() => later(BENCH)} revisions={[{ rev: 1, sha256: EM300.sha256, size: 412, publishedAt: ago(60 * 24), keys: 3 }]}
            onBack={() => setCodecView('list')} onCopy={() => setCodecView('edit')} />
        )}
        {codecView === 'edit' && <LoraCodecEditor initial={CODEC_OUTLINE} onCheck={() => later(CHECK)} onSave={async () => setCodecView('list')} onCancel={() => setCodecView('list')} />}
      </Drawer>
      <ConfirmDialog open={confirm} title="Rotate the token" tone="danger" confirmLabel="Rotate"
        message="The gateway is disconnected at once and stays disconnected until you put the new token on it."
        onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); setIssued(ISSUED); }} />
    </>
  );
}
