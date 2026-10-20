// Normalises rendered widget HTML so the same widget drawn by kui-react (React), kui-ejs (EJS) and KUInative's
// web preview compares equal when it IS the same: no React comments, attribute and class order, style
// declaration order, entity spelling, self-closing spelling, generated ids and the icon element (an inline
// Font Awesome <svg> in React, an <i class="fas fa-…"> in EJS) all drop out. Pure, dependency-free; kui-ejs
// vendors this file next to the golden file.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ICON_STYLE = new Set(['fas', 'far', 'fab', 'fa', 'fa-solid', 'fa-regular', 'fa-brands', 'svg-inline--fa', 'fa-fw']);

const decode = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const encodeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encodeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Attr = [string, string];

function parseAttrs(raw: string): Attr[] {
  const out: Attr[] = [];
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out.push([m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4] ?? '')]);
  return out;
}

function normStyle(v: string): string {
  return v.split(';').map((d) => d.trim()).filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      return `${d.slice(0, i).trim().toLowerCase()}:${d.slice(i + 1).trim().replace(/\s+/g, ' ')}`;
    })
    .sort().join(';');
}

const classes = (v: string) => [...new Set(v.split(/\s+/).filter(Boolean))].sort();
const get = (list: Attr[], k: string) => list.find(([n]) => n === k)?.[1];

/** The icon an element draws, or null: <svg data-icon="x"> (React) or <i class="fas fa-x …"> (EJS). */
function iconOf(name: string, list: Attr[]): { icon: string; rest: string[] } | null {
  const cls = (get(list, 'class') ?? '').split(/\s+/).filter(Boolean);
  if (name === 'svg') {
    const icon = get(list, 'data-icon');
    if (!icon) return null;
    return { icon, rest: cls.filter((c) => !ICON_STYLE.has(c) && c !== `fa-${icon}`) };
  }
  if (name === 'i') {
    const named = cls.find((c) => /^fa-[a-z0-9-]+$/.test(c) && !ICON_STYLE.has(c));
    if (!named) return null;
    return { icon: named.slice(3), rest: cls.filter((c) => !ICON_STYLE.has(c) && c !== named) };
  }
  return null;
}

/** The normalised markup: one line, tags and text only. */
export function normalizeHtml(html: string): string {
  const ids = new Map<string, string>();
  // Generated ids (React useId, the kit's gradient ids) become stable placeholders, in order of appearance.
  let src = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\b(id|for|aria-labelledby|aria-describedby|aria-controls)="((?:ks|:r|«r|_r_|kit-)[^"]*)"/g, (_, a: string, v: string) => {
    if (!ids.has(v)) ids.set(v, `ID${ids.size + 1}`);
    return `${a}="${ids.get(v)}"`;
  });
  for (const [from, to] of ids) src = src.split(from).join(to);

  const out: string[] = [];
  const iElements: boolean[] = [];   // for <i>: true when it was an icon (its close tag is dropped)
  let svgDepth = 0;                  // > 0: inside an icon <svg>, whose children are dropped
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) {
      if (svgDepth) continue;
      const t = decode(m[5]).replace(/\s+/g, ' ').trim();
      if (t) out.push(encodeText(t));
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const selfClosing = m[4] === '/';
    if (svgDepth) {
      if (name === 'svg') svgDepth += closing ? -1 : selfClosing ? 0 : 1;
      continue;
    }
    if (closing) {
      if (name === 'i') { if (iElements.pop()) continue; }
      if (!VOID.has(name)) out.push(`</${name}>`);
      continue;
    }
    const list = parseAttrs(m[3]);
    const icon = iconOf(name, list);
    if (icon) {
      out.push(`<i data-icon="${encodeAttr(icon.icon)}"${icon.rest.length ? ` class="${encodeAttr([...new Set(icon.rest)].sort().join(' '))}"` : ''}></i>`);
      if (name === 'svg' && !selfClosing) svgDepth = 1;
      if (name === 'i' && !selfClosing) iElements.push(true);
      continue;
    }
    if (name === 'i' && !selfClosing) iElements.push(false);
    const kept = list
      // `data-wk-*` are a host's wiring hooks (the EJS partials' button actions); React wires its handlers in code.
      .filter(([k]) => k !== 'data-reactroot' && !k.startsWith('data-wk-'))
      .map(([k, v]): Attr => (k === 'class' ? [k, classes(v).join(' ')] : k === 'style' ? [k, normStyle(v)] : [k, v]))
      .filter(([k, v]) => !((k === 'class' || k === 'style') && v === ''))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    out.push(`<${name}${kept.map(([k, v]) => ` ${k}="${encodeAttr(v)}"`).join('')}>`);
    if (selfClosing && !VOID.has(name)) out.push(`</${name}>`);
  }
  return out.join('');
}
