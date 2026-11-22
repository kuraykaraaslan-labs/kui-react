import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { RateLimitsScreen } from './RateLimitsScreen';

export const metadata: Metadata = { title: buildPageTitle('Rate limits', THEME_TITLES.iot) };

/** /theme/iot/rate-limits — the device page's read-only "Rate limits" drawer (NB iot-gateway 06 §6.4, W8G-6). */
export default function RateLimitsPage() {
  return <RateLimitsScreen />;
}
