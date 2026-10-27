import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBuilding, faCube, faDoorOpen, faGears, faIndustry, faLayerGroup, faMap, faObjectGroup, faRoute, faDrawPolygon, faWarehouse,
} from '@fortawesome/free-solid-svg-icons';
import { isNamedAssetKind, type NamedAssetKind } from '../types/asset';
import type { IotMessages } from '../messages';

/** The icon of each named kind; any other kind (NB A-4: kinds are free) gets the neutral cube. */
export const ASSET_KIND_ICONS: Record<NamedAssetKind, IconDefinition> = {
  SITE: faIndustry,
  BUILDING: faBuilding,
  FLOOR: faLayerGroup,
  ROOM: faDoorOpen,
  AREA: faDrawPolygon,
  LINE: faRoute,
  MACHINE: faGears,
  OTHER: faCube,
  PLANT: faIndustry,
  REGION: faMap,
  ZONE: faObjectGroup,
  DEPOT: faWarehouse,
};

export function assetKindIcon(kind: string): IconDefinition {
  const k = kind.toUpperCase();
  return isNamedAssetKind(k) ? ASSET_KIND_ICONS[k] : faCube;
}

/** The label of a kind: the translated one for a named kind, else the kind itself in title case (`COLD_STORE` → `Cold store`). */
export function assetKindLabel(kind: string, m: IotMessages): string {
  const k = kind.toUpperCase();
  if (isNamedAssetKind(k)) return m.assetKind[k];
  return k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, ' ');
}
