import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { BaselinesScreen } from '../DeviceSettingsScreens';

export const metadata: Metadata = { title: buildPageTitle('Baselines', THEME_TITLES.iot) };

/** /theme/iot/device-settings/baselines — the settings baselines over the demo fleet. */
export default function DeviceSettingsBaselinesPage() {
  return <BaselinesScreen />;
}
