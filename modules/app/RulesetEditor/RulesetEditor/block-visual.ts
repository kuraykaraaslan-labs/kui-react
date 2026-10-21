'use client';
import {
  faArrowDownAZ, faBell, faBolt, faBoxesStacked, faBug, faBullseye, faCalculator, faCalendarDays, faChartColumn, faChartLine,
  faCircle, faCircleCheck, faCircleNodes, faCirclePlay, faClipboardList, faClock, faCode, faCodeBranch, faCube, faDatabase,
  faDoorOpen, faEnvelope, faEquals, faEye, faFileCode, faFileLines, faFilter, faGaugeHigh, faGears, faGlobe, faHashtag,
  faHourglassHalf, faKey, faLayerGroup, faLightbulb, faLink, faList, faLock, faMicrochip, faNetworkWired, faPaperPlane, faPen,
  faPlus, faPowerOff, faRepeat, faRightFromBracket, faRightLeft, faRightToBracket, faServer, faShuffle,
  faSliders, faStopwatch, faTable, faToggleOff, faToggleOn, faTowerBroadcast, faTriangleExclamation, faWaveSquare, faWifi,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { BlockDecl } from '../catalog/types';
import { NODE_VISUALS } from './node-meta';

/** Icons by the names blocks of a catalog give them (the Font Awesome names). */
export const ICONS_BY_NAME: Record<string, IconDefinition> = {
  'arrow-down-a-z': faArrowDownAZ, bell: faBell, bolt: faBolt, 'boxes-stacked': faBoxesStacked, bug: faBug, bullseye: faBullseye,
  calculator: faCalculator, calendar: faCalendarDays, 'calendar-days': faCalendarDays, 'chart-column': faChartColumn,
  'chart-line': faChartLine, circle: faCircle, 'circle-check': faCircleCheck, 'circle-nodes': faCircleNodes, 'circle-play': faCirclePlay,
  'clipboard-list': faClipboardList, clock: faClock, code: faCode, 'code-branch': faCodeBranch, box: faCube, cube: faCube,
  database: faDatabase, 'door-open': faDoorOpen, envelope: faEnvelope, equals: faEquals, eye: faEye, 'file-code': faFileCode,
  'file-lines': faFileLines, filter: faFilter, 'gauge-high': faGaugeHigh, gears: faGears, globe: faGlobe, hashtag: faHashtag,
  'hourglass-half': faHourglassHalf, key: faKey, 'layer-group': faLayerGroup, lightbulb: faLightbulb, link: faLink, list: faList,
  lock: faLock, microchip: faMicrochip, 'network-wired': faNetworkWired, 'paper-plane': faPaperPlane, pen: faPen, plus: faPlus,
  'power-off': faPowerOff, repeat: faRepeat, 'right-from-bracket': faRightFromBracket, 'right-left': faRightLeft,
  'right-to-bracket': faRightToBracket, server: faServer, shuffle: faShuffle, sliders: faSliders, stopwatch: faStopwatch,
  table: faTable, 'toggle-off': faToggleOff, 'toggle-on': faToggleOn, 'tower-broadcast': faTowerBroadcast,
  'triangle-exclamation': faTriangleExclamation, 'wave-square': faWaveSquare, wifi: faWifi,
};

const CATEGORY_ICONS: Record<string, IconDefinition> = {
  trigger: faBolt, cond: faFilter, logic: faGears, action: faBullseye, ui: faGaugeHigh, flow: faRightLeft,
};

export type BlockLook = { icon: IconDefinition; iconColor: string; headerBg: string };

/**
 * How a block looks on the canvas and in the palette: its own icon, else the one its icon name points
 * to, else one for its category; the colours of the block, or those of a placeholder for an unknown type.
 */
export function lookOf(decl: BlockDecl | undefined): BlockLook {
  const fallback = NODE_VISUALS.PLACEHOLDER;
  if (!decl) return { icon: fallback.icon, iconColor: fallback.iconColor, headerBg: fallback.headerBg };
  const visual = decl.visual;
  const named = visual?.iconName ? ICONS_BY_NAME[visual.iconName] : undefined;
  return {
    icon: visual?.icon ?? named ?? CATEGORY_ICONS[decl.category ?? decl.type.split('.')[0]] ?? faCube,
    iconColor: visual?.iconColor ?? fallback.iconColor,
    headerBg: visual?.headerBg ?? fallback.headerBg,
  };
}
