'use client';
import { useState } from 'react';
import { Card } from '@/modules/ui/Card';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { PageHeader } from '@/modules/ui/PageHeader';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { LoraDeviceForm, LoraDeviceTable, LoraFrameTable, LoraGatewayForm, LoraGatewayTable, LoraStationSetup } from '@/modules/domains/iot/lorawan';
import type { LoraDeviceRow, LoraFrameRow, LoraGatewayRow, LoraIssuedToken } from '@/modules/domains/iot/lorawan';

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const GATEWAYS: LoraGatewayRow[] = [
  { gatewayId: 'g1', name: 'Roof, north side', eui: 'AA555A0000000001', protocol: 'BASICS_STATION', status: 'ACTIVE', region: 'EU868', lastSeenAt: ago(1), live: { online: true, rttMs: 42, connectedAt: now - 3 * 3_600_000 } },
  { gatewayId: 'g2', name: 'Warehouse LTE', eui: 'AA555A0000000002', protocol: 'BASICS_STATION', status: 'ACTIVE', region: 'EU868', lastSeenAt: ago(2), live: { online: true, rttMs: 940, connectedAt: now - 600_000 } },
  { gatewayId: 'g3', name: 'Roltek M1 – plant', eui: '0016C001F150B0BB', protocol: 'ROLTEK_LINK', status: 'ACTIVE', region: 'EU868', lastSeenAt: ago(95), live: { online: false, rttMs: null, connectedAt: null } },
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
];
const SETUP = { lnsUrl: 'wss://lns.example.com', routerInfoUrl: 'wss://lns.example.com/router-info', trustAvailable: true };
const ISSUED: LoraIssuedToken = {
  token: 'lns_Q2xvdWQgTG9SYVdBTiBkZW1vIHRva2VuIG9ubHkgb25jZQ',
  files: [{ name: 'tc.uri', content: 'wss://lns.example.com\n' }, { name: 'tc.trust', content: '-----BEGIN CERTIFICATE-----\n…\n' }, { name: 'tc.key', content: 'Authorization: Bearer lns_…\n' }],
};

/** /theme/iot/lorawan — the cloud LoRaWAN screens (NB iot_lorawan 13): gateways with their connection, the setup a customer follows alone, end devices with their join state, the frames log. */
export default function LorawanPage() {
  const [addGw, setAddGw] = useState(false);
  const [addDev, setAddDev] = useState(false);
  const [issued, setIssued] = useState<LoraIssuedToken | null>(null);
  const [open, setOpen] = useState<LoraGatewayRow | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DocumentTitle text="LoRaWAN — IoT Theme" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <PageHeader title="LoRaWAN" subtitle="Gateways, end devices and the frames the cloud network server heard." actions={[{ label: 'Add gateway', onClick: () => setAddGw(true), variant: 'primary' }]} />
        <Card className="p-4"><LoraGatewayTable rows={GATEWAYS} onOpen={(g) => { setOpen(g); setIssued(null); }} now={now} /></Card>
        <Card className="space-y-3 p-4">
          <div className="flex justify-end"><Button variant="outline" onClick={() => setAddDev(true)}>Add device</Button></div>
          <LoraDeviceTable rows={DEVICES} now={now} />
        </Card>
        <Card className="p-4"><LoraFrameTable rows={FRAMES} deviceName={(id) => DEVICES.find((d) => d.deviceId === id)?.name ?? undefined} gatewayName={(id) => GATEWAYS.find((g) => g.gatewayId === id)?.name} /></Card>
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
      <ConfirmDialog open={confirm} title="Rotate the token" tone="danger" confirmLabel="Rotate"
        message="The gateway is disconnected at once and stays disconnected until you put the new token on it."
        onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); setIssued(ISSUED); }} />
    </>
  );
}
