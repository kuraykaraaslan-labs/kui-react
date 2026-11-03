import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { FirmwareScreen } from './FirmwareScreens';

export const metadata: Metadata = { title: buildPageTitle('Firmware', THEME_TITLES.iot) };

/** /theme/iot/firmware — firmware packages, upload, signing keys, and the device and profile Firmware tabs (docs/concepts/iot-platform/phases/06). */
export default function FirmwarePage() {
  return <FirmwareScreen />;
}
