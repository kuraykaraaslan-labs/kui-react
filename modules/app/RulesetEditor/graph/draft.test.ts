import { describe, expect, it } from 'vitest';
import { createDraftStore, DRAFT_MAX, draftKey, hashText, type DraftStorage } from './draft';

function memory(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const blocked: DraftStorage = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
};

describe('draftKey', () => {
  it('has one key per flow', () => {
    expect(draftKey('a')).not.toBe(draftKey('b'));
    expect(draftKey('a')).toBe('kui-ruleset-draft:f:a');
  });
  it('has a key for a flow not saved yet', () => {
    expect(draftKey(null)).toBe('kui-ruleset-draft:f:');
  });
});

describe('hashText', () => {
  it('is stable and differs for different text', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });
});

describe('draft store', () => {
  it('writes and reads a draft', () => {
    const mem = memory();
    const s = createDraftStore(() => mem);
    expect(s.write('k', '{"a":2}', '{"a":1}', 5000)).toBe(true);
    const d = s.read('k', '{"a":1}');
    expect(d).toEqual({ v: 1, base: hashText('{"a":1}'), snap: '{"a":2}', ts: 5 });
    expect(createDraftStore(() => memory()).read('k', 'x')).toBeNull();
  });

  it('does not offer a draft equal to the saved state', () => {
    const mem = memory();
    const s = createDraftStore(() => mem);
    s.write('k', 'same', 'other');
    expect(s.read('k', 'same')).toBeNull();
  });

  it('knows when the saved state moved on', () => {
    const mem = memory();
    const s = createDraftStore(() => mem);
    s.write('k', 'mine', 'v1');
    const d = s.read('k', 'v2')!;
    expect(s.isStale(d, 'v2')).toBe(true);
    expect(s.isStale(d, 'v1')).toBe(false);
  });

  it('clears a draft', () => {
    const mem = memory();
    const s = createDraftStore(() => mem);
    s.write('k', 'a', 'b');
    s.clear('k');
    expect(mem.data.size).toBe(0);
  });

  it('refuses a draft over the size cap and leaves the old one alone', () => {
    const mem = memory();
    const s = createDraftStore(() => mem);
    s.write('k', 'small', 'b');
    expect(s.write('k', 'x'.repeat(DRAFT_MAX + 1), 'b')).toBe(false);
    expect(s.read('k', 'b')?.snap).toBe('small');
  });

  it('ignores broken entries', () => {
    const mem = memory();
    const s = createDraftStore(() => mem);
    mem.setItem('k', '{not json');
    expect(s.read('k', 'b')).toBeNull();
    mem.setItem('k', JSON.stringify({ v: 2, snap: 'x' }));
    expect(s.read('k', 'b')).toBeNull();
    mem.setItem('k', JSON.stringify({ v: 1, snap: 5 }));
    expect(s.read('k', 'b')).toBeNull();
  });

  it('survives blocked or missing storage', () => {
    for (const get of [() => blocked, () => null, () => { throw new Error('no access'); }]) {
      const s = createDraftStore(get);
      expect(s.write('k', 'a', 'b')).toBe(false);
      expect(s.read('k', 'b')).toBeNull();
      expect(() => s.clear('k')).not.toThrow();
    }
  });
});
