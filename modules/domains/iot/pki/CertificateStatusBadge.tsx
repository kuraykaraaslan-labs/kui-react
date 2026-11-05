'use client';
import { Badge } from '@/modules/ui/Badge';
import { fillText, mergePkiMessages, type PkiMessagesInput } from './messages';
import type { DeviceCertificate } from './types';

const DAY_MS = 86_400_000;
/** NB iot_pki PK-09 / FZ-36: a device renews no later than 30 days before notAfter; the page offers Renew from then on. */
export const RENEW_OFFER_DAYS = 30;

/** Whole days until notAfter (0 on the last day, negative once passed). */
export function certificateDaysLeft(cert: Pick<DeviceCertificate, 'notAfter'>, now = Date.now()): number {
  return Math.floor((new Date(cert.notAfter).getTime() - now) / DAY_MS);
}

/**
 * Whether the device page offers "Renew certificate" (NB iot_pki 03 §3.1): an ACTIVE certificate with fewer than 30 days left, or one whose
 * key the platform generated (a re-key campaign: the device should make its own key).
 */
export function renewOffered(cert: Pick<DeviceCertificate, 'status' | 'notAfter' | 'serverKeygen'>, now = Date.now(), offerDays = RENEW_OFFER_DAYS): boolean {
  if (cert.status !== 'ACTIVE') return false;
  const left = certificateDaysLeft(cert, now);
  return left >= 0 && (left < offerDays || cert.serverKeygen);
}

/**
 * CertificateStatusBadge — a certificate's state in one badge: Active (green; amber with the days left once fewer than `warnDays` remain),
 * Superseded (neutral: a newer certificate replaced it, it still works until revoked after the grace), Revoked and Expired (red).
 */
export function CertificateStatusBadge({ certificate, now, warnDays = RENEW_OFFER_DAYS, messages, className }: {
  certificate: Pick<DeviceCertificate, 'status' | 'notAfter'>;
  now?: number;
  warnDays?: number;
  messages?: PkiMessagesInput;
  className?: string;
}) {
  const m = mergePkiMessages(messages).status;
  const status = certificate.status === 'ACTIVE' && certificateDaysLeft(certificate, now) < 0 ? 'EXPIRED' : certificate.status;
  if (status === 'ACTIVE') {
    const left = certificateDaysLeft(certificate, now);
    if (left < warnDays) {
      const text = left === 0 ? m.lastDay : left === 1 ? m.oneDayLeft : fillText(m.daysLeft, { days: left });
      return <Badge variant="warning" size="sm" dot className={className}>{`${m.ACTIVE} · ${text}`}</Badge>;
    }
    return <Badge variant="success" size="sm" dot className={className}>{m.ACTIVE}</Badge>;
  }
  if (status === 'SUPERSEDED') return <Badge variant="neutral" size="sm" className={className}>{m.SUPERSEDED}</Badge>;
  return <Badge variant="error" size="sm" className={className}>{status === 'REVOKED' ? m.REVOKED : m.EXPIRED}</Badge>;
}
