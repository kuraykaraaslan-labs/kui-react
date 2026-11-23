import type { ModerationItem, ModerationQueue } from '../types'

/** The demo's "now": every age in the demo is measured from it. */
export const MODERATION_DEMO_NOW = '2026-11-23T10:00:00Z'

const ago = (minutes: number) => new Date(Date.parse(MODERATION_DEMO_NOW) - minutes * 60000).toISOString()

const forums = {
  help: { id: 'f1', title: 'Getting started', url: '/forums/forum/getting-started/' },
  devices: { id: 'f2', title: 'Devices and gateways', url: '/forums/forum/devices/' },
  lounge: { id: 'f3', title: 'Lounge', url: '/forums/forum/lounge/' },
}

const topics = {
  meter: { id: 't10', title: 'Meter reads zero after a gateway restart', url: '/forums/topic/meter-reads-zero/' },
  alarms: { id: 't11', title: 'Alarm e-mails arrive twice', url: '/forums/topic/alarm-emails-twice/' },
  intro: { id: 't12', title: 'Hello from a new member', url: '/forums/topic/hello/' },
  licence: { id: 't13', title: 'Cheap licence keys, instant delivery', url: '/forums/topic/cheap-keys/' },
  casino: { id: 't14', title: 'Best online casino bonus 2026', url: '/forums/topic/casino-bonus/' },
  rant: { id: 't15', title: 'This product is a joke', url: '/forums/topic/this-product/' },
}

const level = {
  newcomer: { name: 'Newcomer', colour: '#6b7280' },
  member: { name: 'Member', colour: '#0369a1' },
  regular: { name: 'Regular', colour: '#b45309' },
}

const jane = { id: 'u2', name: 'Jane Moderator' }

/**
 * A deterministic moderation queue (showcase and tests), measured from MODERATION_DEMO_NOW: three reported posts
 * (one also hidden after reports), three held by the spam rules (a new account, links, a blocked word) and two spam.
 * `empty` gives a queue with nothing in it.
 */
