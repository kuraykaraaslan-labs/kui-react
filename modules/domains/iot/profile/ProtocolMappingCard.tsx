'use client';
import { useId } from 'react';
import { cn } from '@/libs/utils/cn';
import { Toggle } from '@/modules/ui/Toggle';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { TOPIC_SCHEMES, type DeviceProfileDraft, type TopicScheme } from '../types/profile';
import { ProfileSection, RangeNumberField } from './profile-fields';

/**
 * ProtocolMappingCard — the topic schemes and custom topics of a profile (OD-25, OD-26, OD-33, OD-35, OD-43, OD-44, OD-85): "Roltek
 * default" and/or "ThingsBoard compatible" (at least one; unchecking the last is impossible; ThingsBoard carries telemetry and
 * attributes only), and the any-topic settings (accept topics outside `v1/`, prefix keys with the topic, depth, length, distinct topics,
 * the raw cap) with their decided defaults 8 / 128 / 50 / 4 KB.
 */
export type ProtocolMappingValue = Pick<DeviceProfileDraft,
  'topicSchemes' | 'anyTopicEnabled' | 'prefixKeysWithTopic' | 'maxTopicDepth' | 'maxTopicLength' | 'maxDistinctTopicsPerDevice' | 'rawMaxBytes'>;

export type ProtocolMappingCardProps = {
  value: ProtocolMappingValue;
  onChange?: (patch: Partial<ProtocolMappingValue>) => void;
  errors?: Partial<Record<keyof ProtocolMappingValue, string>>;
  disabled?: boolean;
  messages?: IotMessagesInput;
  className?: string;
};

export function ProtocolMappingCard({ value, onChange, errors = {}, disabled, messages, className }: ProtocolMappingCardProps) {
  const { m } = useIotText(messages);
  const id = useId();
  function toggle(s: TopicScheme, on: boolean) {
    const next = on ? TOPIC_SCHEMES.filter((x) => x === s || value.topicSchemes.includes(x)) : value.topicSchemes.filter((x) => x !== s);
    if (next.length) onChange?.({ topicSchemes: next });
  }
  return (
    <div className={cn('space-y-4', className)}>
      <ProfileSection title={m.transport.schemes} hint={m.transport.reservedHint}>
        <fieldset className="grid gap-2 md:grid-cols-2" aria-label={m.transport.schemes}>
          {TOPIC_SCHEMES.map((s) => {
            const checked = value.topicSchemes.includes(s);
            const last = checked && value.topicSchemes.length === 1;
            return (
              <label
                key={s}
                className={cn(
                  'flex items-start gap-2 rounded-lg border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-border-focus',
                  checked ? 'border-primary bg-primary-subtle' : 'border-border bg-surface-base',
                  disabled || last ? 'cursor-not-allowed' : 'cursor-pointer hover:border-border-strong',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || last}
                  onChange={(e) => toggle(s, e.target.checked)}
                  aria-describedby={`${id}-${s}`}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-text-primary">{m.transport[s]}</span>
                  <span id={`${id}-${s}`} className="mt-0.5 block text-xs text-text-secondary">{m.transport[`hint_${s}`]}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        {errors.topicSchemes && <p role="alert" className="text-xs text-error">{errors.topicSchemes}</p>}
        {value.topicSchemes.length === 2 && <p className="text-xs text-text-secondary">{m.transport.bothHint}</p>}
        <p className="text-xs text-text-secondary">{m.transport.httpHint}</p>
      </ProfileSection>

      <ProfileSection title={m.transport.anyTopic} hint={m.transport.anyTopicHint}>
        <div className="space-y-3">
          <Toggle id={`${id}-any`} label={m.transport.anyTopicEnabled} checked={value.anyTopicEnabled} disabled={disabled} onChange={(v) => onChange?.({ anyTopicEnabled: v })} />
          <Toggle
            id={`${id}-prefix`}
            label={m.transport.prefixKeys}
            description={m.transport.prefixKeysHint}
            checked={value.prefixKeysWithTopic}
            disabled={disabled || !value.anyTopicEnabled}
            onChange={(v) => onChange?.({ prefixKeysWithTopic: v })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <RangeNumberField id={`${id}-depth`} label={m.transport.maxTopicDepth} range="maxTopicDepth" value={value.maxTopicDepth} error={errors.maxTopicDepth}
            disabled={disabled || !value.anyTopicEnabled} onChange={(v) => onChange?.({ maxTopicDepth: v ?? Number.NaN })} />
          <RangeNumberField id={`${id}-length`} label={m.transport.maxTopicLength} range="maxTopicLength" value={value.maxTopicLength} error={errors.maxTopicLength}
            disabled={disabled || !value.anyTopicEnabled} onChange={(v) => onChange?.({ maxTopicLength: v ?? Number.NaN })} />
          <RangeNumberField id={`${id}-distinct`} label={m.transport.maxDistinctTopicsPerDevice} range="maxDistinctTopicsPerDevice" value={value.maxDistinctTopicsPerDevice}
            error={errors.maxDistinctTopicsPerDevice} disabled={disabled || !value.anyTopicEnabled} onChange={(v) => onChange?.({ maxDistinctTopicsPerDevice: v ?? Number.NaN })} />
          <RangeNumberField id={`${id}-raw`} label={m.transport.rawMaxBytes} range="rawMaxBytes" value={value.rawMaxBytes} error={errors.rawMaxBytes}
            disabled={disabled} onChange={(v) => onChange?.({ rawMaxBytes: v ?? Number.NaN })} />
        </div>
      </ProfileSection>
    </div>
  );
}
