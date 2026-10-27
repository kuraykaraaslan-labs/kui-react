import type { Metadata } from 'next';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { SceneSetupDemo } from '../_components/SceneSetupDemo';

export const metadata: Metadata = {
  title: { absolute: `Scene setup · ${THEME_TITLES.iot}` },
};

/** The scene setup drawer (WidgetKit) on sample documents, one device and its elements. */
export default function IoTSceneSetupPage() {
  return <SceneSetupDemo />;
}
