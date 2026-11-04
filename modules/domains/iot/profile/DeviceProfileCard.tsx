'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faStar } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { fill } from '../format';
import { transportLabel, type DeviceProfile } from '../types/profile';

/**
 * DeviceProfileCard — one profile at a glance (phase 01 §1.4, NB iot_device_profile 03 §3.2): name, the default star, the template it
 * was copied from (`roltek-m1 v3`), its transport and online rule, and how many devices use it (null = unknown, shown as a dash).
 */
export type DeviceProfileCardProps = {
  profile: Pick<DeviceProfile, 'profileId' | 'name' | 'description' | 'isDefault' | 'transportType' | 'onlineRule' | 'template'>;
  deviceCount?: number | null;
  href?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function DeviceProfileCard({ profile, deviceCount, href, messages, className }: DeviceProfileCardProps) {
  const { m } = useIotText(messages);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-semibold text-text-primary">
            {profile.isDefault && <FontAwesomeIcon icon={faStar} className="h-3.5 w-3.5 shrink-0 text-warning" aria-label={m.profiles.defaultBadge} />}
            <span className="truncate">{profile.name}</span>
          </p>
          {profile.description && <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{profile.description}</p>}
        </div>
        {profile.template && <Badge variant="info" size="sm">{fill(m.profile.template, { key: profile.template.key, version: profile.template.version })}</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="neutral" size="sm">{transportLabel(profile.transportType, (t) => m.transport[t])}</Badge>
        <Badge variant="neutral" size="sm">{m.online[profile.onlineRule]}</Badge>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-text-secondary">
          <FontAwesomeIcon icon={faMicrochip} className="h-3 w-3" aria-hidden="true" />
          <span>{deviceCount === null || deviceCount === undefined ? '—' : deviceCount}</span>
          <span className="sr-only">{m.profiles.devices}</span>
        </span>
      </div>
    </>
  );
  const box = 'block rounded-xl border border-border bg-surface-raised p-4 text-sm';
  return href ? (
    <a href={href} className={cn(box, 'transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', className)}>{body}</a>
  ) : (
    <div className={cn(box, className)}>{body}</div>
  );
}
