'use client';
import { useId, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare,
  faBan,
  faCheck,
  faFlag,
  faHourglassHalf,
  faShieldHalved,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { cn } from '@/libs/utils/cn';
import { Avatar } from '@/modules/ui/Avatar';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { EmptyState } from '@/modules/ui/EmptyState';
import { TabGroup } from '@/modules/ui/TabGroup';
import type { ModerationAction, ModerationItem, ModerationQueue, ModerationTab } from '../types';
import { DEFAULT_FORUM_MODERATION_MESSAGES, fillModeration, type ForumModerationMessages } from './messages';
import {
  MODERATION_TABS,
  applicableIds,
  bulkActions,
  isDestructive,
  itemActions,
  itemsForTab,
  moderationCounts,
  openReports,
  reasonSummary,
  relativeAge,
} from './queue';

type ModerationQueueViewProps = {
  /** The queue the host built (kui-community: `wp kui-community moderation --json`). */
  queue: ModerationQueue;
  /**
   * Runs an action on posts (ids of the posts it applies to). The host changes the posts and passes the new queue;
   * a rejected promise shows "That did not work". Spam and trash are confirmed in a ConfirmDialog first.
   */
  onAction?: (action: ModerationAction, ids: string[]) => void | Promise<void>;
  /** Ages are measured from here. Default = the queue's `generatedAt` (deterministic on the server and the client). */
  now?: string | Date;
  /** Date and relative-time formats (BCP 47). Default = the browser's. */
  locale?: string;
  messages?: Partial<ForumModerationMessages>;
  /** The open tab at first. Default = the first tab with posts in it. */
  defaultTab?: ModerationTab;
  /** Reporters' names; a host turns it off for anyone who is not a moderator (they then read "a member"). */
  showReporters?: boolean;
  className?: string;
};

type Ctx = {
  m: ForumModerationMessages;
  now: Date;
  locale?: string;
  showReporters: boolean;
};

const ACTION_ICON: Record<ModerationAction, IconDefinition> = {
  approve: faCheck,
  spam: faBan,
  trash: faTrashCan,
  dismiss: faXmark,
};

const HOLD_CODES = ['first_posts', 'links', 'blocklist', 'site_rules', 'reports', 'ai'] as const;

function holdText(code: string, m: ForumModerationMessages): string {
  return (HOLD_CODES as readonly string[]).includes(code) ? m[`hold_${code as (typeof HOLD_CODES)[number]}`] : m.hold_other;
}

function actionLabel(action: ModerationAction, item: Pick<ModerationItem, 'status'> | null, m: ForumModerationMessages): string {
  if (action === 'approve') return item?.status === 'spam' ? m.notSpam : m.approve;
  if (action === 'spam') return m.markSpam;
  if (action === 'trash') return m.trash;
  return m.dismiss;
}

const doneMessage: Record<ModerationAction, keyof ForumModerationMessages> = {
  approve: 'doneApprove',
  spam: 'doneSpam',
  trash: 'doneTrash',
  dismiss: 'doneDismiss',
};

function formatDate(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(d);
  } catch {
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(d);
  }
}

