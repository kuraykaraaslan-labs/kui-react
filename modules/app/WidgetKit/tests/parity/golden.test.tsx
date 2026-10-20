import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlacementCard } from '../../PlacementCard';
import { WidgetKitProvider } from '../../WidgetKitContext';
import { builtinKind } from '../../templates';
import { BUILTIN_VIEWS } from '../../views';
import { PARITY_CASES, PARITY_LOCALE, PARITY_NOW, type ParityCase } from './cases';
import { normalizeHtml } from './normalize';

/**
 * The reference rendering of the widget cases (next-boilerplate dashboard phases 23 to 26, sibling parity).
 * `golden.json` holds each case with the HTML kui-react draws for it, normalised (`normalize.ts`). kui-ejs and
 * KUInative's web preview vendor the file and draw the same cases with their own renderer: they must produce
 * the same normalised HTML. A change to a view that changes its markup fails here until the golden file is
 * regenerated, which is the signal that the siblings follow:
 *
 *   UPDATE_PARITY_GOLDEN=1 npx vitest run modules/app/WidgetKit/tests/parity
 */
const FILE = resolve(import.meta.dirname, 'golden.json');
const UPDATE = process.env.UPDATE_PARITY_GOLDEN === '1';

/** The icon convention of the goldens: the setting's own class list, the way an EJS partial prints it. */
const renderIcon = (name: string, p: { className?: string; style?: React.CSSProperties }) => (
  <i className={[name, p.className].filter(Boolean).join(' ')} style={p.style} aria-hidden="true" />
);

export function drawCase(c: ParityCase): string {
  const kind = builtinKind(c.kind)!;
  const data = c.data ?? {};
  return normalizeHtml(renderToStaticMarkup(
    <WidgetKitProvider value={{ locale: PARITY_LOCALE, renderIcon }}>
      <PlacementCard
        title={c.title} template={kind.template} slots={kind.slots} view={BUILTIN_VIEWS[c.kind]} settings={c.settings ?? {}}
        board={c.board} data={data} boundSlots={c.boundSlots ?? Object.keys(data)} loading={c.loading} error={c.error ?? null}
        isEditor={c.isEditor} fixedHeight={c.fixedHeight} now={Date.parse(PARITY_NOW)} viewProps={c.viewProps}
      />
    </WidgetKitProvider>,
  ));
}

afterEach(() => vi.useRealTimers());

describe('widget parity goldens', () => {
  it('has unique case ids and only builtin kinds', () => {
    expect(new Set(PARITY_CASES.map((c) => c.id)).size).toBe(PARITY_CASES.length);
    for (const c of PARITY_CASES) expect(builtinKind(c.kind), c.id).toBeDefined();
  });

  it('draws every case, and matches golden.json (UPDATE_PARITY_GOLDEN=1 rewrites it)', () => {
    vi.useFakeTimers({ now: Date.parse(PARITY_NOW), toFake: ['Date'] });
    const drawn = PARITY_CASES.map((c) => ({ ...c, html: drawCase(c) }));
    for (const d of drawn) expect(d.html, d.id).not.toMatch(/undefined|NaN|\[object/);
    if (UPDATE || !existsSync(FILE)) {
      writeFileSync(FILE, `${JSON.stringify({ now: PARITY_NOW, locale: PARITY_LOCALE, cases: drawn }, null, 1)}\n`);
      return;
    }
    const golden = JSON.parse(readFileSync(FILE, 'utf8')) as { cases: Array<ParityCase & { html: string }> };
    expect(golden.cases.map((c) => c.id)).toEqual(drawn.map((d) => d.id));
    for (const d of drawn) expect(d.html, d.id).toBe(golden.cases.find((c) => c.id === d.id)!.html);
    expect(golden.cases).toEqual(JSON.parse(JSON.stringify(drawn)));
  });
});
