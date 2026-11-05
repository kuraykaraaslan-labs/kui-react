import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { EsimScreen } from './EsimScreens';

export const metadata: Metadata = { title: buildPageTitle('eSIM', THEME_TITLES.iot) };

/** /theme/iot/esim — a router's eSIM chip and profiles: the device page's eSIM button and drawer, and the panel on its own (NB iot_esim 01). */
export default function EsimPage() {
  return <EsimScreen />;
}
