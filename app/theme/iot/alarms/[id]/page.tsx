import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { ALARMS } from '../../iot.data';
import { AlarmDetailScreen } from './AlarmDetailScreen';

export function generateStaticParams() {
  return ALARMS.map((a) => ({ id: a.alarmId }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: buildPageTitle(ALARMS.find((a) => a.alarmId === id)?.title ?? 'Alarm', THEME_TITLES.iot) };
}

/** /theme/iot/alarms/[id] — a thin page over `AlarmDetailView` (phase 03 §3.1). */
export default async function AlarmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlarmDetailScreen alarmId={id} />;
}
