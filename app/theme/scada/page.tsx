import type { Metadata } from 'next';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { ScadaOverview } from './_components/ScadaOverview';

export const metadata: Metadata = {
  title: { absolute: THEME_TITLES.scada },
};

/** The SCADA console overview: status tiles, the home network diagram, the devices and the recent events. */
export default function ScadaOverviewPage() {
  return <ScadaOverview />;
}
