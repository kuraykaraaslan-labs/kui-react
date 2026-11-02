import { IotApiError, type IotProvisioningApi } from '@/modules/domains/iot/api/adapter';
import type { DeviceProfile, ProvisionKey, ProvisionStrategy } from '@/modules/domains/iot/types/profile';

/*
 * The demo's provisioning keys (NB iot_device_profile 02 §2.2, OD-1), in memory: a rotation makes a new active key and retires the
 * previous one (a grace of 0 revokes it at once), a revocation is final and needs the key id typed again. The demo is a customer
 * workspace: Roltek factory is never offered, and a copy of a platform template stays Disabled (its devices arrive by claim). The
 * secret is made here, handed back once and never kept: the store holds key rows only.
 */
const DAY = 86_400_000;
const TENANT_STRATEGIES: ProvisionStrategy[] = ['DISABLED', 'ALLOW_CREATE_NEW_DEVICES', 'CHECK_PRE_PROVISIONED_DEVICES'];
const GRACE = { min: 0, max: 365, default: 30 };

function hex(bytes: number): string {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The keys the demo profiles start with: the sensors have one in use and one old key still accepted. */
function seed(now: number): Map<string, ProvisionKey[]> {
  return new Map<string, ProvisionKey[]>([
    ['prof-sensor', [
      { provisionKeyId: 'pk-5b1e09a2', provisionKey: 'pk_5b1e09a2c4d7f013', state: 'active', createdAt: new Date(now - 12 * DAY) },
      { provisionKeyId: 'pk-0c77d3f1', provisionKey: 'pk_0c77d3f1a98e2b40', state: 'retired', createdAt: new Date(now - 200 * DAY), retiredAt: new Date(now - 12 * DAY), graceUntil: new Date(now + 18 * DAY) },
      { provisionKeyId: 'pk-91aa40e6', provisionKey: 'pk_91aa40e6b2c15d77', state: 'revoked', createdAt: new Date(now - 400 * DAY), revokedAt: new Date(now - 200 * DAY), revocationReason: 'The secret was pasted into a support ticket.' },
    ]],
  ]);
}

export function createDemoProvisioning(wait: () => Promise<void>, profileOf: (id: string) => DeviceProfile): IotProvisioningApi {
  const keys = seed(Date.now());
  const list = (id: string) => keys.get(id) ?? [];
  const templateCopy = (p: DeviceProfile) => !!p.template;
  return {
    async get(id) {
      await wait();
      const p = profileOf(id);
      return {
        keys: structuredClone(list(id)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        availableStrategies: templateCopy(p) ? ['DISABLED'] : TENANT_STRATEGIES,
        rotationGrace: GRACE,
      };
    },
    async setStrategy(id, strategy) {
      await wait();
      const p = profileOf(id);
      if (strategy === 'ROLTEK_FACTORY') throw new IotApiError('validation', 'Roltek factory is only for platform templates.');
      if (strategy !== 'DISABLED' && templateCopy(p)) throw new IotApiError('validation', 'A copy of a platform template stays Disabled: its devices arrive by claim.');
      p.provisionStrategy = strategy;
      return strategy;
    },
    async rotate(id, { graceDays }) {
      await wait();
      profileOf(id);
      const g = graceDays ?? GRACE.default;
      if (!Number.isInteger(g) || g < GRACE.min || g > GRACE.max) throw new IotApiError('validation', 'The grace is 0-365 days.');
      const now = new Date();
      const rows = list(id);
      const current = rows.find((k) => k.state === 'active');
      if (current) {
        if (g === 0) Object.assign(current, { state: 'revoked', retiredAt: now, revokedAt: now, revocationReason: 'Replaced without a grace.' });
        else Object.assign(current, { state: 'retired', retiredAt: now, graceUntil: new Date(now.getTime() + g * DAY) });
      }
      const id8 = hex(4);
      const key: ProvisionKey = { provisionKeyId: `pk-${id8}`, provisionKey: `pk_${id8}${hex(4)}`, state: 'active', createdAt: now };
      keys.set(id, [key, ...rows]);
      return { key: structuredClone(key), provisionSecret: `ps_${hex(16)}` };
    },
    async revoke(id, { provisionKeyId, confirmKeyId, reason }) {
      await wait();
      if (confirmKeyId !== provisionKeyId) throw new IotApiError('validation', 'The typed key id does not match.');
      const k = list(id).find((x) => x.provisionKeyId === provisionKeyId);
      if (!k) throw new IotApiError('not_found', 'Provisioning key not found.');
      if (k.state === 'revoked') throw new IotApiError('conflict', 'This key is already revoked.');
      Object.assign(k, { state: 'revoked', revokedAt: new Date(), revocationReason: reason.slice(0, 255) });
      return structuredClone(k);
    },
  };
}
