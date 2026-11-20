'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/modules/ui/Button';
import { Card } from '@/modules/ui/Card';
import { PageHeader } from '@/modules/ui/PageHeader';
import { toast } from '@/modules/ui/Toast';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { ClaimDeviceWizard, ReleaseDeviceDialog, type ClaimAnswer, type ClaimCode } from '@/modules/domains/iot/provisioning';

const SERIAL = 'RT420-2610-000123';
const SECRET = '7KQ2M9XHD4TB6WRA1NZC';
const WINDOW_MS = 15 * 60_000;
const later = () => new Promise<void>((r) => setTimeout(r, 400));
const group = (s: string) => s.replace(/[^0-9A-Z]/gi, '').toUpperCase().replace(/(.{4})(?=.)/g, '$1-');

/** The demo's claim QR format (the host owns the real one; NB `iot_provisioning`'s `parseClaimUri`). */
function parseScan(text: string): ClaimCode | null {
  const m = /^(?:iot|roltek):\/\/claim\?sn=([A-Z0-9-]{6,32})&k=([0-9A-Z]{20})$/.exec(text.trim());
  return m ? { serial: m[1], secret: m[2] } : null;
}

class Refusal extends Error {
  constructor(readonly code: 'press_claim_button' | 'bad_secret' | 'not_claimable') { super(code); }
}

/**
 * DevicePanelQrMock — a stand-in for the router panel's Cloud page (demo only, not exported): the claim QR drawn with `qrcode`, the grouped
 * code, and "Open claim window" with its 15-minute countdown (OD-41). Show it on a laptop and scan it with a phone.
 */
function DevicePanelQrMock({ openUntil, onOpen }: { openUntil: number; onOpen: () => void }) {
  const [src, setSrc] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { void QRCode.toDataURL(`iot://claim?sn=${SERIAL}&k=${SECRET}`, { margin: 1, width: 220 }).then(setSrc); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const left = Math.max(0, openUntil - now);
  const mmss = `${String(Math.floor(left / 60_000)).padStart(2, '0')}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}`;
  return (
    <div className="space-y-3 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL drawn in the browser */}
      {src && <img src={src} alt={`Claim QR of ${SERIAL}`} className="mx-auto h-56 w-56 rounded bg-white p-2" />}
      <p className="font-mono text-sm text-text-primary">{SERIAL}</p>
      <p className="font-mono text-lg tracking-wider text-text-primary">{group(SECRET)}</p>
      <Button variant={left ? 'outline' : 'primary'} onClick={onOpen}>{left ? `Claim window open · ${mmss}` : 'Open claim window'}</Button>
    </div>
  );
}

/**
 * /theme/iot/claim — adding a device by the code on its own screen (NB iot_provisioning 04, docs/concepts/iot-platform/phases/05): the
 * mobile-first ClaimDeviceWizard against fixtures (the claim fails with the closed-window state until the panel mock's window is opened),
 * and the owner's ReleaseDeviceDialog with the serial typed again.
 */
export default function ClaimPage() {
  const [openUntil, setOpenUntil] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [release, setRelease] = useState(false);
  const [busy, setBusy] = useState(false);

  const answer = async (code: ClaimCode, dryRun: boolean): Promise<ClaimAnswer> => {
    await later();
    if (code.serial !== SERIAL) throw new Refusal('not_claimable');
    if (code.secret !== SECRET) throw new Refusal('bad_secret');
    if (Date.now() > openUntil) throw new Refusal('press_claim_button');
    if (claimed) return { status: 'done', done: { deviceId: 'demo-1', notes: ['This device is already in this account.'] } };
    if (dryRun) return { status: 'ready', preview: { serial: SERIAL, model: 'RT420 LTE router', hw: 'rev B' } };
    setClaimed(true);
    return { status: 'done', done: { deviceId: 'demo-1', notes: ['The device was added. It connects within a few seconds when it is online.'] } };
  };

  return (
    <>
      <DocumentTitle text="Add device — IoT Theme" />
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-2">
        <PageHeader className="md:col-span-2" title="Add device" subtitle="Scan the claim QR on the device's screen, or type its serial and code." />
        <Card title="Phone: Add device" className="p-4">
          <div className="mx-auto max-w-md">
            <ClaimDeviceWizard
              parseScan={parseScan}
              checkTyped={(serial, secret) => {
                const k = secret.replace(/[^0-9A-Z]/gi, '').toUpperCase();
                if (!/^[A-Z0-9-]{6,32}$/.test(serial.trim())) return { problem: 'The serial has 6 to 32 letters, digits and dashes.' };
                if (k.length !== 20) return { problem: 'The claim code has 20 characters, e.g. 7KQ2-M9XH-D4TB-6WRA-1NZC.' };
                return { serial: serial.trim(), secret: k };
              }}
              formatSecret={group}
              check={(c) => answer(c, true)}
              claim={(c) => answer(c, false)}
              describeError={(e) => {
                const code = e instanceof Refusal ? e.code : null;
                if (code === 'press_claim_button') return { text: 'The claim window on the device is closed. Open the device\'s Cloud page, press Open claim window, then try again within 15 minutes.', retry: true };
                if (code === 'not_claimable') return { text: 'This device is owned by another account. Ask the seller (or previous owner) to release it, then try again.' };
                if (code === 'bad_secret') return { text: 'The claim code does not match. Check it on the device\'s Cloud page.' };
                return { text: 'The device could not be added. Try again.' };
              }}
              deviceHref={() => '/theme/iot/devices'}
              onAdded={() => toast.success('Device added.')}
              placeholders={{ scanned: 'iot://claim?sn=…&k=…', serial: SERIAL, secret: '7KQ2-M9XH-D4TB-6WRA-1NZC' }}
            />
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Device: Cloud page (stand-in)" className="p-4">
            <DevicePanelQrMock openUntil={openUntil} onOpen={() => setOpenUntil(Date.now() + WINDOW_MS)} />
          </Card>
          <Card title="Owner: release the device" className="space-y-3 p-4">
            <p className="text-sm text-text-secondary">{claimed ? `${SERIAL} is in this account.` : 'Add the device first; then release it here.'}</p>
            <Button variant="danger" disabled={!claimed} onClick={() => setRelease(true)}>Release device</Button>
          </Card>
        </div>
      </div>
      <ReleaseDeviceDialog
        open={release}
        serial={SERIAL}
        busy={busy}
        onCancel={() => setRelease(false)}
        onConfirm={async () => {
          setBusy(true);
          await later();
          setBusy(false);
          setRelease(false);
          setClaimed(false);
          toast.success('The device was released and is back in the factory pool.');
        }}
      />
    </>
  );
}
