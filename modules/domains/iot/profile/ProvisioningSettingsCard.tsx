'use client';
import { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Callout } from '@/modules/ui/Callout';
import { Select } from '@/modules/ui/Select';
import { UnavailableContribution } from '@/modules/ui/UnavailableContribution';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { PROVISION_STRATEGIES, type ProvisionStrategy } from '../types/profile';
import { ProfileSection } from './profile-fields';

/**
 * ProvisioningSettingsCard — a profile's provisioning (02 §2.1, OD-1): the strategy select, where a strategy the host cannot serve yet
 * is listed disabled ("not available yet"), and the provisioning keys. The keys (rotation with key ids, revocation, the show-once
 * secret) are the host's `keys` (`ProvisioningKeysPanel`), with a note while the strategy is `DISABLED` (no device can register yet);
 * without them (`keys` absent: no provisioning service, or a viewer who may not manage it) the section is a clearly disabled
 * placeholder and no secret, key or button is drawn. `ROLTEK_FACTORY` belongs to platform templates and is never offered to a tenant.
 */
export type ProvisioningSettingsCardProps = {
  strategy: ProvisionStrategy;
  onChange?: (strategy: ProvisionStrategy) => void;
  /** The strategies the host can serve today (NB without iot_provisioning: `DISABLED` only). */
  availableStrategies?: readonly ProvisionStrategy[];
  /** The key management, when the host has it; absent = the disabled placeholder. */
  keys?: React.ReactNode;
  disabled?: boolean;
  messages?: IotMessagesInput;
  className?: string;
};

export function ProvisioningSettingsCard({ strategy, onChange, availableStrategies = ['DISABLED'], keys, disabled, messages, className }: ProvisioningSettingsCardProps) {
  const { m } = useIotText(messages);
  const id = useId();
  const choosable = availableStrategies.length > 1;
  // with a choice: the strategies the host serves (and the stored one); without one: every strategy, the coming ones marked
  const offered = PROVISION_STRATEGIES.filter((s) => (s !== 'ROLTEK_FACTORY' || strategy === 'ROLTEK_FACTORY')
    && (!choosable || availableStrategies.includes(s) || s === strategy));
  return (
    <div className={cn('space-y-4', className)}>
      <ProfileSection title={m.provisioning.strategy} hint={m.provisioning.strategyHint}>
        <Select
          id={`${id}-strategy`}
          label={m.provisioning.strategy}
          value={strategy}
          disabled={disabled || !choosable}
          onChange={(e) => onChange?.(e.target.value as ProvisionStrategy)}
          options={offered.map((s) => ({
            value: s,
            label: availableStrategies.includes(s) || s === strategy ? m.provisioning[s] : `${m.provisioning[s]} (${m.provisioning.notAvailable})`,
          }))}
        />
        <p className="text-xs text-text-secondary">{m.provisioning.volumeHint}</p>
      </ProfileSection>

      <ProfileSection title={m.provisioning.keysTitle}>
        {keys && strategy === 'DISABLED' && <Callout variant="info" title={null}>{m.provisioning.disabledNote}</Callout>}
        {keys ?? (
          <div aria-disabled="true" data-testid="provisioning-keys-placeholder">
            <UnavailableContribution
              reason="disabled"
              size="card"
              title={m.provisioning.keysTitle}
              label={m.provisioning.notAvailable}
              detail={m.provisioning.keysPlaceholder}
              icon={<FontAwesomeIcon icon={faKey} aria-hidden="true" />}
            />
          </div>
        )}
      </ProfileSection>
    </div>
  );
}
