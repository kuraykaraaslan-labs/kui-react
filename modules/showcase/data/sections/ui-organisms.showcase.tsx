'use client';
import { buildContainerData } from './ui-molecule-container.showcase';
import { buildFeedbackData } from './ui-molecule-feedback.showcase';
import { buildNavigationData } from './ui-molecule-navigation.showcase';
import { buildDocsData } from './ui-molecule-docs.showcase';
import { buildOverlayData } from './ui-molecule-overlay.showcase';
import { buildDataData } from './ui-molecule-data.showcase';
import { buildMediaData } from './ui-molecule-media.showcase';
import { buildImageGalleryData } from './ui-molecule-image-gallery.showcase';
import { buildCollectionsData } from './ui-molecule-collections.showcase';
import type { ShowcaseComponent } from '../showcase.types';

export function buildOrganismsData(): ShowcaseComponent[] {
  return [
    ...buildContainerData(),
    ...buildFeedbackData(),
    ...buildNavigationData(),
    ...buildDocsData(),
    ...buildOverlayData(),
    ...buildDataData(),
    ...buildMediaData(),
    ...buildImageGalleryData(),
    ...buildCollectionsData(),
  ];
}
