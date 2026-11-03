'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilePdf, faFileWord, faFileExcel, faFileImage, faFileZipper, faFile, faDownload } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';

export type DownloadFile = { title: string; href: string; size?: string; description?: string };

type DownloadsProps = {
  title?: string;
  subtitle?: string;
  files: DownloadFile[];
  labels?: Partial<{ download: string }>;
  className?: string;
};

/** The file's kind from its address ("pdf", "docx"…), lower case; '' when it has none. */
export const fileKind = (href: string): string => /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(href)?.[1]?.toLowerCase() ?? '';
const ICON: Record<string, typeof faFile> = { pdf: faFilePdf, doc: faFileWord, docx: faFileWord, xls: faFileExcel, xlsx: faFileExcel, csv: faFileExcel, png: faFileImage, jpg: faFileImage, jpeg: faFileImage, webp: faFileImage, zip: faFileZipper };
const SAFE = /^(https?:\/\/|\/)/i;

/**
 * Downloads for a website: a brochure, a catalogue, a price list, a form. Each file has an icon for its kind, its
 * kind and size, and a download link a screen reader hears as "Download: Catalogue, PDF". Only http(s) and site paths
 * are linked. Mirrors next-boilerplate's dynamic_page Downloads block.
 */
export function Downloads({ title, subtitle, files, labels, className }: DownloadsProps) {
  const list = files.filter((f) => f.title?.trim() && SAFE.test(f.href?.trim() ?? ''));
  if (list.length === 0) return null;
  return (
    <section className={cn('@container w-full text-text-primary', className)}>
      {(title || subtitle) && (
        <div className="mx-auto mb-10 max-w-2xl text-center">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
        </div>
      )}
      <ul className="mx-auto grid max-w-4xl gap-3 @xl:grid-cols-2">
        {list.map((f, i) => {
          const kind = fileKind(f.href);
          return (
            <li key={i} className="flex items-center gap-4 rounded-xl border border-border bg-surface-raised p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                <FontAwesomeIcon icon={ICON[kind] ?? faFile} className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold [overflow-wrap:anywhere]">{f.title}</p>
                <p className="text-xs text-text-secondary">{[kind.toUpperCase(), f.size, f.description].filter(Boolean).join(' · ')}</p>
              </div>
              <a href={f.href} download target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" aria-hidden="true" />
                {labels?.download ?? 'Download'}<span className="sr-only">: {f.title}{kind ? `, ${kind.toUpperCase()}` : ''}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
