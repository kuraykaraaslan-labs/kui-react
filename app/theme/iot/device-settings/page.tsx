import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { JobsScreen } from './DeviceSettingsScreens';

export const metadata: Metadata = { title: buildPageTitle('Bulk settings', THEME_TITLES.iot) };

/** /theme/iot/device-settings — the bulk settings jobs (next-boilerplate iot-device-settings 05) over the demo fleet. */
export default function DeviceSettingsJobsPage() {
  return <JobsScreen />;
}
