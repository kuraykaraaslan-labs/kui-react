import type {
  ModerationAction,
  ModerationItem,
  ModerationReport,
  ModerationReportReason,
  ModerationTab,
} from '../types'

/** The tabs in their order. */
export const MODERATION_TABS: ModerationTab[] = ['reported', 'held', 'spam']

/** The open reports of a post. */
export function openReports(item: Pick<ModerationItem, 'reports'>): ModerationReport[] {
  return (item.reports ?? []).filter((r) => r.state === 'open')
}

/**
 * The tabs a post is listed on: Reported while it has open reports (and is not spam), Held while it is pending,
 * Spam while it is spam. A post hidden after reports is on Reported and Held.
 */
export function itemTabs(item: ModerationItem): ModerationTab[] {
  const tabs: ModerationTab[] = []
  if (item.status !== 'spam' && openReports(item).length > 0) tabs.push('reported')
  if (item.status === 'pending') tabs.push('held')
  if (item.status === 'spam') tabs.push('spam')
  return tabs
}

export function moderationCounts(items: ModerationItem[]): Record<ModerationTab, number> {
  const counts: Record<ModerationTab, number> = { reported: 0, held: 0, spam: 0 }
  for (const item of items) for (const t of itemTabs(item)) counts[t]++
  return counts
}

const time = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? 0 : t
}

/**
 * The posts of one tab, in working order: Reported by the number of open reports, then the latest report first;
 * Held oldest first (a queue: whoever waited longest comes first); Spam newest first.
 */
export function itemsForTab(items: ModerationItem[], tab: ModerationTab): ModerationItem[] {
  const list = items.filter((i) => itemTabs(i).includes(tab))
  if (tab === 'reported') {
    const latest = (i: ModerationItem) => Math.max(0, ...openReports(i).map((r) => time(r.createdAt)))
    return list.sort((a, b) => openReports(b).length - openReports(a).length || latest(b) - latest(a))
  }
  if (tab === 'held') return list.sort((a, b) => time(a.createdAt) - time(b.createdAt))
  return list.sort((a, b) => time(b.markedAt ?? b.createdAt) - time(a.markedAt ?? a.createdAt))
}

/** What a moderator can do with one post. */
export function itemActions(item: ModerationItem): ModerationAction[] {
  const out: ModerationAction[] = []
  if (item.status === 'pending' || item.status === 'spam') out.push('approve')
  if (openReports(item).length > 0 && item.status !== 'spam') out.push('dismiss')
  if (item.status !== 'spam') out.push('spam')
  out.push('trash')
  return out
}

/** The bulk actions of a tab. */
export function bulkActions(tab: ModerationTab): ModerationAction[] {
  if (tab === 'reported') return ['dismiss', 'spam', 'trash']
  if (tab === 'held') return ['approve', 'spam', 'trash']
  return ['approve', 'trash']
}

/** Of the selected ids, those the action applies to (Approve skips a published post, and so on). */
export function applicableIds(items: ModerationItem[], ids: string[], action: ModerationAction): string[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return ids.filter((id) => {
    const item = byId.get(id)
    return !!item && itemActions(item).includes(action)
  })
}

/** Spam and trash ask first (ConfirmDialog); approve and dismiss do not take anything away. */
export function isDestructive(action: ModerationAction): boolean {
  return action === 'spam' || action === 'trash'
}

/** The open reports' reasons, most frequent first (ties in the reasons' order). */
export function reasonSummary(reports: ModerationReport[]): { reason: ModerationReportReason; count: number }[] {
  const order: ModerationReportReason[] = ['spam', 'abuse', 'personal_data', 'off_topic', 'other']
  const counts = new Map<ModerationReportReason, number>()
  for (const r of reports) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1)
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || order.indexOf(a.reason) - order.indexOf(b.reason))
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

/** "3 hours ago", "yesterday" (Intl.RelativeTimeFormat in `locale`), measured from `now`. */
export function relativeAge(iso: string, now: Date, locale?: string): string {
  const seconds = Math.round((time(iso) - now.getTime()) / 1000)
  let fmt: Intl.RelativeTimeFormat
  try {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch {
    fmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  }
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return fmt.format(Math.round(seconds / size), unit)
  }
  return fmt.format(0, 'minute')
}

/**
 * A moderator's action on the queue, as the host applies it (the showcase and tests use it; kui-community does the
 * same in PHP): approve publishes a held post or takes it out of spam and dismisses its open reports; spam marks it
 * spam and resolves them; dismiss dismisses them and leaves the post as it is; trash takes the post out of the queue.
 */
export function applyModerationAction(
  items: ModerationItem[],
  action: ModerationAction,
  ids: string[],
  by: { id: string; name: string },
  at: string,
): ModerationItem[] {
  const chosen = new Set(applicableIds(items, ids, action))
  const close = (reports: ModerationReport[], state: 'resolved' | 'dismissed') =>
    reports.map((r) => (r.state === 'open' ? { ...r, state, handledBy: by, handledAt: at } : r))
  const out: ModerationItem[] = []
  for (const item of items) {
    if (!chosen.has(item.id)) {
      out.push(item)
      continue
    }
    if (action === 'trash') continue
    if (action === 'approve') out.push({ ...item, status: 'publish', holdReasons: [], reports: close(item.reports ?? [], 'dismissed'), markedBy: by, markedAt: at })
    else if (action === 'spam') out.push({ ...item, status: 'spam', reports: close(item.reports ?? [], 'resolved'), markedBy: by, markedAt: at })
    else out.push({ ...item, reports: close(item.reports ?? [], 'dismissed') })
  }
  return out
}
