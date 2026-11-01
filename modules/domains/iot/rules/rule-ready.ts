import type { IotMessages } from '../messages';
import type { RuleDefinition } from '../types/rules';

/**
 * Ready-made rules (docs/concepts/iot-rules 06): the commonest sentences of a place, offered when a rule is new. Each is only a
 * STARTING POINT: the structure and the numbers are filled in, no device is picked (the customer's own devices are theirs to name) and
 * nothing is saved until Save. Pure; the names and texts come from the host's messages.
 */
export type ReadyKey = 'onHigh' | 'offLow' | 'offline' | 'sunset' | 'afterOn' | 'every';
export const READY_KEYS: readonly ReadyKey[] = ['onHigh', 'offLow', 'offline', 'sunset', 'afterOn', 'every'];

const none = { device: '' };
const command = (id: string) => ({ id, kind: 'command' as const, target: none, command: '' });

export function readyRule(key: ReadyKey, m: IotMessages['rules']): { name: string; definition: RuleDefinition } {
  const base = { v: 1 as const, options: { overlap: 'ignore' as const } };
  switch (key) {
    case 'onHigh':
      return { name: m.readyOnHighName, definition: { ...base, when: [{ id: 't1', kind: 'value', target: none, key: '', change: 'above', forSec: 300 }], then: [command('a1')] } };
    case 'offLow':
      return { name: m.readyOffLowName, definition: { ...base, when: [{ id: 't1', kind: 'value', target: none, key: '', change: 'below', forSec: 300 }], then: [command('a1')] } };
    case 'offline':
      return {
        name: m.readyOfflineName,
        definition: {
          ...base, when: [{ id: 't1', kind: 'status', target: none, to: 'offline' }],
          // the wait is the "for 10 minutes": the row after it only tells people when the device is STILL offline
          then: [
            { id: 'a1', kind: 'wait', sec: 600 },
            { id: 'a2', kind: 'choose', branches: [{ if: { kind: 'status', target: none, is: 'offline' }, then: [{ id: 'a3', kind: 'notify', recipients: [{ kind: 'role', role: 'ADMIN' }], text: m.readyOfflineText }] }] },
          ],
        },
      };
    case 'sunset':
      return { name: m.readySunsetName, definition: { ...base, when: [{ id: 't1', kind: 'sun', event: 'sunset' }], then: [command('a1')] } };
    case 'afterOn':
      return {
        name: m.readyAfterOnName,
        definition: { ...base, when: [{ id: 't1', kind: 'value', target: none, key: '', change: 'equals', value: true }], then: [{ id: 'a1', kind: 'wait', sec: 1800 }, command('a2')] },
      };
    case 'every':
      return {
        name: m.readyEveryName,
        definition: { ...base, when: [{ id: 't1', kind: 'every', minutes: 15 }], onlyIf: { kind: 'time', after: '08:00', before: '20:00', days: [1, 2, 3, 4, 5] }, then: [command('a1')] },
      };
  }
}

export const readyLabel = (m: IotMessages['rules'], key: ReadyKey): string =>
  ({ onHigh: m.readyOnHigh, offLow: m.readyOffLow, offline: m.readyOffline, sunset: m.readySunset, afterOn: m.readyAfterOn, every: m.readyEvery })[key];
