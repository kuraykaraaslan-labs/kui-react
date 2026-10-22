import type { Metadata } from 'next';
import { Suspense } from 'react';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { SceneEditorDemo } from '../_components/SceneEditorDemo';

export const metadata: Metadata = {
  title: { absolute: `Diagram editor · ${THEME_TITLES.scada}` },
};

/** The process diagram editor on the home network diagram (`?scene=empty` starts from a blank canvas). */
export default function ScadaEditorPage() {
  return <Suspense><SceneEditorDemo /></Suspense>;
}
