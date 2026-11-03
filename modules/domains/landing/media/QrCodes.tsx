'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/libs/utils/cn';

/** The addresses to encode: one, or one per table (`table=1…N`, at most 60) for a table menu. */
export function qrTargets(url: string, tables = 0): Array<{ label: number | null; url: string }> {
  const n = Math.max(0, Math.min(60, Math.floor(tables) || 0));
  if (n === 0) return [{ label: null, url }];
  const [path, hash = ''] = url.split('#');
  return Array.from({ length: n }, (_, i) => ({ label: i + 1, url: `${path}${path.includes('?') ? '&' : '?'}table=${i + 1}${hash ? `#${hash}` : ''}` }));
}

function Code({ url, alt, caption }: { url: string; alt: string; caption?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const absolute = /^https?:\/\//i.test(url) ? url : new URL(url, window.location.origin).toString();
    QRCode.toString(absolute, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((svg) => { if (live) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`); })
      .catch(() => { if (live) setSrc(null); });
    return () => { live = false; };
  }, [url]);
  return (
    <figure className="flex break-inside-avoid flex-col items-center rounded-xl border border-border bg-white p-4 text-center">
      {src ? <img src={src} alt={alt} className="h-40 w-40" /> : <div className="h-40 w-40 animate-pulse rounded bg-surface-overlay" aria-hidden="true" />}
      {caption && <figcaption className="mt-2 text-sm font-semibold text-black">{caption}</figcaption>}
    </figure>
  );
}

type QrCodesProps = {
  /** The page (a path on this site, or an http(s) address) the codes open. */
  url: string;
  /** One code per table (the page learns `?table=N`); 0 for a single code. */
  tables?: number;
  caption?: string;
  labels?: Partial<{ table: string; print: string }>;
  showPrint?: boolean;
  className?: string;
};

/**
 * QR codes: one to any page (a menu, the reviews page, booking), or one per table for a table menu, drawn in the
 * browser as SVG data URLs (no canvas, no markup) and ready to print on one sheet. Mirrors next-boilerplate's
 * dynamic_page QR codes block.
 */
export function QrCodes({ url, tables = 0, caption, labels, showPrint = true, className }: QrCodesProps) {
  if (!/^(https?:\/\/|\/)/i.test(url.trim())) return null;
  const word = labels?.table ?? 'Table';
  const codes = qrTargets(url.trim(), tables);
  return (
    <section className={cn('@container w-full', className)}>
      <div className={codes.length > 1 ? 'grid grid-cols-2 gap-4 @2xl:grid-cols-3 @4xl:grid-cols-4 print:grid-cols-3' : 'mx-auto w-fit'}>
        {codes.map((c) => <Code key={c.url} url={c.url} alt={c.label ? `QR code for ${word} ${c.label}` : `QR code: ${c.url}`} caption={c.label ? `${word} ${c.label}` : caption} />)}
      </div>
      {showPrint && (
        <p className="mt-6 text-center print:hidden">
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            {labels?.print ?? 'Print'}
          </button>
        </p>
      )}
    </section>
  );
}
