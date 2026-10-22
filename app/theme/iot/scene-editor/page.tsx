import type { Metadata } from 'next';
import { Suspense } from 'react';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { SceneEditorDemo } from '../../scada/_components/SceneEditorDemo';

export const metadata: Metadata = {
  title: { absolute: `Process diagram editor · ${THEME_TITLES.iot}` },
};

/** The process diagram editor on a sample diagram (the SCADA theme's editor, also at /theme/scada/editor). */
export default function IoTSceneEditorPage() {
  return <Suspense><SceneEditorDemo /></Suspense>;
}
