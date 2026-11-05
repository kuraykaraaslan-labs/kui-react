'use client';
import { useState } from 'react';
import { Card } from '@/modules/ui/Card';
import { Drawer } from '@/modules/ui/Drawer';
import { PageHeader } from '@/modules/ui/PageHeader';
import { toast } from '@/modules/ui/Toast';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { CertificateDetailCard, CertificateTable, RecoveryRequestCard, RecoveryRequestTable } from '@/modules/domains/iot/pki';
import type { DeviceCertificate, RecoveryRequest } from '@/modules/domains/iot/pki';

const now = Date.now();
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const fp = (seed: string) => seed.repeat(Math.ceil(64 / seed.length)).slice(0, 64);
const base = {
  issuerCaId: 'ca-dev-1', issuerName: 'Roltek Device Issuing CA G1', keyAlg: 'EC-P256', revokedAt: null, revocationReason: null,
  supersedesCertificateId: null, renewRequestedAt: null,
} as const;
const CERTS: DeviceCertificate[] = [
  { ...base, certificateId: 'c1', deviceSerial: 'RT-M1-000123', subjectCn: 'RT-M1-000123', serialNumberHex: '4a1f07c2e9', fingerprintSha256: fp('3fa9c1'), notBefore: iso(now - 340 * DAY), notAfter: iso(now + 25 * DAY), status: 'ACTIVE', issuedVia: 'BOOTSTRAP', serverKeygen: false, firstSeenAt: iso(now - 339 * DAY), renewRequestedAt: iso(now - 2 * DAY) },
  { ...base, certificateId: 'c2', deviceSerial: 'RT-M1-000124', subjectCn: 'RT-M1-000124', serialNumberHex: '4a1f07c2ea', fingerprintSha256: fp('8b02de'), notBefore: iso(now - 40 * DAY), notAfter: iso(now + 50 * DAY), status: 'ACTIVE', issuedVia: 'SERVER_KEYGEN', serverKeygen: true, firstSeenAt: iso(now - 39 * DAY) },
  { ...base, certificateId: 'c3', deviceSerial: 'ESP-0000A7', subjectCn: 'ESP-0000A7', serialNumberHex: '4a1f07c2eb', fingerprintSha256: fp('c7d415'), notBefore: iso(now - 10 * DAY), notAfter: iso(now + 355 * DAY), status: 'ACTIVE', issuedVia: 'RENEWAL', serverKeygen: false, firstSeenAt: iso(now - 9 * DAY), supersedesCertificateId: 'c4' },
  { ...base, certificateId: 'c4', deviceSerial: 'ESP-0000A7', subjectCn: 'ESP-0000A7', serialNumberHex: '4a1f07c2ec', fingerprintSha256: fp('11ef90'), notBefore: iso(now - 360 * DAY), notAfter: iso(now + 5 * DAY), status: 'REVOKED', issuedVia: 'BOOTSTRAP', serverKeygen: false, firstSeenAt: iso(now - 359 * DAY), revokedAt: iso(now - 8 * DAY), revocationReason: 'superseded' },
  { ...base, certificateId: 'c5', deviceSerial: 'RT-M1-000077', subjectCn: 'RT-M1-000077', serialNumberHex: '4a1f07c2ed', fingerprintSha256: fp('a0b1c2'), notBefore: iso(now - 400 * DAY), notAfter: iso(now - 35 * DAY), status: 'EXPIRED', issuedVia: 'BOOTSTRAP', serverKeygen: false, firstSeenAt: iso(now - 399 * DAY), keyAlg: 'RSA-2048' },
];
const RECOVERIES: RecoveryRequest[] = [
  { recoveryId: 'r1', deviceSerial: 'RT-M1-000124', deviceId: 'd2', currentCertificateId: 'c2', keygen: false, keyId: fp('5e6f70'), status: 'PENDING', otherKeyAttempts: 2, requestedAt: iso(now - 3 * 3_600_000), lastAttemptAt: iso(now - 600_000), expiresAt: iso(now + 7 * DAY - 3 * 3_600_000), decidedAt: null, revocationReason: null, issuedCertificateId: null, usedAt: null },
  { recoveryId: 'r2', deviceSerial: 'RT-M1-000090', deviceId: 'd9', currentCertificateId: 'c9', keygen: true, keyId: null, status: 'USED', otherKeyAttempts: 0, requestedAt: iso(now - 9 * DAY), lastAttemptAt: iso(now - 8 * DAY), expiresAt: iso(now - 2 * DAY), decidedAt: iso(now - 8.5 * DAY), revocationReason: 'keyCompromise', issuedCertificateId: 'c10', usedAt: iso(now - 8 * DAY) },
];
const later = () => new Promise<void>((r) => setTimeout(r, 400));

/**
 * /theme/iot/certificates — device certificates (NB iot_pki 03 §3.5, docs/concepts/iot-platform/phases/13-device-certificates.md): the
 * operations list of certificates and recovery requests, each opening its card in a drawer; the device page's certificate card with Renew
 * (offered under 30 days left or for a platform-generated key) and Revoke, and a pending recovery with Approve / Reject.
 */
export default function CertificatesPage() {
  const [openCert, setOpenCert] = useState<DeviceCertificate | null>(null);
  const [openRecovery, setOpenRecovery] = useState<RecoveryRequest | null>(null);
  const [recoveries, setRecoveries] = useState(RECOVERIES);
  return (
    <>
      <DocumentTitle text="Certificates — IoT Theme" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <PageHeader title="Certificates" subtitle="Device certificates the platform issued, and devices asking to recover theirs." />
        <Card title="Recovery requests" className="p-4">
          <RecoveryRequestTable rows={recoveries} now={now} onOpen={setOpenRecovery} />
        </Card>
        <Card title="Device certificates" className="p-4">
          <CertificateTable rows={CERTS} now={now} onOpen={setOpenCert} />
        </Card>
        <Card title="Device page: the certificate of RT-M1-000123 (25 days left, renewal asked)" className="p-4">
          <CertificateDetailCard certificate={CERTS[0]} now={now}
            onRenew={async () => { await later(); toast.success('The device was asked to renew its certificate.'); }}
            onRevoke={async () => { await later(); toast.success('Certificate revoked.'); }} />
        </Card>
        <Card title="Device page: a platform-generated key, with a pending recovery" className="space-y-4 p-4">
          <CertificateDetailCard certificate={CERTS[1]} now={now} onRenew={async () => { await later(); throw new Error('The device is offline. It is asked again when it connects.'); }} onRevoke={async () => later()} />
          <RecoveryRequestCard recovery={recoveries[0]} now={now} onDecide={async (d) => {
            await later();
            setRecoveries((all) => all.map((r) => (r.recoveryId === 'r1' ? { ...r, status: d.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', decidedAt: new Date().toISOString() } : r)));
          }} />
        </Card>
      </div>
      <Drawer open={!!openCert} onClose={() => setOpenCert(null)} title={openCert?.deviceSerial ?? ''}>
        {openCert && <CertificateDetailCard certificate={openCert} now={now} onRevoke={async () => { await later(); setOpenCert(null); }} />}
      </Drawer>
      <Drawer open={!!openRecovery} onClose={() => setOpenRecovery(null)} title={openRecovery?.deviceSerial ?? ''}>
        {openRecovery && <RecoveryRequestCard recovery={recoveries.find((r) => r.recoveryId === openRecovery.recoveryId) ?? openRecovery} now={now} onDecide={async () => { await later(); setOpenRecovery(null); }} />}
      </Drawer>
    </>
  );
}
