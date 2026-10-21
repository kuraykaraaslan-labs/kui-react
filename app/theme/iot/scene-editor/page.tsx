import type { Metadata } from 'next';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { SceneEditorDemo } from '../_components/SceneEditorDemo';

export const metadata: Metadata = {
  title: { absolute: `Process diagram editor · ${THEME_TITLES.iot}` },
};

/** The process diagram editor on a sample diagram. */
export default function IoTSceneEditorPage() {
  return <SceneEditorDemo />;
}
