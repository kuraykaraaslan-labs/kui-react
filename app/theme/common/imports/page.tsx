import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { ImportsScreen } from './ImportsScreen';

export const metadata: Metadata = { title: buildPageTitle('Imports', THEME_TITLES.common) };

/** /theme/common/imports — ImportWizard: file, columns, check, result (with undo and a one-time download). */
export default function ImportsPage() {
  return <ImportsScreen />;
}
