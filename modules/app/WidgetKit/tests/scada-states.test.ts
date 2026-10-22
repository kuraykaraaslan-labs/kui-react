import { describe, it, expect } from 'vitest';
import { applyStates, DEFAULT_STATES, hasStates, isLocked, mergeStates, parseMode, parseQuality, readStates, retime } from '../views/scada-states';
import { drawScada, scadaPaint } from '../views/scada-logic';
import { linkNodes, sceneModel } from '../views/scada-scene-logic';
import { evaluateRules, validateRules } from '../views/scene-rules-logic';
import { el, svgToString, type SvgNode } from '../views/svg-node';

const s = (v: unknown) => ({ shape: 'scalar' as const, value: v as number | string | boolean });
const slots = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, s(v)]));
const html = (nodes: SvgNode[]) => nodes.map(svgToString).join('');
const spin = (dur = '2s'): SvgNode => el('g', undefined, [el('line', { x1: 0, y1: 0, x2: 10, y2: 0 }), el('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 50 50', to: '360 50 50', dur, repeatCount: 'indefinite' })]);

describe('reading the states', () => {
  it('has nothing special by default', () => {
    expect(readStates(() => undefined)).toEqual(DEFAULT_STATES);
    expect(hasStates(DEFAULT_STATES)).toBe(false);
  });
  it('takes words for mode and quality, from their own columns or from a status word', () => {
    expect(readStates((k) => ({ mode: 'Manual', quality: 'STALE' })[k as 'mode']).mode).toBe('manual');
    expect(readStates((k) => ({ mode: 'hand', quality: 'lost' } as Record<string, unknown>)[k]).quality).toBe('offline');
    const fromStatus = readStates((k) => (k === 'status' ? 'maintenance' : undefined));
    expect(fromStatus.mode).toBe('maintenance');
    expect(readStates((k) => (k === 'status' ? 'offline' : undefined)).quality).toBe('offline');
    expect(parseMode('nonsense')).toBeNull();
    expect(parseQuality('')).toBeNull();
  });
  it('speed is a percentage; a negative speed or a direction word reverses', () => {
    expect(readStates((k) => (k === 'speed' ? '60%' : undefined)).speed).toBe(60);
    const neg = readStates((k) => (k === 'speed' ? -75 : undefined));
    expect(neg).toMatchObject({ speed: 75, reverse: true });
    expect(readStates((k) => (k === 'direction' ? 'reverse' : undefined)).reverse).toBe(true);
    expect(readStates((k) => ({ speed: -50, direction: 'forward' } as Record<string, unknown>)[k]).reverse).toBe(false);
    expect(readStates((k) => (k === 'speed' ? 9999 : undefined)).speed).toBe(400);
  });
  it('ack, pending, failed and position are read as flags and a clamped percentage', () => {
    const r = readStates((k) => ({ ack: 'unacknowledged', pending: 'yes', failed: 0, position: 140 } as Record<string, unknown>)[k]);
    expect(r).toMatchObject({ ack: false, pending: true, failed: false, position: 100 });
    expect(readStates(() => undefined).ack).toBeNull();
  });
  it('only a lockout locks', () => {
    expect(isLocked(mergeStates(undefined, { mode: 'lockout' }))).toBe(true);
    expect(isLocked(mergeStates(undefined, { mode: 'maintenance' }))).toBe(false);
  });
});

describe('retiming', () => {
  it('leaves a tree alone at nominal speed', () => {
    const t = [spin()];
    expect(retime(t, 100, false)).toBe(t);
  });
  it('a higher speed shortens the period, a lower one lengthens it', () => {
    expect(html(retime([spin('2s')], 200, false))).toContain('dur="1s"');
    expect(html(retime([spin('2s')], 50, false))).toContain('dur="4s"');
  });
  it('speed 0 removes the animation and keeps the drawing', () => {
    const out = html(retime([spin()], 0, false));
    expect(out).not.toContain('animate');
    expect(out).toContain('<line');
  });
  it('reverse swaps a rotation and a flow, never a back-and-forth motion', () => {
    const flow = el('path', { d: 'M0 0' }, [el('animate', { attributeName: 'stroke-dashoffset', from: 22, to: 0, dur: '0.9s' })]);
    const piston = el('g', undefined, [el('animateTransform', { attributeName: 'transform', type: 'translate', from: '0 0', to: '0 10', dur: '1s' })]);
    const out = html(retime([spin(), flow, piston], 100, true));
    expect(out).toContain('from="360 50 50" to="0 50 50"');
    expect(out).toContain('from="0" to="22"');
    expect(out).toContain('from="0 0" to="0 10"');
  });
});