function Age({ iso, ctx, template }: { iso: string; ctx: Ctx; template?: string }) {
  const age = relativeAge(iso, ctx.now, ctx.locale);
  const d = new Date(iso);
  const exact = Number.isNaN(d.getTime()) ? iso : `${d.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  return <time dateTime={iso} title={exact}>{template ? fillModeration(template, { age }) : age}</time>;
}

function AuthorBlock({ item, ctx }: { item: ModerationItem; ctx: Ctx }) {
  const { m } = ctx;
  const a = item.author;
  return (
    <div className="flex min-w-0 items-start gap-3 @3xl:flex-col @3xl:gap-2">
      <Avatar name={a.name} src={a.avatarUrl ?? undefined} size="sm" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="sr-only">{m.author}:</span>
        {a.url ? (
          <a href={a.url} className="truncate text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm">{a.name}</a>
        ) : (
          <span className="truncate text-sm font-semibold text-text-primary">{a.name}</span>
        )}
        <span className="flex flex-wrap items-center gap-1.5">
          {a.level && (
            <span
              className="inline-flex items-center rounded-full px-2 py-px text-[0.6875rem] font-semibold text-[color-mix(in_srgb,var(--lvl)_75%,var(--text-primary))] bg-[color-mix(in_srgb,var(--lvl)_14%,transparent)]"
              style={{ ['--lvl' as string]: a.level.colour ?? 'var(--text-secondary)' }}
            >
              {a.level.name}
            </span>
          )}
          {a.title && <Badge variant="primary" size="sm">{a.title}</Badge>}
        </span>
        <span className="text-xs text-text-secondary">
          {a.postCount === 1 ? m.postsOne : fillModeration(m.postsMany, { count: a.postCount })}
          {a.joinedAt && <> · {fillModeration(m.joined, { date: formatDate(a.joinedAt, ctx.locale) })}</>}
        </span>
      </div>
    </div>
  );
}

function Reports({ item, ctx }: { item: ModerationItem; ctx: Ctx }) {
  const { m } = ctx;
  const open = openReports(item);
  const handled = (item.reports ?? []).length - open.length;
  if (!open.length && !handled) return null;
  return (
    <div className="flex flex-col gap-2">
      {open.length > 0 && (
        <>
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-error-fg">
              <FontAwesomeIcon icon={faFlag} className="h-3 w-3" aria-hidden="true" />
              {open.length === 1 ? m.reportsOne : fillModeration(m.reportsMany, { count: open.length })}
            </span>
            {reasonSummary(open).map((s) => (
              <Badge key={s.reason} variant="error" size="sm">
                {m[`reason_${s.reason}`]}{s.count > 1 ? ` × ${s.count}` : ''}
              </Badge>
            ))}
          </p>
          <ul className="flex flex-col gap-1.5 border-l-2 border-error/40 pl-3" aria-label={m.reports}>
            {open.map((r) => (
              <li key={r.id} className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{m[`reason_${r.reason}`]}</span>
                {' · '}
                {fillModeration(m.reportedBy, { name: ctx.showReporters && r.reporter ? r.reporter.name : m.aMember })}
                {' · '}
                <Age iso={r.createdAt} ctx={ctx} />
                {r.note && <q className="mt-0.5 block text-text-primary">{r.note}</q>}
              </li>
            ))}
          </ul>
        </>
      )}
      {handled > 0 && (
        <p className="text-xs text-text-secondary">
          {handled === 1 ? m.reportsHandledOne : fillModeration(m.reportsHandledMany, { count: handled })}
        </p>
      )}
    </div>
  );
}

function ItemCard({
  item, ctx, selected, busy, onSelect, onRun,
}: {
  item: ModerationItem;
  ctx: Ctx;
  selected: boolean;
  busy: boolean;
  onSelect: (on: boolean) => void;
  onRun: (action: ModerationAction) => void;
}) {
  const { m } = ctx;
  const headId = useId();
  const status = item.status === 'pending'
    ? <Badge variant="warning" size="sm"><FontAwesomeIcon icon={faHourglassHalf} className="mr-1 h-2.5 w-2.5" aria-hidden="true" />{m.statusPending}</Badge>
    : item.status === 'spam'
      ? <Badge variant="error" size="sm"><FontAwesomeIcon icon={faBan} className="mr-1 h-2.5 w-2.5" aria-hidden="true" />{m.statusSpam}</Badge>
      : <Badge variant="success" size="sm">{m.statusPublish}</Badge>;
  const actions = itemActions(item);
  // "in {topic}": the words around the topic's link, in the translation's order.
  const [before = '', after = ''] = m.inTopic.split('{topic}');

  return (
    <li>
      <article
        aria-labelledby={headId}
        aria-busy={busy || undefined}
        className={cn(
          'flex gap-3 rounded-lg border bg-surface-base p-4 transition-colors',
          selected ? 'border-primary ring-1 ring-primary' : 'border-border',
          busy && 'opacity-60',
        )}
      >
        <input
          type="checkbox"
          checked={selected}
          disabled={busy}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={fillModeration(m.select, { name: item.author.name })}
          className="mt-1 h-4 w-4 shrink-0 rounded border-border focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="grid min-w-0 flex-1 gap-3 @3xl:grid-cols-[minmax(0,1fr)_14rem] @3xl:gap-5">
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
              <Badge variant="neutral" size="sm">{item.kind === 'topic' ? m.topic : m.reply}</Badge>
              {status}
              {item.forum && <span>{item.forum.title}</span>}
              <span aria-hidden="true">·</span>
              <Age iso={item.createdAt} ctx={ctx} template={m.postedAgo} />
            </div>
            <h3 id={headId} className="text-sm font-semibold leading-snug text-text-primary">
              {item.kind === 'reply' && before && <span className="font-normal text-text-secondary">{before}</span>}
              <a href={item.topic.url} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm">{item.topic.title}</a>
              {item.kind === 'reply' && after && <span className="font-normal text-text-secondary">{after}</span>}
            </h3>
            <blockquote className="line-clamp-4 border-l-2 border-border-strong pl-3 text-sm text-text-primary break-words" aria-label={m.excerpt}>
              {item.excerpt}
            </blockquote>
            {item.status === 'pending' && (item.holdReasons ?? []).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-warning-fg">
                  <FontAwesomeIcon icon={faShieldHalved} className="h-3 w-3" aria-hidden="true" />
                  {m.heldBecause}
                </span>
                <ul className="flex flex-wrap gap-1.5" aria-label={m.heldBecause}>
                  {(item.holdReasons ?? []).map((h) => (
                    <li key={h.code + (h.detail ?? '')}>
                      <Badge variant="warning" size="sm">
                        {h.detail ? `${holdText(h.code, m)}: ${h.code === 'blocklist' ? `“${h.detail}”` : h.detail}` : holdText(h.code, m)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.status === 'spam' && item.markedAt && (
              <p className="text-xs text-text-secondary">
                {item.markedBy
                  ? <Age iso={item.markedAt} ctx={ctx} template={fillModeration(m.markedBy, { name: item.markedBy.name, age: '{age}' })} />
                  : <Age iso={item.markedAt} ctx={ctx} template={m.markedSpam} />}
              </p>
            )}
            <Reports item={item} ctx={ctx} />
          </div>
          <AuthorBlock item={item} ctx={ctx} />
          <div
            role="group"
            aria-label={fillModeration(m.actionsFor, { name: item.author.name })}
            className="flex flex-wrap items-center gap-2 border-t border-border pt-3 @3xl:col-span-2"
          >
            {actions.map((a) => (
              <Button
                key={a}
                size="xs"
                variant={a === 'approve' ? 'primary' : a === 'trash' ? 'danger' : 'outline'}
                disabled={busy}
                onClick={() => onRun(a)}
                iconLeft={<FontAwesomeIcon icon={ACTION_ICON[a]} className="h-3 w-3" aria-hidden="true" />}
              >
                {actionLabel(a, item, m)}
              </Button>
            ))}
            <Button
              as="a"
              href={item.url}
              size="xs"
              variant="ghost"
              className="@3xl:ml-auto"
              iconRight={<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" aria-hidden="true" />}
            >
              {m.open}
            </Button>
          </div>
        </div>
      </article>
    </li>
  );
}

const EMPTY: Record<ModerationTab, { title: keyof ForumModerationMessages; text: keyof ForumModerationMessages; icon: IconDefinition }> = {
  reported: { title: 'emptyReportedTitle', text: 'emptyReportedText', icon: faFlag },
  held: { title: 'emptyHeldTitle', text: 'emptyHeldText', icon: faHourglassHalf },
  spam: { title: 'emptySpamTitle', text: 'emptySpamText', icon: faBan },
};

function TabPanel({
  tab, items, ctx, selected, busy, setSelected, run,
}: {
  tab: ModerationTab;
  items: ModerationItem[];
  ctx: Ctx;
  selected: Set<string>;
  busy: Set<string>;
  setSelected: (next: Set<string>) => void;
  run: (action: ModerationAction, ids: string[]) => void;
}) {
  const { m } = ctx;
  const allId = useId();
  if (!items.length) {
    const e = EMPTY[tab];
    return (
      <EmptyState
        icon={<FontAwesomeIcon icon={e.icon} className="h-6 w-6" aria-hidden="true" />}
        title={m[e.title]}
        description={m[e.text]}
      />
    );
  }
  const ids = items.map((i) => i.id);
  const chosen = ids.filter((id) => selected.has(id));
  const all = chosen.length === ids.length;
  const some = chosen.length > 0 && !all;
  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label={m.bulkLabel}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5"
      >
        <label htmlFor={allId} className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            id={allId}
            type="checkbox"
            checked={all}
            ref={(el) => { if (el) el.indeterminate = some; }}
            aria-checked={some ? 'mixed' : all}
            onChange={() => setSelected(new Set(all ? [] : ids))}
            className="h-4 w-4 rounded border-border focus-visible:ring-2 focus-visible:ring-border-focus"
          />
          {m.selectAll}
        </label>
        <span className="text-xs text-text-secondary" aria-live="polite">
          {chosen.length > 0 ? fillModeration(m.selected, { count: chosen.length }) : ''}
        </span>
        <div className="flex flex-wrap items-center gap-2 @2xl:ml-auto">
          {bulkActions(tab).map((a) => {
            const applies = applicableIds(items, chosen, a).filter((id) => !busy.has(id));
            return (
              <Button
                key={a}
                size="xs"
                variant={a === 'approve' ? 'primary' : a === 'trash' ? 'danger' : 'outline'}
                disabled={applies.length === 0}
                onClick={() => run(a, applies)}
                iconLeft={<FontAwesomeIcon icon={ACTION_ICON[a]} className="h-3 w-3" aria-hidden="true" />}
              >
                {`${actionLabel(a, tab === 'spam' ? { status: 'spam' } : null, m)}${applies.length > 0 ? ` (${applies.length})` : ''}`}
              </Button>
            );
          })}
          {chosen.length > 0 && (
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>{m.clearSelection}</Button>
          )}
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            ctx={ctx}
            selected={selected.has(item.id)}
            busy={busy.has(item.id)}
            onSelect={(on) => {
              const next = new Set(selected);
              if (on) next.add(item.id);
              else next.delete(item.id);
              setSelected(next);
            }}
            onRun={(a) => run(a, [item.id])}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * ModerationQueueView — the forum's moderation screen: Reported (posts members reported, with each report's reason,
 * note, reporter and time), Held (posts the spam rules held back, with the reason in words) and Spam, a count on each
 * tab. Each post shows its excerpt, topic and forum, the author's level, title and post count, and its age; actions
 * Approve (Not spam), Mark as spam, Trash, Dismiss reports and Open in forum, one at a time or on a selection. Spam
 * and trash are confirmed in a ConfirmDialog. The host builds the queue and runs the actions (`onAction`).
 */
export function ModerationQueueView({
  queue, onAction, now, locale, messages, defaultTab, showReporters = true, className,
}: ModerationQueueViewProps) {
  const m = useMemo(() => ({ ...DEFAULT_FORUM_MODERATION_MESSAGES, ...messages }), [messages]);
  const items = queue.items;
  const counts = useMemo(() => moderationCounts(items), [items]);
  const [tab, setTab] = useState<ModerationTab>(() => defaultTab ?? MODERATION_TABS.find((t) => counts[t] > 0) ?? 'reported');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');
  const [confirm, setConfirm] = useState<{ action: ModerationAction; ids: string[] } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const ctx: Ctx = { m, now: new Date(now ?? queue.generatedAt), locale, showReporters };
  const present = new Set(items.map((i) => i.id));
  const liveSelection = new Set([...selected].filter((id) => present.has(id)));

  const perform = async (action: ModerationAction, ids: string[]): Promise<boolean> => {
    setBusy((b) => new Set([...b, ...ids]));
    setError('');
    try {
      await onAction?.(action, ids);
      setAnnounce(fillModeration(m[doneMessage[action]], { count: ids.length }));
      setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
      return true;
    } catch {
      return false;
    } finally {
      setBusy((b) => new Set([...b].filter((id) => !ids.includes(id))));
    }
  };

  const run = (action: ModerationAction, ids: string[]) => {
    const valid = applicableIds(items, ids, action);
    if (!valid.length) return;
    if (isDestructive(action)) {
      setConfirmError('');
      setConfirm({ action, ids: valid });
      return;
    }
    void perform(action, valid).then((ok) => { if (!ok) setError(m.failed); });
  };

  const tabs = MODERATION_TABS.map((t) => ({
    id: t,
    label: t === 'reported' ? m.tabReported : t === 'held' ? m.tabHeld : m.tabSpam,
    badge: (
      <span
        className={cn(
          'ml-1.5 inline-flex min-w-5 justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
          counts[t] > 0 && t !== 'spam' ? 'bg-error text-text-inverse' : 'bg-surface-sunken text-text-secondary',
        )}
      >
        {counts[t]}
      </span>
    ),
    content: (
      <TabPanel
        tab={t}
        items={itemsForTab(items, t)}
        ctx={ctx}
        selected={liveSelection}
        busy={busy}
        setSelected={setSelected}
        run={run}
      />
    ),
  }));

  const confirmCount = confirm?.ids.length ?? 0;
  const confirmItems = confirm ? items.filter((i) => confirm.ids.includes(i.id)) : [];

  return (
    <section className={cn('@container flex w-full min-w-0 flex-col gap-4', className)} aria-label={m.title}>
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-text-primary">{m.title}</h2>
        <p className="text-sm text-text-secondary">{m.subtitle}</p>
      </header>
      {error && <Callout variant="danger" title={null}>{error}</Callout>}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <TabGroup
        tabs={tabs}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as ModerationTab);
          setSelected(new Set());
        }}
        label={m.tabsLabel}
      />
      {confirm && (
        <ConfirmDialog
          open
          tone="danger"
          title={
            confirm.action === 'spam'
              ? (confirmCount === 1 ? m.confirmSpamTitleOne : fillModeration(m.confirmSpamTitleMany, { count: confirmCount }))
              : (confirmCount === 1 ? m.confirmTrashTitleOne : fillModeration(m.confirmTrashTitleMany, { count: confirmCount }))
          }
          message={confirm.action === 'spam' ? m.confirmSpamMessage : m.confirmTrashMessage}
          details={
            <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-xs text-text-secondary">
              {confirmItems.slice(0, 8).map((i) => (
                <li key={i.id} className="truncate">
                  <span className="font-medium text-text-primary">{i.author.name}</span>: {i.excerpt}
                </li>
              ))}
              {confirmItems.length > 8 && <li>…</li>}
            </ul>
          }
          confirmLabel={confirm.action === 'spam' ? m.markSpam : m.trash}
          cancelLabel={m.cancel}
          busy={confirmBusy}
          error={confirmError || undefined}
          onCancel={() => { if (!confirmBusy) setConfirm(null); }}
          onConfirm={() => {
            setConfirmBusy(true);
            void perform(confirm.action, confirm.ids).then((ok) => {
              setConfirmBusy(false);
              if (ok) setConfirm(null);
              else setConfirmError(m.failed);
            });
          }}
        />
      )}
    </section>
  );
}
