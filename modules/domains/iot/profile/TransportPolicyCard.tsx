'use client';
import { useId } from 'react';
import { cn } from '@/libs/utils/cn';
import { Callout } from '@/modules/ui/Callout';
import { Select } from '@/modules/ui/Select';
import { TagInput } from '@/modules/ui/TagInput';
import { Toggle } from '@/modules/ui/Toggle';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { isNetwork, isPlaintextRpcMethod, MQTT_TRANSPORT_POLICIES, type DeviceProfileDraft, type ProfileTransport } from '../types/profile';
import { ProfileSection } from './profile-fields';

/**
 * TransportPolicyCard — how a profile's devices reach the platform (protocol 01, OD-159…OD-161): the transport (MQTT, HTTP, both, and
 * LoRaWAN where the host has it), plain MQTT or TLS only (OD-160: TLS only by default; plain MQTT is a deliberate choice for devices
 * that cannot do TLS, with the risk said), tokens in the URL for devices that cannot send headers (OD-161: such a profile is HTTP-only,
 * so the card warns when the transport still names MQTT), and the networks a device may connect from (empty = any; invalid entries are
 * named before any request). With plain MQTT allowed, the commands that may still go to a device in clear (gateway 12 §10: exact method
 * names, none by default; firmware and settings attributes never go in clear). Changing the transport never touches the online rule (OD-63).
 */
export type TransportPolicyValue = Pick<DeviceProfileDraft, 'transportType' | 'mqttTransport' | 'allowTokenInUrl' | 'allowedNetworks' | 'plaintextRpcMethods'>;

export type TransportPolicyCardProps = {
  value: TransportPolicyValue;
  onChange?: (patch: Partial<TransportPolicyValue>) => void;
  /** The transports the host offers (default MQTT, HTTP, ANY). */
  transports?: readonly ProfileTransport[];
  errors?: Partial<Record<keyof TransportPolicyValue, string>>;
  disabled?: boolean;
  /** A built-in profile (a protocol module's): its transport cannot change; everything else on the card can. */
  transportLocked?: boolean;
  messages?: IotMessagesInput;
  className?: string;
};

export function TransportPolicyCard({ value, onChange, transports = ['MQTT', 'HTTP', 'ANY'], errors = {}, disabled, transportLocked, messages, className }: TransportPolicyCardProps) {
  const { m } = useIotText(messages);
  const id = useId();
  const usesMqtt = value.transportType === 'MQTT' || value.transportType === 'ANY';
  const badNetworks = value.allowedNetworks.filter((n) => !isNetwork(n) || (n.includes(':') && n.includes('.')));
  const plainMethods = value.plaintextRpcMethods ?? [];
  const badMethods = plainMethods.filter((x) => !isPlaintextRpcMethod(x));
  const showPlainMethods = usesMqtt && value.mqttTransport === 'PLAINTEXT_ALLOWED';
  return (
    <div className={cn('space-y-4', className)}>
      <ProfileSection title={m.transport.type} hint={transportLocked ? m.transport.builtinFixed : m.transport.typeHint}>
        <Select
          id={`${id}-transport`}
          label={m.transport.type}
          value={value.transportType}
          disabled={disabled || transportLocked}
          onChange={(e) => onChange?.({ transportType: e.target.value as ProfileTransport })}
          options={transports.map((t) => ({ value: t, label: m.transport[t] }))}
        />
      </ProfileSection>

      {value.transportType !== 'HTTP' && value.transportType !== 'LORAWAN' && (
        <ProfileSection title={m.transport.mqttTransport}>
          <fieldset className="grid gap-2 md:grid-cols-2" aria-label={m.transport.mqttTransport}>
            {MQTT_TRANSPORT_POLICIES.map((p) => {
              const checked = value.mqttTransport === p;
              return (
                <label
                  key={p}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-border-focus',
                    checked ? (p === 'PLAINTEXT_ALLOWED' ? 'border-warning bg-warning-subtle' : 'border-primary bg-primary-subtle') : 'border-border bg-surface-base',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-border-strong',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-mqtt`}
                    value={p}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onChange?.({ mqttTransport: p })}
                    aria-describedby={`${id}-${p}`}
                    className="mt-0.5 h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-text-primary">{m.transport[p]}</span>
                    <span id={`${id}-${p}`} className="mt-0.5 block text-xs text-text-secondary">{m.transport[`hint_${p}`]}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </ProfileSection>
      )}

      {showPlainMethods && (
        <ProfileSection title={m.transport.plainCommands} hint={m.transport.plainCommandsHint}>
          <TagInput
            id={`${id}-plain-commands`}
            label={m.transport.plainCommands}
            placeholder={m.transport.plainCommandsPlaceholder}
            value={plainMethods}
            disabled={disabled}
            error={errors.plaintextRpcMethods ? `${errors.plaintextRpcMethods}${badMethods.length ? ` (${badMethods.join(', ')})` : ''}` : undefined}
            onChange={(tags) => onChange?.({ plaintextRpcMethods: tags })}
          />
          <Callout variant="info" title={null}>{m.transport.plainNeverSent}</Callout>
        </ProfileSection>
      )}

      <ProfileSection title={m.transport.tokenInUrl} hint={m.transport.tokenInUrlHint}>
        <Toggle id={`${id}-token-url`} label={m.transport.tokenInUrl} checked={value.allowTokenInUrl} disabled={disabled} onChange={(v) => onChange?.({ allowTokenInUrl: v })} />
        {value.allowTokenInUrl && usesMqtt && <Callout variant="warning" title={null}>{m.transport.tokenInUrlMqtt}</Callout>}
      </ProfileSection>

      <ProfileSection title={m.transport.networks}>
        <TagInput
          id={`${id}-networks`}
          label={m.transport.networks}
          hint={m.transport.networksHint}
          placeholder={m.transport.networksPlaceholder}
          value={value.allowedNetworks}
          disabled={disabled}
          error={errors.allowedNetworks ? `${errors.allowedNetworks}${badNetworks.length ? ` (${badNetworks.join(', ')})` : ''}` : undefined}
          onChange={(tags) => onChange?.({ allowedNetworks: tags })}
        />
      </ProfileSection>
    </div>
  );
}
