import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { DEVICE_PROFILES } from '../../iot.data';
import { ProfileEditorScreen } from './ProfileEditorScreen';

export async function generateStaticParams() {
  return DEVICE_PROFILES.map((p) => ({ slug: p.profileId }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: buildPageTitle(DEVICE_PROFILES.find((p) => p.profileId === slug)?.name ?? slug, THEME_TITLES.iot) };
}

/** /theme/iot/profiles/[slug] — a thin page over `DeviceProfileEditorView` (phase 01 §1.4). */
export default async function DeviceProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProfileEditorScreen profileId={slug} />;
}
