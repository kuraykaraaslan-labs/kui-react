import { describe, it, expect } from 'vitest';
import { tokenize, buildSegments, applySegments, hunksOf, MAX_CELLS } from './diff';

const accept = (human: string, ai: string, which: 'ai' | 'human' = 'ai') => applySegments(buildSegments(human, ai), () => which);

describe('word diff', () => {
  it('tokenizes words and whitespace separately', () => {
    expect(tokenize('a  b\nc')).toEqual(['a', '  ', 'b', '\n', 'c']);
    expect(tokenize('')).toEqual([]);
  });

  it('has no hunks when the texts match', () => {
    expect(hunksOf(buildSegments('same text', 'same text'))).toEqual([]);
    expect(buildSegments('', '')).toEqual([]);
  });

  it('finds one hunk for a replaced word', () => {
    const h = hunksOf(buildSegments('the cache was cold', 'the cache was warm'));
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ human: 'cold', ai: 'warm' });
  });

  it('finds an insertion and a deletion', () => {
    const ins = hunksOf(buildSegments('restart the pod', 'restart the failing pod'));
    expect(ins).toHaveLength(1);
    expect(ins[0].human).toBe('');
    expect(ins[0].ai.trim()).toBe('failing');
    const del = hunksOf(buildSegments('restart the failing pod', 'restart the pod'));
    expect(del[0].ai).toBe('');
    expect(del[0].human.trim()).toBe('failing');
  });

  it('glues a rewritten phrase into one hunk instead of one per word', () => {
    const h = hunksOf(buildSegments('error rate rose sharply today', 'failures climbed quickly today'));
    expect(h).toHaveLength(1);
    expect(h[0].human).toBe('error rate rose sharply');
    expect(h[0].ai).toBe('failures climbed quickly');
  });

  it('keeps separate changes separate', () => {
    const h = hunksOf(buildSegments('a b c d e', 'x b c d y'));
    expect(h.map((x) => [x.human, x.ai])).toEqual([['a', 'x'], ['e', 'y']]);
  });

  it('round-trips: all hunks accepted gives the AI text, none gives the human text', () => {
    const human = 'The deploy at 08:00 caused a spike in 5xx errors.\nWe rolled back.';
    const ai = 'The 08:00 deploy caused a sharp rise in 5xx errors.\nWe rolled back and confirmed recovery.';
    expect(accept(human, ai, 'ai')).toBe(ai);
    expect(accept(human, ai, 'human')).toBe(human);
  });

  it('applies a single hunk and leaves the others as the human wrote them', () => {
    const segs = buildSegments('a b c d e', 'x b c d y');
    const first = segs.find((s) => s.type === 'hunk')!;
    const out = applySegments(segs, (h) => (h.key === (first as { hunk: { key: string } }).hunk.key ? 'ai' : 'human'));
    expect(out).toBe('x b c d e');
  });

  it('gives identical changes different keys by occurrence', () => {
    const h = hunksOf(buildSegments('x a x a x', 'x b x b x'));
    expect(h).toHaveLength(2);
    expect(new Set(h.map((x) => x.key)).size).toBe(2);
  });

  it('survives empty sides and unicode', () => {
    expect(accept('', 'hello', 'ai')).toBe('hello');
    expect(accept('hello', '', 'ai')).toBe('');
    expect(accept('café ünï', 'café nai', 'ai')).toBe('café nai');
  });

  it('falls back to one replace hunk when the middle is too large for a table', () => {
    const big = Math.ceil(Math.sqrt(MAX_CELLS)) + 50;
    const a = Array.from({ length: big }, (_, i) => `a${i}`).join(' ');
    const b = Array.from({ length: big }, (_, i) => `b${i}`).join(' ');
    const h = hunksOf(buildSegments(a, b));
    expect(h).toHaveLength(1);
    expect(applySegments(buildSegments(a, b), () => 'ai')).toBe(b);
  });
});
