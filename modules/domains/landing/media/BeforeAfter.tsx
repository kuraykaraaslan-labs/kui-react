'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faLeftRight } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';

export type BeforeAfterPair = {
  before?: string | null;
  after?: string | null;
  beforeAlt?: string;
  afterAlt?: string;
  caption?: string;
};

type BeforeAfterProps = {
  title?: string;
  subtitle?: string;
  pairs: BeforeAfterPair[];
  /** `slider`: the after picture over the before, cut at a handle. `side-by-side`: two pictures. */
  mode?: 'slider' | 'side-by-side';
  imageShape?: 'standard' | 'square' | 'portrait';
  /** What the pictures are ("Our own jobs, photographed on site"). */
  note?: string;
  /** Visible words, for another language; English by default. */
  labels?: Partial<{ before: string; after: string }>;
  className?: string;
};

const ASPECT = { standard: 'aspect-[4/3]', square: 'aspect-square', portrait: 'aspect-[4/5]' } as const;

function Picture({ src, alt }: { src?: string | null; alt: string }) {
  return src ? (
    <img src={src} alt={alt} loading="lazy" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-overlay text-text-disabled" aria-hidden="true">
      <FontAwesomeIcon icon={faImage} className="h-8 w-8" />
    </div>
  );
}

function Slider({ pair, before, after, aspect }: { pair: BeforeAfterPair; before: string; after: string; aspect: string }) {
  const [at, setAt] = useState(50);
  return (
    <div className={cn('relative overflow-hidden rounded-xl', aspect)} data-before-after>
      <Picture src={pair.before} alt={pair.beforeAlt ?? before} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${at}%)` }}>
        <Picture src={pair.after} alt={pair.afterAlt ?? after} />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">{before}</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">{after}</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${at}%` }} aria-hidden="true">
        <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-text-primary shadow-lg">
          <FontAwesomeIcon icon={faLeftRight} className="h-4 w-4" />
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={at}
        onChange={(e) => setAt(Number(e.target.value))}
        aria-label={`${before} / ${after}`}
        aria-valuetext={`${at}%`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

/**
 * Before / after pictures: a haircut, a renovated kitchen, a cleaned carpet. Each pair is a slider (a real range
 * input over the pair, so a finger, a mouse and the arrow keys move it) or two pictures side by side, with a caption;
 * a note says what the pictures are. Not for health or medical aesthetics, where many rules forbid before / after
 * pictures. Mirrors next-boilerplate's dynamic_page Before / after block.
 */
export function BeforeAfter({ title, subtitle, pairs, mode = 'slider', imageShape = 'standard', note, labels, className }: BeforeAfterProps) {
  if (pairs.length === 0) return null;
  const before = labels?.before ?? 'Before';
  const after = labels?.after ?? 'After';
  const aspect = ASPECT[imageShape];
  return (
    <section className={cn('@container w-full text-text-primary', className)}>
      {(title || subtitle) && (
        <div className="mx-auto mb-10 max-w-2xl text-center">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
        </div>
      )}
      <ul className={cn('grid gap-8', mode === 'slider' && pairs.length > 1 ? '@3xl:grid-cols-2' : 'mx-auto max-w-3xl')}>
        {pairs.slice(0, 12).map((p, i) => (
          <li key={i}>
            {mode === 'side-by-side' ? (
              <div className="grid grid-cols-2 gap-3">
                {([[p.before, p.beforeAlt ?? before, before], [p.after, p.afterAlt ?? after, after]] as const).map(([src, alt, label], k) => (
                  <figure key={k}>
                    <div className={cn('relative overflow-hidden rounded-xl', aspect)}><Picture src={src} alt={alt} /></div>
                    <figcaption className="mt-2 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <Slider pair={p} before={before} after={after} aspect={aspect} />
            )}
            {p.caption && <p className="mt-3 text-center text-sm text-text-secondary">{p.caption}</p>}
          </li>
        ))}
      </ul>
      {note && <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-text-secondary">{note}</p>}
    </section>
  );
}
