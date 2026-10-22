'use client';
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
  /** Heading text. Defaults to the variant's label ("Note", "Tip", ...); pass `null` for no heading. */
  title?: React.ReactNode | null;
  /** Replaces the variant's default icon; pass `null` for no icon. */
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
