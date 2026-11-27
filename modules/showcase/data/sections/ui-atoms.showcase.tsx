'use client';
import { buildButtonData } from './ui-atom-button.showcase';
import { buildBadgeData } from './ui-atom-badge.showcase';
import { buildAvatarData } from './ui-atom-avatar.showcase';
import { buildSpinnerData } from './ui-atom-spinner.showcase';
import { buildSkeletonData } from './ui-atom-skeleton.showcase';
import { buildButtonGroupData } from './ui-atom-button-group.showcase';
import { buildSkipLinkData } from './ui-atom-skip-link.showcase';
import { buildBrandLogoData } from './ui-atom-brand-logo.showcase';
import { buildStarRatingData } from './ui-atom-star-rating.showcase';
import { buildLabelData } from './ui-atom-label.showcase';
import { buildSeparatorData } from './ui-atom-separator.showcase';
import { buildScrollAreaData } from './ui-atom-scroll-area.showcase';
import { buildProgressData } from './ui-atom-progress.showcase';
import { buildStatisticData } from './ui-atom-statistic.showcase';
import { buildCountdownData } from './ui-atom-countdown.showcase';
import type { ShowcaseComponent } from '../showcase.types';

export function buildAtomsData(): ShowcaseComponent[] {
  return [
    ...buildButtonData(),
    ...buildBadgeData(),
    ...buildAvatarData(),
    ...buildSpinnerData(),
    ...buildSkeletonData(),
    ...buildButtonGroupData(),
    ...buildSkipLinkData(),
    ...buildBrandLogoData(),
    ...buildStarRatingData(),
    ...buildLabelData(),
    ...buildSeparatorData(),
    ...buildScrollAreaData(),
    ...buildProgressData(),
    ...buildStatisticData(),
    ...buildCountdownData(),
  ];
}
