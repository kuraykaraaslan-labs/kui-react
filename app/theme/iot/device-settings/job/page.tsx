import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { JobScreen } from '../DeviceSettingsScreens';

export const metadata: Metadata = { title: buildPageTitle('Bulk job', THEME_TITLES.iot) };

/** /theme/iot/device-settings/job?id= — one bulk settings job of the demo fleet. */
export default function DeviceSettingsJobPage() {
  return <JobScreen />;
}
