'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faDrawPolygon, faMap, faVideo, faMobileScreen } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { cn } from '@/libs/utils/cn';

/** Words a mark can start with that bring their own icon: "2D", "3D", "Map", "Live", "Mobile" (and the Turkish ones). */
const MARK_ICONS: Array<[RegExp, IconDefinition]> = [
  [/^2\s*[dDbB]\b/, faDrawPolygon],
  [/^3\s*[dDbB]\b/, faCube],
  [/^(map|harita)\b/i, faMap],
  [/^(live|canlı|video)\b/i, faVideo],
  [/^(mobile|mobil|app)\b/i, faMobileScreen],
];

export type ImageMark = string | { label: string; icon?: IconDefinition };

/** The marks to draw: empty ones dropped, at most three, each with its icon (given, or found from its first word). */
export function resolveMarks(marks: ImageMark[] | undefined): Array<{ label: string; icon?: IconDefinition }> {
  return (marks ?? [])
    .map((m) => (typeof m === 'string' ? { label: m.trim() } : { label: m.label.trim(), icon: m.icon }))
    .filter((m) => m.label)
    .slice(0, 3)
    .map((m) => ({ label: m.label, icon: m.icon ?? MARK_ICONS.find(([re]) => re.test(m.label))?.[1] }));
}

type ImageMarksProps = {
  marks?: ImageMark[];
  size?: 'md' | 'lg';
  /** Where in the picture: the bottom-left corner by default. */
  position?: 'bottom-left' | 'top-left' | 'bottom-right';
  className?: string;
};

/**
 * Large marks set into a picture ("2D", "3D", "Map"), so a card says what kind of screen it shows before anyone
 * opens it. Dark glass with white text reads on any screenshot in either theme; the marks stay real text, so a
 * screen reader hears them with the card. Place inside a `relative` box. Mirrors next-boilerplate's dynamic_page
 * image marks (Link cards and Device showcase).
 */
export function ImageMarks({ marks, size = 'lg', position = 'bottom-left', className }: ImageMarksProps) {
  const list = resolveMarks(marks);
  if (list.length === 0) return null;
  return (
    <ul
      data-image-marks
      className={cn(
        'pointer-events-none absolute z-10 flex flex-wrap gap-2',
        position === 'top-left' ? 'left-3 top-3' : position === 'bottom-right' ? 'bottom-3 right-3' : 'bottom-3 left-3',
        className,
      )}
    >
      {list.map((m, i) => (
        <li
          key={i}
          className={cn(
            'inline-flex items-center rounded-lg border border-white/20 bg-black/60 font-extrabold tracking-wide text-white shadow-lg backdrop-blur-md',
            size === 'lg' ? 'gap-2 px-3.5 py-1.5 text-lg' : 'gap-1.5 px-2.5 py-1 text-sm',
          )}
        >
          {m.icon && <FontAwesomeIcon icon={m.icon} className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden="true" />}
          {m.label}
        </li>
      ))}
    </ul>
  );
}
