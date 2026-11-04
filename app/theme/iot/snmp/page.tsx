'use client';
import { useState } from 'react';
import { Card } from '@/modules/ui/Card';
import { PageHeader } from '@/modules/ui/PageHeader';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { SnmpMappingEditor, SnmpMappingRefused, SnmpMappingView, SnmpTestPollPanel, normaliseOid } from '@/modules/domains/iot/snmp';
import type { SnmpMapping, SnmpTestPollDevice, SnmpTestPollResult } from '@/modules/domains/iot/snmp';

/** A copy of NB's UPS template (RFC 1628), shortened. */
const UPS: SnmpMapping = {
  timeoutMs: 2000, retries: 1, maxRepetitions: 10,
  mapping: [
    { oid: '1.3.6.1.2.1.1.1.0', key: 'sys.descr', kind: 'attribute', type: 'auto' },
    { oid: '1.3.6.1.2.1.1.3.0', key: 'uptime', kind: 'telemetry', type: 'timeticks', unit: 's' },
    { oid: '1.3.6.1.2.1.33.1.2.1.0', key: 'battery.status', type: 'enum', enumMap: { 1: 'unknown', 2: 'normal', 3: 'low', 4: 'depleted' } },
    { oid: '1.3.6.1.2.1.33.1.2.4.0', key: 'battery.charge', type: 'gauge', unit: '%' },
    { oid: '1.3.6.1.2.1.33.1.3.3.1.2.1', key: 'input.frequency', type: 'gauge', scale: 0.1, unit: 'Hz' },
  ],
  tables: [{ name: 'upsOutputTable', indexBy: 'index', maxRows: 3, columns: [
    { oid: '1.3.6.1.2.1.33.1.4.4.1.2', key: 'output.voltage', type: 'gauge', unit: 'V' },
    { oid: '1.3.6.1.2.1.33.1.4.4.1.5', key: 'output.load', type: 'gauge', unit: '%' },
  ] }],
  traps: [{ trapOid: '1.3.6.1.2.1.33.2.0.1', key: 'trap.on_battery', value: 1, varbinds: [] }],
};
/** A 48-port switch with ten columns: above the key limit. */
const SWITCH: SnmpMapping = {
  mapping: [{ oid: '1.3.6.1.2.1.1.5.0', key: 'sys.name', kind: 'attribute', type: 'string' }],
  tables: [{ name: 'ifTable / ifXTable', indexBy: '1.3.6.1.2.1.31.1.1.1.1', maxRows: 48, columns: Array.from({ length: 10 }, (_, i) => ({ oid: `1.3.6.1.2.1.31.1.1.1.${i + 6}`, key: `if.c${i + 6}`, rate: true })) }],
};
const DEVICES: SnmpTestPollDevice[] = [
  { deviceId: 'ups1', name: 'Antalya UPS 1', endpointName: 'UPS card', version: 'v3' },
  { deviceId: 'ups2', name: 'Spare UPS', endpointName: 'Old card', version: 'v2c', blocked: 'snmp_v2c_disabled_for_tenant' },
];
const ANSWERS: Record<string, { type: string; value: string | number | null; error?: string }> = {
  '1.3.6.1.2.1.1.1.0': { type: 'octets', value: 'Network Management Card for UPS' },
  '1.3.6.1.2.1.1.2.0': { type: 'oid', value: '1.3.6.1.4.1.318.1.3.27' },
  '1.3.6.1.2.1.1.3.0': { type: 'timeticks', value: 873_451_200 },
  '1.3.6.1.2.1.1.5.0': { type: 'octets', value: 'ups-antalya-1' },
  '1.3.6.1.2.1.33.1.2.4.0': { type: 'integer', value: 97 },
  '1.3.6.1.2.1.33.1.3.3.1.2.1': { type: 'integer', value: 499 },
};
const later = <T,>(v: T, ms = 400) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const poll = async (_device: string, oids: string[]): Promise<SnmpTestPollResult> => later({
  ok: true, failure: null, durationMs: 38,
  varbinds: oids.map((oid) => {
    const a = ANSWERS[normaliseOid(oid)];
    return a ? { oid, ...a } : { oid, type: 'noSuchObject', value: null, error: 'noSuchObject' };
  }),
});

/** /theme/iot/snmp — the SNMP tab of a device profile (kui-react iot 11.3, 11.4): the mapping editor and the MIB-free test poll. */
export default function SnmpPage() {
  const [saved, setSaved] = useState<SnmpMapping>(UPS);
  return (
    <>
      <DocumentTitle text="SNMP — IoT Theme" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <PageHeader title="SNMP" subtitle="The OID mapping of an SNMP device profile and the test poll, with no MIB file." />
        <Card title="Device profile page: the SNMP tab (copied from the UPS template)" className="p-4">
          <SnmpMappingView value={saved} template="snmp-ups-rfc1628 v1" devices={DEVICES} onPoll={poll}
            onSave={async (next) => {
              await later(undefined);
              const dup = (next.mapping ?? []).findIndex((r) => r.key === 'refuse.me');
              if (dup >= 0) throw new SnmpMappingRefused([{ path: `mapping.${dup}.key`, message: 'duplicate_key' }]);
              setSaved(next);
            }} />
        </Card>
        <Card title="A 48-port switch: above the key limit" className="p-4">
          <SnmpMappingEditor value={SWITCH} onChange={() => undefined} />
        </Card>
        <Card title="Read-only (no permission to edit profiles)" className="p-4">
          <SnmpMappingEditor value={UPS} readOnly />
        </Card>
        <Card title="Test poll: failure and no device" className="space-y-6 p-4">
          <SnmpTestPollPanel devices={DEVICES} onPoll={async () => later({ ok: false, failure: 'timeout', durationMs: 4000, varbinds: [] })} />
          <SnmpTestPollPanel devices={[]} />
        </Card>
      </div>
    </>
  );
}
