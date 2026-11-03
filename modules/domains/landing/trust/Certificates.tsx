'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAward } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';

export type Certificate = { title: string; issuer?: string; year?: string; number?: string; logoUrl?: string | null; logoAlt?: string; verifyHref?: string };

type CertificatesProps = {
  title?: string;
  subtitle?: string;
  items: Certificate[];
  labels?: Partial<{ verify: string; number: string }>;
  className?: string;
};

/**
 * Certificates, memberships and awards as badges: logo, what it is, issuer and year, its number, and a "verify" link
 * to the issuer's register, because a badge is only worth what its check is. Mirrors next-boilerplate's dynamic_page
 * Certificates & awards block.
 */
export function Certificates({ title, subtitle, items, labels, className }: CertificatesProps) {
  const list = items.filter((c) => c.title?.trim());
  if (list.length === 0) return null;
  return (
    <section className={cn('@container w-full text-text-primary', className)}>
      {(title || subtitle) && (
        <div className="mx-auto mb-10 max-w-2xl text-center">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
        </div>
      )}
      <ul className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-4">
        {list.map((c, i) => (
          <li key={i} className="flex flex-col items-center rounded-xl border border-border bg-surface-raised p-5 text-center">
            <span className="mb-3 flex h-16 w-16 items-center justify-center">
              {c.logoUrl
                ? <img src={c.logoUrl} alt={c.logoAlt ?? ''} loading="lazy" className="max-h-16 max-w-16 object-contain" />
                : <FontAwesomeIcon icon={faAward} className="h-10 w-10 text-primary" aria-hidden="true" />}
            </span>
            <h3 className="font-semibold">{c.title}</h3>
            {(c.issuer || c.year) && <p className="mt-1 text-sm text-text-secondary">{[c.issuer, c.year].filter(Boolean).join(' · ')}</p>}
            {c.number && <p className="mt-1 text-xs tabular-nums text-text-secondary">{(labels?.number ?? 'No. {{number}}').replace('{{number}}', c.number)}</p>}
            {c.verifyHref && /^https?:\/\//i.test(c.verifyHref) && (
              <a href={c.verifyHref} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm font-semibold text-primary hover:underline">
                {labels?.verify ?? 'Verify'}<span className="sr-only">: {c.title}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
