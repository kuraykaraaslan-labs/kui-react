'use client';
import { Callout } from '@/modules/ui/Callout';
import { TableOfContents, type TocItem } from '@/modules/ui/TableOfContents';
import { DocPager } from '@/modules/ui/DocPager';
import { ShareBar } from '@/modules/ui/ShareBar';
import type { ShowcaseComponent } from '../showcase.types';

// Long-form documentation pieces: admonitions, "On this page" navigation and
// previous/next pager. Consumed by @kuraykaraaslan/docs.

const TOC_ITEMS: TocItem[] = [
  { id: 'toc-demo-install', text: 'Installation', depth: 2 },
  { id: 'toc-demo-npm', text: 'With npm', depth: 3 },
  { id: 'toc-demo-git', text: 'From a git commit', depth: 3 },
  { id: 'toc-demo-config', text: 'Configuration', depth: 2 },
  { id: 'toc-demo-sidebars', text: 'Sidebars', depth: 3 },
];

export function buildDocsData(): ShowcaseComponent[] {
  return [
    {
      id: 'callout',
      title: 'Callout',
      category: 'Organism',
      abbr: 'Ad',
      description: 'Docs-style admonition (note, tip, info, warning, danger) for authored content. A labelled <aside>, never a live region — use AlertBanner for system feedback.',
      filePath: 'modules/ui/Callout.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faLightbulb,
  faNoteSticky,
  faTriangleExclamation,
  faCircleExclamation,
} from '@fortawesome/free-solid-svg-icons';

// Authored, static emphasis inside long-form content (docs, lessons, articles) —
// a Docusaurus-style admonition. Deliberately NOT AlertBanner: that one is a
// role="alert" live region for system feedback and takes a plain-string message;
// a callout is part of the page's prose, is never announced, and holds rich
// children (paragraphs, lists, code).

export type CalloutVariant = 'note' | 'tip' | 'info' | 'warning' | 'danger';

export const CALLOUT_VARIANTS: CalloutVariant[] = ['note', 'tip', 'info', 'warning', 'danger'];

const variantMap: Record<CalloutVariant, { container: string; icon: typeof faCircleInfo; label: string }> = {
  note:    { container: 'bg-surface-sunken border-border-strong text-text-primary', icon: faNoteSticky,          label: 'Note' },
  tip:     { container: 'bg-success-subtle border-success text-success-fg',        icon: faLightbulb,           label: 'Tip' },
  info:    { container: 'bg-info-subtle border-info text-info-fg',                 icon: faCircleInfo,          label: 'Info' },
  warning: { container: 'bg-warning-subtle border-warning text-warning-fg',        icon: faTriangleExclamation, label: 'Warning' },
  danger:  { container: 'bg-error-subtle border-error text-error-fg',              icon: faCircleExclamation,   label: 'Danger' },
};

type CalloutProps = {
  variant?: CalloutVariant;
  /** Heading text. Defaults to the variant's label ("Note", "Tip", ...); pass \`null\` for no heading. */
  title?: React.ReactNode | null;
  /** Replaces the variant's default icon; pass \`null\` for no icon. */
  icon?: React.ReactNode | null;
  children?: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>;

export function Callout({ variant = 'note', title, icon, children, className, ...rest }: CalloutProps) {
  const v = variantMap[variant];
  const heading = title === undefined ? v.label : title;
  const glyph = icon === undefined ? <FontAwesomeIcon icon={v.icon} className="w-3.5 h-3.5" /> : icon;

  return (
    <aside
      data-callout={variant}
      aria-label={typeof heading === 'string' ? heading : v.label}
      className={cn('my-4 rounded-lg border border-l-4 px-4 py-3 text-sm', v.container, className)}
      {...rest}
    >
      {(heading !== null || glyph !== null) && (
        <p className="mb-1 flex items-center gap-2 font-semibold">
          {glyph !== null && <span aria-hidden="true" className="shrink-0">{glyph}</span>}
          {heading}
        </p>
      )}
      <div className="leading-relaxed [&>:first-child]:mt-0 [&>:last-child]:mb-0">{children}</div>
    </aside>
  );
}
`,
      variants: [
        {
          title: 'Variants',
          layout: 'stack',
          preview: (
            <div className="w-full max-w-xl">
              <Callout variant="note">Sidebars are generated from the folder tree unless you list them.</Callout>
              <Callout variant="tip">Set <code>sidebar_position</code> in frontmatter to reorder a page.</Callout>
              <Callout variant="info">Drafts are skipped in production builds.</Callout>
              <Callout variant="warning">Changing a slug breaks existing links.</Callout>
              <Callout variant="danger">Never commit the npm token.</Callout>
            </div>
          ),
          code: `<Callout variant="note">…</Callout>
<Callout variant="tip">…</Callout>
<Callout variant="info">…</Callout>
<Callout variant="warning">…</Callout>
<Callout variant="danger">…</Callout>`,
        },
        {
          title: 'Custom title, no icon',
          preview: (
            <div className="w-full max-w-xl">
              <Callout variant="tip" title="Faster builds" icon={null}>
                <p>Content is parsed once at build time.</p>
                <ul className="list-disc pl-5"><li>No runtime markdown parser</li><li>No client JS for prose</li></ul>
              </Callout>
            </div>
          ),
          code: `<Callout variant="tip" title="Faster builds" icon={null}>
  <p>Content is parsed once at build time.</p>
</Callout>`,
        },
      ],
    },
    {
      id: 'table-of-contents',
      title: 'TableOfContents',
      category: 'Organism',
      abbr: 'Toc',
      description: '"On this page" heading navigation with built-in scroll-spy (IntersectionObserver) or a controlled activeId. Filters by heading depth.',
      filePath: 'modules/ui/TableOfContents.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { useScrollSpy } from '@/libs/hooks/useScrollSpy';

// "On this page" navigation for long-form content. Items are the page's own
// headings (id + text + depth); the active one is tracked with an
// IntersectionObserver unless the caller controls \`activeId\`.

export type TocItem = { id: string; text: string; depth: number };

type TableOfContentsProps = {
  items: TocItem[];
  title?: React.ReactNode;
  /** Shallowest heading depth to show. Default 2 (h2). */
  minDepth?: number;
  /** Deepest heading depth to show. Default 3 (h3). */
  maxDepth?: number;
  /** Controlled active heading id. When omitted the component scroll-spies the headings itself. */
  activeId?: string;
  /** Distance in px from the viewport top at which a heading counts as current (sticky header height). Default 80. */
  offset?: number;
  /** Accessible name of the nav landmark. Default "Table of contents". */
  ariaLabel?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>;

export function TableOfContents({
  items,
  title = 'On this page',
  minDepth = 2,
  maxDepth = 3,
  activeId,
  offset = 80,
  ariaLabel = 'Table of contents',
  className,
  ...rest
}: TableOfContentsProps) {
  const visible = items.filter((i) => i.depth >= minDepth && i.depth <= maxDepth);
  const spyActive = useScrollSpy(activeId === undefined ? visible.map((i) => i.id) : [], offset);
  const current = activeId ?? spyActive;

  if (visible.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className={cn('text-sm', className)} {...rest}>
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</p>}
      <ul className="space-y-1 border-l border-border">
        {visible.map((item) => {
          const isActive = item.id === current;
          return (
            <li key={item.id}>
              <a
                href={\`#\${item.id}\`}
                aria-current={isActive ? 'location' : undefined}
                style={{ paddingLeft: \`\${0.75 + (item.depth - minDepth) * 0.75}rem\` }}
                className={cn(
                  '-ml-px block border-l py-0.5 pr-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-r',
                  isActive
                    ? 'border-primary font-medium text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'
                )}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
`,
      variants: [
        {
          title: 'Controlled active heading',
          preview: <TableOfContents items={TOC_ITEMS} activeId="toc-demo-git" className="w-56" />,
          code: `<TableOfContents items={headings} activeId="from-a-git-commit" />`,
        },
        {
          title: 'Top level only',
          preview: <TableOfContents items={TOC_ITEMS} maxDepth={2} activeId="toc-demo-config" title="Contents" className="w-56" />,
          code: `<TableOfContents items={headings} maxDepth={2} title="Contents" />`,
        },
      ],
    },
    {
      id: 'doc-pager',
      title: 'DocPager',
      category: 'Organism',
      abbr: 'Pv',
      description: 'Previous / next page cards for the foot of a document. Each side names its neighbour; renderLink plugs in a router Link.',
      filePath: 'modules/ui/DocPager.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

// Previous / next page cards at the foot of a document. Unlike Pagination
// (numbered pages of one list), each side names the neighbouring page.

export type DocPagerLink = { title: string; href: string };

type DocPagerProps = {
  prev?: DocPagerLink | null;
  next?: DocPagerLink | null;
  labels?: { previous?: string; next?: string };
  /** Render a link yourself (a router \`Link\` for client-side navigation); defaults to a plain anchor. */
  renderLink?: (link: DocPagerLink, className: string, children: React.ReactNode) => React.ReactNode;
  /** Accessible name of the nav landmark. Default "Docs pages". */
  ariaLabel?: string;
  className?: string;
} & React.HTMLAttributes<HTMLElement>;

const cardClass = cn(
  'group flex flex-col gap-0.5 rounded-lg border border-border bg-surface-raised px-4 py-3 transition-colors',
  'hover:border-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
);

export function DocPager({
  prev,
  next,
  labels,
  renderLink,
  ariaLabel = 'Docs pages',
  className,
  ...rest
}: DocPagerProps) {
  if (!prev && !next) return null;

  const link = (target: DocPagerLink, align: 'start' | 'end', label: string) => {
    const cls = cn(cardClass, align === 'end' && 'items-end text-right');
    const body = (
      <>
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          {align === 'start' && <FontAwesomeIcon icon={faChevronLeft} className="w-2.5 h-2.5" aria-hidden="true" />}
          {label}
          {align === 'end' && <FontAwesomeIcon icon={faChevronRight} className="w-2.5 h-2.5" aria-hidden="true" />}
        </span>
        <span className="text-sm font-medium text-text-primary group-hover:text-primary">{target.title}</span>
      </>
    );
    return renderLink ? renderLink(target, cls, body) : <a href={target.href} rel={align === 'start' ? 'prev' : 'next'} className={cls}>{body}</a>;
  };

  return (
    <nav aria-label={ariaLabel} className={cn('grid gap-3 sm:grid-cols-2', className)} {...rest}>
      {prev ? link(prev, 'start', labels?.previous ?? 'Previous') : <span aria-hidden="true" />}
      {next ? link(next, 'end', labels?.next ?? 'Next') : null}
    </nav>
  );
}
`,
      variants: [
        {
          title: 'Both neighbours',
          layout: 'stack',
          preview: (
            <DocPager className="w-full max-w-2xl" prev={{ title: 'Installation', href: '#' }} next={{ title: 'Configuration', href: '#' }} />
          ),
          code: `<DocPager prev={{ title: 'Installation', href: '/docs/install' }} next={{ title: 'Configuration', href: '/docs/config' }} />`,
        },
        {
          title: 'First page (next only)',
          layout: 'stack',
          preview: <DocPager className="w-full max-w-2xl" next={{ title: 'Getting started', href: '#' }} labels={{ next: 'Start here' }} />,
          code: `<DocPager next={{ title: 'Getting started', href: '/docs/intro' }} labels={{ next: 'Start here' }} />`,
        },
      ],
    },
    {
      id: 'share-bar',
      title: 'ShareBar',
      category: 'Molecule',
      abbr: 'Sh',
      description: 'Share the current page: networks inline and a … button that opens a window with every network, e-mail, copy link and the device share sheet. Plain links, no third-party scripts.',
      filePath: 'modules/ui/ShareBar.tsx',
      sourceCode: `'use client';
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
  linkedin: { name: 'LinkedIn', icon: faLinkedinIn, href: (u) => \`https://www.linkedin.com/sharing/share-offsite/?url=\${u}\` },
  x: { name: 'X', icon: faXTwitter, href: (u, t) => \`https://x.com/intent/post?url=\${u}&text=\${t}\` },
  whatsapp: { name: 'WhatsApp', icon: faWhatsapp, href: (u, t) => \`https://wa.me/?text=\${t}%20\${u}\` },
  facebook: { name: 'Facebook', icon: faFacebookF, href: (u) => \`https://www.facebook.com/sharer/sharer.php?u=\${u}\` },
  telegram: { name: 'Telegram', icon: faTelegram, href: (u, t) => \`https://t.me/share/url?url=\${u}&text=\${t}\` },
  reddit: { name: 'Reddit', icon: faRedditAlien, href: (u, t) => \`https://www.reddit.com/submit?url=\${u}&title=\${t}\` },
  email: { name: 'E-mail', icon: faEnvelope, href: (u, t) => \`mailto:?subject=\${t}&body=\${u}\` },
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
`,
      variants: [
        {
          title: 'Default: LinkedIn, X, WhatsApp and more',
          preview: <ShareBar url="https://example.com/docs/getting-started/" title="Getting started" />,
          code: `<ShareBar url={pageUrl} title={pageTitle} />`,
        },
        {
          title: 'Without label, custom inline networks, translated labels',
          preview: (
            <ShareBar
              url="https://example.com/blog/release-notes/"
              title="Release notes"
              hideLabel
              inline={['linkedin', 'email']}
              labels={{ share: 'Teilen', more: 'Weitere Optionen', dialogTitle: 'Diese Seite teilen', address: 'Seitenadresse', copy: 'Kopieren', copied: 'Kopiert', moreApps: 'Weitere Apps', email: 'E-Mail', shareOn: 'Auf %s teilen' }}
            />
          ),
          code: `<ShareBar url={pageUrl} title={pageTitle} hideLabel inline={['linkedin', 'email']} labels={{ copy: 'Kopieren', copied: 'Kopiert' }} />`,
        },
      ],
    },
  ];
}
