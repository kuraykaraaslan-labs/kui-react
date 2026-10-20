// The pure text logic of the widget card (no React): the "Updated …" footer text. `WidgetCard.tsx` draws the
// card; kui-ejs and KUInative vendor this file.

import type { CardSettings } from './settings/types';

export function formatUpdated(at: Date | string | number | null | undefined, mode: CardSettings['showUpdated'], locale?: string, now = Date.now()): string | null {
  if (!at || !mode || mode === 'off') return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  if (mode === 'relative') {
    const s = Math.round((now - d.getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (Math.abs(s) < 60) return rtf.format(-s, 'second');
    if (Math.abs(s) < 3600) return rtf.format(-Math.round(s / 60), 'minute');
    if (Math.abs(s) < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
    return rtf.format(-Math.round(s / 86400), 'day');
  }
  const opts: Intl.DateTimeFormatOptions =
    mode === 'time' ? { hour: '2-digit', minute: '2-digit' }
      : mode === 'date' ? { day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat(locale, opts).format(d);
}
