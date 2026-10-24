import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { DEVICES } from '../../iot.data';
import { DeviceDetailScreen } from './DeviceDetailScreen';

export async function generateStaticParams() {
  return DEVICES.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: buildPageTitle(DEVICES.find((d) => d.slug === slug)?.name ?? slug, THEME_TITLES.iot) };
}

/** /theme/iot/devices/[slug] — a thin page over `DeviceDetailView` (phase 01 §1.2). */
export default async function DeviceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DeviceDetailScreen slug={slug} />;
}
