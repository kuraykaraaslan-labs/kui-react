'use client';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faEllipsis, faEnvelope, faLink } from '@fortawesome/free-solid-svg-icons';
import { faFacebookF, faLinkedinIn, faRedditAlien, faTelegram, faWhatsapp, faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { Modal } from './Modal';

// Share the current page: a few networks inline and a "…" button that opens a
// window with every network, e-mail, copy link and the device's own share sheet.
// Plain links to each network's share address: no third-party scripts, no tracking.

export type ShareNetwork = 'linkedin' | 'x' | 'whatsapp' | 'facebook' | 'telegram' | 'reddit' | 'email';

type ShareBarLabels = {
  share?: string;
  more?: string;
  dialogTitle?: string;
  address?: string;
  copy?: string;
  copied?: string;
  moreApps?: string;
  /** "Share on %s"; %s is the network name. */
  shareOn?: string;
  email?: string;
};

type ShareBarProps = {
  /** Address to share. */
  url: string;
  /** Page title, sent where the network takes one. */
  title?: string;
  /** Networks shown as buttons in the bar. Default LinkedIn, X, WhatsApp. */
  inline?: ShareNetwork[];
  /** Networks in the window. Default all seven. */
  networks?: ShareNetwork[];
  /** Hide the "Share" label before the buttons. */
  hideLabel?: boolean;
  labels?: ShareBarLabels;
  onShare?: (network: ShareNetwork | 'copy' | 'native') => void;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>;

const NETWORKS: Record<ShareNetwork, { name: string; icon: IconDefinition; href: (u: string, t: string) => string }> = {
  linkedin: { name: 'LinkedIn', icon: faLinkedinIn, href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  x: { name: 'X', icon: faXTwitter, href: (u, t) => `https://x.com/intent/post?url=${u}&text=${t}` },
  whatsapp: { name: 'WhatsApp', icon: faWhatsapp, href: (u, t) => `https://wa.me/?text=${t}%20${u}` },
  facebook: { name: 'Facebook', icon: faFacebookF, href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  telegram: { name: 'Telegram', icon: faTelegram, href: (u, t) => `https://t.me/share/url?url=${u}&text=${t}` },
  reddit: { name: 'Reddit', icon: faRedditAlien, href: (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}` },
  email: { name: 'E-mail', icon: faEnvelope, href: (u, t) => `mailto:?subject=${t}&body=${u}` },
};

const ALL: ShareNetwork[] = ['linkedin', 'x', 'whatsapp', 'facebook', 'telegram', 'reddit', 'email'];

const buttonClass = cn(
  'inline-grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-base text-text-secondary transition-colors',
  'hover:bg-surface-overlay hover:text-text-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
);

const tileClass = cn(
  'grid justify-items-center gap-1.5 rounded-[0.625rem] border border-border bg-surface-base px-1 py-3 text-xs text-text-primary transition-colors',
  'hover:border-primary hover:text-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
);

export function ShareBar({
  url,
  title = '',
  inline = ['linkedin', 'x', 'whatsapp'],
  networks = ALL,
  hideLabel = false,
  labels,
  onShare,
  className,
  ...rest
}: ShareBarProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputId = useId();
  const l = {
    share: 'Share',
    more: 'More ways to share',
    dialogTitle: 'Share this page',
    address: 'Page address',
    copy: 'Copy',
    copied: 'Copied',
    moreApps: 'More apps',
    shareOn: 'Share on %s',
    email: 'E-mail',
    ...labels,
  };
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  // The window only renders after a click, on the client, so the device share sheet can be checked here.
  const canNative = open && typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const name = (n: ShareNetwork) => (n === 'email' ? l.email : NETWORKS[n].name);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const link = (n: ShareNetwork, cls: string, withName: boolean) => {
    const external = n !== 'email';
    return (
      <a
        key={n}
        href={NETWORKS[n].href(u, t)}
        className={cls}
        aria-label={l.shareOn.replace('%s', name(n))}
        onClick={() => onShare?.(n)}
        {...(external ? { target: '_blank', rel: 'noopener nofollow' } : {})}
      >
        <FontAwesomeIcon icon={NETWORKS[n].icon} className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        {withName ? <span>{name(n)}</span> : <span className="sr-only">{name(n)}</span>}
      </a>
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onShare?.('copy');
    } catch {
      (document.getElementById(inputId) as HTMLInputElement | null)?.select();
    }
  };

  const native = () => {
    navigator.share?.({ title, url }).then(() => onShare?.('native')).catch(() => {});
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)} {...rest}>
      {!hideLabel && <span className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">{l.share}</span>}
      <div className="flex gap-1.5">
        {inline.map((n) => link(n, buttonClass, false))}
        <button type="button" className={buttonClass} aria-haspopup="dialog" aria-expanded={open} aria-label={l.more} onClick={() => setOpen(true)}>
          <FontAwesomeIcon icon={faEllipsis} className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={l.dialogTitle} size="sm">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface-base py-1.5 pl-3 pr-1.5 text-text-secondary">
          <FontAwesomeIcon icon={faLink} className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            id={inputId}
            type="text"
            readOnly
            value={url}
            aria-label={l.address}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text-primary outline-none"
          />
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-primary px-3 py-1.5 text-[0.8125rem] font-semibold text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {copied ? l.copied : l.copy}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {networks.map((n) => link(n, tileClass, true))}
          {canNative && (
            <button type="button" className={tileClass} onClick={native}>
              <FontAwesomeIcon icon={faEllipsis} className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
              <span>{l.moreApps}</span>
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