describe('the layer on a drawn symbol', () => {
  const draw = (symbol: string, data: Record<string, unknown>, animate = true) =>
    drawScada(symbol as never, scadaPaint({ symbol }, slots(data), { animate }));
  it('a plain symbol is exactly what it was', () => {
    const a = draw('home.router', { running: true, value: 50 });
    const b = drawScada('home.router' as never, { ...scadaPaint({ symbol: 'home.router' }, slots({ running: true, value: 50 }), { animate: true }), states: undefined });
    expect(html(a.nodes)).toBe(html(b.nodes));
  });
  it('a mode puts its badge in the top right corner, inside the box', () => {
    const d = draw('home.router', { running: true, mode: 'maintenance' });
    const h = html(d.nodes);
    expect(h).toContain(`cx="${d.w - 14}" cy="14"`);
    expect(h).toContain('var(--warning)');
  });
  it('lost data dims the drawing, frames it with a dashed line and puts a badge top left', () => {
    const d = draw('home.tv', { value: 40, quality: 'offline' });
    const h = html(d.nodes);
    expect(h).toContain('opacity="0.35"');
    expect(h).toContain('stroke-dasharray="4 4"');
    expect(h).toContain('cx="14" cy="14"');
  });
  it('an unacknowledged alarm pulses where motion is allowed and holds still where it is not', () => {
    const on = html(draw('home.router', { running: true, status: 'critical', ack: false }).nodes);
    const off = html(draw('home.router', { running: true, status: 'critical', ack: false }, false).nodes);
    expect(on).toContain('values="1;0.15;1"');
    expect(off).not.toContain('values="1;0.15;1"');
    expect(off).toContain('opacity="0.85"');
    // Acknowledged or not reported: no ring.
    expect(html(draw('home.router', { running: true, status: 'critical', ack: true }).nodes)).not.toContain('values="1;0.15;1"');
    // Not an alarm: no ring either.
    expect(html(draw('home.router', { running: true, ack: false }).nodes)).not.toContain('values="1;0.15;1"');
  });
  it('a command in flight is a spinner, a failed one a red mark; the opening is a bar', () => {
    expect(html(draw('home.plug.smart', { pending: true }).nodes)).toContain('type="rotate"');
    expect(html(draw('home.plug.smart', { pending: true }, false).nodes)).not.toContain('animateTransform');
    expect(html(draw('home.plug.smart', { failed: true, pending: true }).nodes)).toContain('>!<');
    const bar = html(draw('home.plug.smart', { position: 50, running: true }).nodes);
    expect(bar).toContain('rx="4"');
  });
  it('speed and direction act on a symbol and on a connection; connections get no badges', () => {
    const fast = html(draw('home.router', { running: true, speed: 200 }).nodes);
    const slow = html(draw('home.router', { running: true, speed: 50 }).nodes);
    expect(fast).not.toBe(slow);
    const paint = scadaPaint({ symbol: 'home.router' }, slots({ running: true, mode: 'manual', speed: 50, direction: 'reverse' }), { animate: true });
    const p = html(linkNodes('pipe', [{ x: 0, y: 50 }, { x: 100, y: 50 }], paint, 1));
    expect(p).not.toContain('>M<');
    expect(p).toContain('from="0" to="22"');
    expect(p).toContain('dur="1.8s"');
  });
  it('badges do not turn or mirror with the symbol', () => {
    const d = draw('home.router', { running: true, mode: 'manual' });
    const turned = drawScada('home.router', scadaPaint({ symbol: 'home.router' }, slots({ running: true, mode: 'manual' }), { animate: true }), 90, true);
    expect(html(d.nodes)).toContain('>M<');
    expect(html(turned.nodes)).toContain('>M<');
    expect(html(turned.nodes)).not.toContain('scale(-1 1)>' + '<circle');
  });
  it('applyStates leaves a tree untouched when nothing is set', () => {
    const t = [el('rect', { x: 0, y: 0, width: 5, height: 5 })];
    expect(applyStates(t, 100, 100, scadaPaint({ symbol: 'home.plug.smart' }, {}, {}))).toBe(t);
  });
});

describe('in a scene', () => {
  const base = {
    width: 600, height: 300, scale: 0.6, fit: 'canvas' as const,
    elements: [{ id: 'p1', symbol: 'home.router', x: 100, y: 100 }, { id: 'v1', symbol: 'home.plug.smart', x: 300, y: 100 }],
    links: [{ from: 'p1.r', to: 'v1.l', kind: 'pipe', medium: 'cold' }],
  };
  const model = (rows: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) =>
    sceneModel({ ...base, ...extra } as never, { points: { shape: 'table', rows } as never }, { animate: true });
  const markup = (m: ReturnType<typeof model>) => m.nodes.map(svgToString).join('');

  it('reads the state columns of a row', () => {
    const h = markup(model([{ id: 'p1', running: true, mode: 'lockout', quality: 'stale' }]));
    expect(h).toContain('stroke-dasharray="4 4"');
  });
  it('marks a locked-out symbol in the hits and leaves the others', () => {
    const m = model([{ id: 'p1', mode: 'lockout' }]);
    expect(m.hits.find((x) => x.id === 'p1')?.locked).toBe(true);
    expect(m.hits.find((x) => x.id === 'v1')?.locked).toBe(false);
  });
  it('a connection with no id of its own follows the speed and direction of its "from" symbol', () => {
    const rules = [{ target: 'p1', speed: 50, reverse: true }];
    const h = markup(model([{ id: 'p1', running: true }], { rules }));
    expect(h).toContain('from="0" to="22"');
  });
  it('rules force states over the row', () => {
    const rules = [{ target: 'p1', op: 'gt', key: 'value', value: 80, mode: 'maintenance', quality: 'bad', pending: true }];
    const quiet = markup(model([{ id: 'p1', value: 10 }], { rules }));
    const loud = markup(model([{ id: 'p1', value: 90 }], { rules }));
    expect(quiet).not.toContain('var(--warning)');
    expect(loud).toContain('>?<');
    expect(loud).toContain('type="rotate"');
  });
  it('effects are parsed, bounded and validated', () => {
    const fx = evaluateRules([{ target: 'a', mode: 'Manual', quality: 'nope', speed: 900, position: -4, ack: 'false', reverse: true }], { rows: new Map([['a', {}]]) }).get('a');
    expect(fx).toMatchObject({ mode: 'manual', speed: 400, position: 0, ack: false, reverse: true });
    expect(fx?.quality).toBeUndefined();
    const issues = validateRules([{ target: 'a', mode: 'x', quality: 'y', speed: 'fast', position: 'wide' }], { elementIds: ['a'] });
    expect(issues.map((i) => i.path).sort()).toEqual(['rules.0.mode', 'rules.0.position', 'rules.0.quality', 'rules.0.speed']);
  });
});
