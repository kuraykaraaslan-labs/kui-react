import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { chatbotKpis, couldNotAnswer, groupCount, hasPrevious, outcomeRows, questionSearchText, trendPoints } from './chatbotReport';
import { chatbotFormat } from './format';
import { demoChatbotReport } from './demo';
import { fillChatbot } from './messages';
import { ChatbotReportSchema, type ChatbotQuestion } from './types';
import { ChatbotReportView } from './ChatbotReportView';
import { ChatbotQuestionsTable, COULD_NOT_ANSWER_FILTER } from './ChatbotQuestionsTable';
import { ChatbotOutcomeBadge } from './ChatbotOutcomeBadge';
import { ForumHelpBotCard } from './ForumHelpBotCard';

const q = (over: Partial<ChatbotQuestion>): ChatbotQuestion => ({
  id: '1', at: '2026-11-20T10:00:00Z', conversation: 'abc', turn: 1, lang: 'en', page: '/', text: 'Hi', outcome: 'sourced',
  answered: true, sources: [], searches: [], model: 'claude-haiku-5-5', tokensIn: 1, tokensOut: 1, cost: 0, signedIn: false, ...over,
});

describe('chatbot report helpers', () => {
  it('kpis: sourced rate over all questions, hand-offs, declined + held back, errors', () => {
    const k = chatbotKpis({
      conversations: 4, questions: 20, couldNotAnswer: 3, cost: 0.5,
      outcomes: { sourced: 10, unsourced: 2, forum: 2, quote: 1, contact: 1, unanswered: 1, refused: 1, blocked: 1, error: 1 },
    });
    expect(k).toEqual({ conversations: 4, questions: 20, sourcedRate: 0.5, handoffs: 4, couldNotAnswer: 3, refusedBlocked: 2, errors: 1, cost: 0.5 });
    expect(chatbotKpis(undefined).sourcedRate).toBe(0);
  });

  it('a previous period with no questions is nothing to compare with', () => {
    expect(hasPrevious(undefined)).toBe(false);
    expect(hasPrevious({ questions: 0, conversations: 0 })).toBe(false);
    expect(hasPrevious({ questions: 3 })).toBe(true);
  });

  it('outcome rows: fixed order, shares of all questions, the group of each', () => {
    const rows = outcomeRows({ sourced: 3, forum: 1 });
    expect(rows.map((r) => r.outcome)).toEqual(['sourced', 'unsourced', 'forum', 'quote', 'contact', 'unanswered', 'refused', 'blocked', 'error']);
    expect(rows[0]).toMatchObject({ count: 3, share: 0.75, group: 'answered' });
    expect(rows[2]).toMatchObject({ count: 1, share: 0.25, group: 'handoff' });
    expect(outcomeRows(undefined).every((r) => r.share === 0)).toBe(true);
  });

  it('groups add up their outcomes', () => {
    const o = { sourced: 1, unsourced: 2, forum: 3, quote: 4, contact: 5, unanswered: 6, refused: 7, blocked: 8, error: 9 };
    expect([groupCount(o, 'answered'), groupCount(o, 'handoff'), groupCount(o, 'notAnswered')]).toEqual([3, 12, 30]);
  });

  it('trend: sorted by date, one value per group', () => {
    const empty = { sourced: 0, unsourced: 0, forum: 0, quote: 0, contact: 0, unanswered: 0, refused: 0, blocked: 0, error: 0 };
    const t = trendPoints([
      { date: '2026-11-02', conversations: 1, questions: 2, cost: 0, outcomes: { ...empty, error: 2 } },
      { date: '2026-11-01', conversations: 1, questions: 3, cost: 0, outcomes: { ...empty, sourced: 2, quote: 1 } },
    ]);
    expect(t).toEqual([
      { date: '2026-11-01', answered: 2, handoff: 1, notAnswered: 0 },
      { date: '2026-11-02', answered: 0, handoff: 0, notAnswered: 2 },
    ]);
  });

  it('could not answer: only answered === false, newest first (not refused or errors)', () => {
    const list = couldNotAnswer([
      q({ id: 'a', answered: false, outcome: 'forum', at: '2026-11-01T00:00:00Z' }),
      q({ id: 'b', answered: null, outcome: 'error' }),
      q({ id: 'c', answered: false, outcome: 'unanswered', at: '2026-11-03T00:00:00Z' }),
      q({ id: 'd', answered: true }),
    ]);
    expect(list.map((x) => x.id)).toEqual(['c', 'a']);
  });

  it('search text holds the question, page, language, terms and source titles', () => {
    const s = questionSearchText(q({ text: 'Modbus?', page: '/docs/', searches: ['rtu gateway'], sources: [{ title: 'Wiring', url: 'https://x/' }] }));
    expect(s).toContain('modbus?');
    expect(s).toContain('/docs/');
    expect(s).toContain('rtu gateway');
    expect(s).toContain('wiring');
  });

  it('money: three decimals under one unit, two above', () => {
    const f = chatbotFormat('en-US');
    expect(f.money(0.0021)).toBe('$0.002');
    expect(f.money(12.5)).toBe('$12.50');
    expect(fillChatbot('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });
});

describe('demo report', () => {
  it('matches the contract and is deterministic', () => {
    const r = demoChatbotReport();
    expect(ChatbotReportSchema.parse(r)).toEqual(r);
    expect(demoChatbotReport()).toEqual(r);
    expect(r.days).toHaveLength(30);
    const sum = r.days.reduce((s, d) => s + d.questions, 0);
    expect(r.totals.questions).toBe(sum);
    expect(Object.values(r.totals.outcomes).reduce((s, v) => s + v, 0)).toBe(sum);
  });

  it('a 90-day period keeps lists to the 30 days questions are kept', () => {
    const r = demoChatbotReport({ days: 90 });
    expect(r.range.days).toBe(90);
    expect(r.listsRange.days).toBe(30);
  });

  it('the schema fills defaults for a sparse report', () => {
    const r = ChatbotReportSchema.parse({ range: { start: 'a', end: 'b', days: 7 }, listsRange: { start: 'a', end: 'b', days: 7 }, totals: {} });
    expect(r.totals.outcomes.sourced).toBe(0);
    expect(r.retentionDays).toBe(30);
    expect(r.forumBot).toBeNull();
  });
});

describe('ChatbotReportView', () => {
  it('renders KPIs, the retention note, outcomes, lists and the forum bot', () => {
    render(<ChatbotReportView report={demoChatbotReport()} locale="en-US" siteUrl="https://example.com" />);
    expect(screen.getByRole('heading', { name: 'AI chat report' })).toBeTruthy();
    expect(screen.getByText(/kept for 30 days, then deleted/)).toBeTruthy();
    expect(screen.getAllByText('Answered from pages').length).toBeGreaterThan(0);
    expect(screen.getByText('How questions ended')).toBeTruthy();
    expect(screen.getByText('Pages where chats start')).toBeTruthy();
    expect(screen.getByText('What the assistant searched for')).toBeTruthy();
    expect(screen.getByText('Questions it could not answer')).toBeTruthy();
    expect(screen.getByText('Forum help bot')).toBeTruthy();
    expect(screen.getByText(/questions on a model without a known price/)).toBeTruthy();
    // a page path links to the site
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === 'https://example.com/pricing/')).toBe(true);
  });

  it('an empty site shows the empty state and no KPIs', () => {
    render(<ChatbotReportView report={demoChatbotReport({ empty: true, forumBot: 'none' })} locale="en-US" />);
    expect(screen.getByText('No questions yet')).toBeTruthy();
    expect(screen.queryByText('How questions ended')).toBeNull();
    expect(screen.queryByText('Forum help bot')).toBeNull();
  });

  it('a period longer than the retention says the lists are shorter; the range picker reports the choice', () => {
    let picked = 0;
    render(<ChatbotReportView report={demoChatbotReport({ days: 90 })} locale="en-US" rangeOptions={[7, 30, 90]} onRangeChange={(d) => { picked = d; }} />);
    expect(screen.getByText(/cover the last 30 days/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(picked).toBe(7);
  });

  it('says how many questions are shown when the host capped them', () => {
    render(<ChatbotReportView report={demoChatbotReport({ questionCap: 20 })} locale="en-US" />);
    expect(screen.getByText(/The newest 20 of/)).toBeTruthy();
  });

  it('takes translated words', () => {
    render(<ChatbotReportView report={demoChatbotReport()} locale="de-DE" messages={{ title: 'KI-Chat-Bericht' }} />);
    expect(screen.getByRole('heading', { name: 'KI-Chat-Bericht' })).toBeTruthy();
  });
});

describe('ChatbotQuestionsTable', () => {
  const list = [
    q({ id: 'a', text: 'Modbus wiring?', outcome: 'sourced', sources: [{ title: 'Wiring guide', url: 'https://example.com/docs/wiring/' }], searches: ['modbus wiring'] }),
    q({ id: 'b', text: 'Profinet?', outcome: 'forum', answered: false, at: '2026-11-21T10:00:00Z' }),
    q({ id: 'c', text: 'Poem please', outcome: 'refused', answered: null, cost: null, model: 'claude-x' }),
  ];

  it('filters by outcome and by "could not answer"', () => {
    const { rerender } = render(<ChatbotQuestionsTable questions={list} locale="en-US" defaultOutcome="refused" />);
    expect(screen.queryByText('Poem please')).toBeTruthy();
    expect(screen.queryByText('Profinet?')).toBeNull();
    rerender(<ChatbotQuestionsTable key="x" questions={list} locale="en-US" defaultOutcome={COULD_NOT_ANSWER_FILTER} />);
    expect(screen.queryByText('Profinet?')).toBeTruthy();
    expect(screen.queryByText('Modbus wiring?')).toBeNull();
  });

  it('searches the terms and opens a row to its sources and searches', () => {
    render(<ChatbotQuestionsTable questions={list} locale="en-US" />);
    fireEvent.change(screen.getByPlaceholderText('Search questions…'), { target: { value: 'wiring guide' } });
    expect(screen.queryByText('Profinet?')).toBeNull();
    const row = screen.getByText('Modbus wiring?').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button'));
    expect(screen.getByRole('link', { name: /Wiring guide/ })).toBeTruthy();
    expect(screen.getAllByText('modbus wiring').length).toBeGreaterThan(0);
  });
});

describe('badges and the forum bot card', () => {
  it('an outcome badge has an icon and words', () => {
    render(<ChatbotOutcomeBadge outcome="blocked" />);
    expect(screen.getByText('Held back')).toBeTruthy();
  });

  it('the forum bot card says when the bot is off and lists topics with their status', () => {
    const r = demoChatbotReport({ forumBot: 'off' }).forumBot!;
    render(<ForumHelpBotCard report={r} locale="en-US" />);
    expect(screen.getByText(/switched off/)).toBeTruthy();
    expect(screen.getByText('Modbus RTU meter reads 0 after gateway restart')).toBeTruthy();
    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(screen.getByText('Accepted as the solution')).toBeTruthy();
  });
});
