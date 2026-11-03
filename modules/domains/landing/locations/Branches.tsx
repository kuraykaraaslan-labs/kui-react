'use client';
import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot, faPhone, faClock } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { MapCanvas } from '@/modules/ui/MapView/MapCanvas';
import type { MapMarker } from '@/modules/ui/MapView/types';

export type Branch = {
  name: string;
  address?: string;
  phone?: string;
  /** One line each: "Mon–Fri 09:00–18:00". */
  hours?: string[];
  /** `[latitude, longitude]`: the branch's pin on the map. */
  position?: [number, number];
  note?: string;
};

type BranchesProps = {
  title?: string;
  subtitle?: string;
  branches: Branch[];
  /** Show the map beside the list (when at least one branch has a position). Default true. */
  showMap?: boolean;
  /** Visible words, for another language; English by default. */
  labels?: Partial<{ directions: string; map: string; loading: string }>;
  className?: string;
};

const validPos = (p?: [number, number]): p is [number, number] =>
  !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;

/** A directions link: the pin on OpenStreetMap, else the address on Google Maps; undefined without either. */
export function directionsHref(b: Branch): string | undefined {
  if (validPos(b.position)) return `https://www.openstreetmap.org/?mlat=${b.position[0]}&mlon=${b.position[1]}#map=16/${b.position[0]}/${b.position[1]}`;
  if (b.address?.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address.trim())}`;
  return undefined;
}

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * A business's branches: a restaurant chain, a clinic group, a car rental with desks in town and at the airport.
 * Every branch is a card with its address, phone, hours and a directions link; all branches with a position are pins
 * on one map, the chosen one highlighted. Picking a card moves the map to it, and clicking a pin picks its card.
 * Mirrors next-boilerplate's dynamic_page Branches block (which shows one branch at a time in an embedded map).
 */
export function Branches({ title, subtitle, branches, showMap = true, labels, className }: BranchesProps) {
  const list = branches.filter((b) => b.name?.trim());
  const [active, setActive] = useState(0);
  const [seq, setSeq] = useState(0);
  const markers: MapMarker[] = useMemo(
    () => list.flatMap((b, i) => (validPos(b.position)
      ? [{ id: String(i), position: b.position, label: b.name, variant: i === active ? 'primary' : 'neutral', tooltip: { title: b.name, description: b.address } } as MapMarker]
      : [])),
    [list, active],
  );
  if (list.length === 0) return null;
  const mapOn = showMap && markers.length > 0;
  const pick = (i: number) => { setActive(i); setSeq((s) => s + 1); };

  return (
    <section className={cn('@container w-full text-text-primary', className)}>
      {(title || subtitle) && (
        <div className="mx-auto mb-10 max-w-2xl text-center">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
        </div>
      )}
      <div className={cn('grid gap-6', mapOn && '@4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
        <ul className={cn('grid gap-3', !mapOn && '@xl:grid-cols-2 @4xl:grid-cols-3')}>
          {list.map((b, i) => {
            const on = mapOn && i === active;
            const dir = directionsHref(b);
            return (
              <li key={i} className={cn('rounded-xl border bg-surface-raised p-4 transition-colors', on ? 'border-primary ring-1 ring-primary' : 'border-border')}>
                {mapOn ? (
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(i)}
                    className="w-full text-left text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    {b.name}
                  </button>
                ) : (
                  <h3 className="text-lg font-semibold">{b.name}</h3>
                )}
                {b.address && (
                  <p className="mt-2 flex items-start gap-2 text-sm text-text-secondary">
                    <FontAwesomeIcon icon={faLocationDot} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    {b.address}
                  </p>
                )}
                {b.phone && (
                  <p className="mt-1 flex items-center gap-2 text-sm">
                    <FontAwesomeIcon icon={faPhone} className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <a href={telHref(b.phone)} className="hover:underline">{b.phone}</a>
                  </p>
                )}
                {b.hours && b.hours.length > 0 && (
                  <div className="mt-1 flex items-start gap-2 text-sm text-text-secondary">
                    <FontAwesomeIcon icon={faClock} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <ul>{b.hours.slice(0, 7).map((h, hi) => <li key={hi} className="tabular-nums">{h}</li>)}</ul>
                  </div>
                )}
                {b.note && <p className="mt-2 text-xs text-text-secondary">{b.note}</p>}
                {dir && (
                  <a href={dir} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                    {labels?.directions ?? 'Directions'}
                    <span className="sr-only">: {b.name}</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        {mapOn && (
          <div className="h-[28rem] overflow-hidden rounded-xl border border-border @4xl:sticky @4xl:top-6">
            <MapCanvas
              markers={markers}
              // No focus until a card is picked: the map first fits every branch.
              focus={seq > 0 ? { id: String(active), seq } : null}
              onMarkerClick={(id) => setActive(Number(id))}
              ariaLabel={labels?.map ?? 'Map of the branches'}
              loadingLabel={labels?.loading}
              fitMaxZoom={14}
            />
          </div>
        )}
      </div>
    </section>
  );
}
