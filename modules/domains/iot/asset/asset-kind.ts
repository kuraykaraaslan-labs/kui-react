import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBuilding, faCube, faDoorOpen, faGears, faIndustry, faLayerGroup, faRoute, faDrawPolygon,
} from '@fortawesome/free-solid-svg-icons';
import { isSuggestedAssetKind, type SuggestedAssetKind } from '../types/asset';
import type { IotMessages } from '../messages';

/** The icon of each suggested kind; any other kind (NB A-4: kinds are free) gets the neutral cube. */
export const ASSET_KIND_ICONS: Record<SuggestedAssetKind, IconDefinition> = {
  SITE: faIndustry,
  BUILDING: faBuilding,
  FLOOR: faLayerGroup,
  ROOM: faDoorOpen,
  AREA: faDrawPolygon,
  LINE: faRoute,
  MACHINE: faGears,
  OTHER: faCube,
};

export function assetKindIcon(kind: string): IconDefinition {
  const k = kind.toUpperCase();
  return isSuggestedAssetKind(k) ? ASSET_KIND_ICONS[k] : faCube;
}

/** The label of a kind: the translated one for a suggested kind, else the kind itself in title case (`DEPOT` → `Depot`). */
export function assetKindLabel(kind: string, m: IotMessages): string {
  const k = kind.toUpperCase();
  if (isSuggestedAssetKind(k)) return m.assetKind[k];
  return k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, ' ');
}
