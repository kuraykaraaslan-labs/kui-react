'use client';
import { Badge } from '@/modules/ui/Badge';
import type { SettingsSectionState } from '../types/settings';
import type { SettingsMessagesInput } from './messages';
import { useSettingsText } from './SettingsText';

type Variant = 'success' | 'error' | 'warning' | 'info' | 'neutral';
const VARIANT: Record<SettingsSectionState, Variant> = {
  applied: 'success', pending: 'info', confirming: 'info', reverted: 'warning', rejected: 'error', expired: 'neutral', needs_review: 'warning',
};

/**
 * SettingsStateBadge — where a settings section stands, in words: applied, on its way, the device trying it, undone or refused by the
 * device, withdrawn while the device was offline, to check after a firmware update; and "Changed on the device" beside it when the device
 * runs something else than was asked (drift). A section never changed from here says so.
 */
export function SettingsStateBadge({ state, drift = false, size = 'md', messages, className }: {
  state: SettingsSectionState | null;
  drift?: boolean;
  size?: 'sm' | 'md';
  messages?: SettingsMessagesInput;
  className?: string;
}) {
  const { m } = useSettingsText(messages);
  return (
    <span className={className ? `inline-flex flex-wrap items-center gap-1 ${className}` : 'inline-flex flex-wrap items-center gap-1'} data-state={state ?? 'never'}>
      <Badge size={size} variant={state ? VARIANT[state] : 'neutral'} dot={state === 'pending' || state === 'confirming'}>{state ? m.state[state] : m.state.never}</Badge>
      {drift && <Badge size={size} variant="warning">{m.state.drift}</Badge>}
    </span>
  );
}