export function demoModerationQueue(opts: { empty?: boolean } = {}): ModerationQueue {
  if (opts.empty) return { generatedAt: MODERATION_DEMO_NOW, items: [] }
  const items: ModerationItem[] = [
    {
      id: '101',
      kind: 'reply',
      status: 'publish',
      excerpt: 'Skip the subscription. I sell lifetime licence keys for every plan at 90% off, delivered in five minutes. Message me or visit my shop link in the profile.',
      url: '/forums/topic/meter-reads-zero/#post-101',
      topic: topics.meter,
      forum: forums.devices,
      author: { id: 'u31', name: 'deal_hunter', level: level.newcomer, postCount: 3, joinedAt: ago(60 * 24 * 2) },
      createdAt: ago(95),
      holdReasons: [],
      reports: [
        { id: 'r1', reason: 'spam', note: '', reporter: { id: 'u7', name: 'Ayla K.' }, createdAt: ago(80), state: 'open' },
        { id: 'r2', reason: 'spam', note: 'Same text in three topics today.', reporter: { id: 'u8', name: 'Marco Bianchi' }, createdAt: ago(52), state: 'open' },
        { id: 'r3', reason: 'other', note: 'Selling keys is against the licence terms.', reporter: { id: 'u9', name: 'Priya' }, createdAt: ago(20), state: 'open' },
      ],
    },
    {
      id: '102',
      kind: 'topic',
      status: 'publish',
      excerpt: 'Third update in a month and the dashboard is still slow. Whoever wrote the release notes clearly never used it. The people defending this in the other thread are idiots.',
      url: '/forums/topic/this-product/',
      topic: topics.rant,
      forum: forums.lounge,
      author: { id: 'u12', name: 'rafael.m', level: level.regular, title: null, postCount: 212, joinedAt: ago(60 * 24 * 420) },
      createdAt: ago(60 * 26),
      holdReasons: [],
      reports: [
        { id: 'r4', reason: 'abuse', note: 'Calls other members idiots.', reporter: { id: 'u14', name: 'Lena Fischer' }, createdAt: ago(60 * 5), state: 'open' },
        { id: 'r5', reason: 'off_topic', note: '', reporter: { id: 'u15', name: 'Tomás' }, createdAt: ago(60 * 25), state: 'dismissed', handledBy: jane, handledAt: ago(60 * 24) },
      ],
    },
    {
      id: '103',
      kind: 'reply',
      status: 'pending',
      excerpt: 'Here is my config so you can compare: host 192.168.1.20, user admin, and my phone is in the screenshot if you want to call me about it.',
      url: '/forums/topic/alarm-emails-twice/#post-103',
      topic: topics.alarms,
      forum: forums.help,
      author: { id: 'u40', name: 'olivier_d', level: level.member, postCount: 14, joinedAt: ago(60 * 24 * 60) },
      createdAt: ago(60 * 3),
      holdReasons: [{ code: 'reports', detail: '3 reports' }],
      markedAt: ago(30),
      reports: [
        { id: 'r6', reason: 'personal_data', note: 'Phone number in the attached screenshot.', reporter: { id: 'u7', name: 'Ayla K.' }, createdAt: ago(70), state: 'open' },
        { id: 'r7', reason: 'personal_data', note: '', reporter: { id: 'u16', name: 'Sam Okafor' }, createdAt: ago(45), state: 'open' },
        { id: 'r8', reason: 'personal_data', note: '', reporter: { id: 'u17', name: 'Yuki' }, createdAt: ago(31), state: 'open' },
      ],
    },
    {
      id: '104',
      kind: 'topic',
      status: 'pending',
      excerpt: 'Hi all, I just installed my first gateway at our office and wanted to say hello. Is there a guide for connecting three meters on one bus?',
      url: '/forums/topic/hello/',
      topic: topics.intro,
      forum: forums.help,
      author: { id: 'u41', name: 'new_user_88', level: level.newcomer, postCount: 0, joinedAt: ago(60 * 5) },
      createdAt: ago(60 * 4),
      holdReasons: [{ code: 'first_posts', detail: 'post 1 of 2' }],
      reports: [],
    },
    {
      id: '105',
      kind: 'reply',
      status: 'pending',
      excerpt: 'Had the same problem. The fix is in the vendor notes: https://example.org/notes/firmware-4-2 (restart the bus after the update).',
      url: '/forums/topic/meter-reads-zero/#post-105',
      topic: topics.meter,
      forum: forums.devices,
      author: { id: 'u42', name: 'kerem', level: level.newcomer, postCount: 4, joinedAt: ago(60 * 24 * 9) },
      createdAt: ago(60 * 2),
      holdReasons: [{ code: 'links', detail: 'Newcomer' }],
      reports: [],
    },
    {
      id: '106',
      kind: 'topic',
      status: 'pending',
      excerpt: 'Get 200 free spins with the best casino bonus this year. Sign up through my link and claim it before Friday.',
      url: '/forums/topic/casino-bonus/',
      topic: topics.casino,
      forum: forums.lounge,
      author: { id: 'u43', name: 'luckyspin', level: level.newcomer, postCount: 1, joinedAt: ago(60 * 24) },
      createdAt: ago(40),
      holdReasons: [{ code: 'blocklist', detail: 'casino' }, { code: 'links', detail: 'Newcomer' }],
      reports: [],
    },
    {
      id: '107',
      kind: 'topic',
      status: 'spam',
      excerpt: 'Cheap licence keys, instant delivery, all products. Contact on the messenger in my signature.',
      url: '/forums/topic/cheap-keys/',
      topic: topics.licence,
      forum: forums.lounge,
      author: { id: 'u31', name: 'deal_hunter', level: level.newcomer, postCount: 3, joinedAt: ago(60 * 24 * 2) },
      createdAt: ago(60 * 7),
      holdReasons: [],
      reports: [{ id: 'r9', reason: 'spam', note: '', reporter: { id: 'u8', name: 'Marco Bianchi' }, createdAt: ago(60 * 6), state: 'resolved', handledBy: jane, handledAt: ago(60 * 2) }],
      markedBy: jane,
      markedAt: ago(60 * 2),
    },
    {
      id: '108',
      kind: 'reply',
      status: 'spam',
      excerpt: 'Great post! Check out my site for more tips on SEO backlinks and followers.',
      url: '/forums/topic/alarm-emails-twice/#post-108',
      topic: topics.alarms,
      forum: forums.help,
      author: { id: 'u44', name: 'seo_tips_daily', level: level.newcomer, postCount: 0, joinedAt: ago(60 * 24 * 3) },
      createdAt: ago(60 * 24 * 3),
      holdReasons: [],
      reports: [],
      markedBy: null,
      markedAt: ago(60 * 24 * 3),
    },
  ]
  return { generatedAt: MODERATION_DEMO_NOW, items }
}

