import type { Metadata } from 'next';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { ScadaDiagram } from '../_components/ScadaDiagram';

export const metadata: Metadata = {
  title: { absolute: `Diagram · ${THEME_TITLES.scada}` },
};

/** The home network diagram across the page, with the legend of the symbols and their states. */
export default function ScadaDiagramPage() {
  return <ScadaDiagram />;
}
