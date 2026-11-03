import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { FirmwarePackageScreen } from '../FirmwareScreens';

export const metadata: Metadata = { title: buildPageTitle('Firmware package', THEME_TITLES.iot) };

/** /theme/iot/firmware/package?id= — one firmware package: details, assignments and its devices' updates. */
export default function FirmwarePackagePage() {
  return <FirmwarePackageScreen />;
}
