import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { effective, validate } from '../settings/engine';
import type { SlotData } from '../kind';
import { CONTENT_EMBED } from '../templates/content-embed';
import { CONTENT_IMAGE, CONTENT_IMAGE_KIND } from '../templates/content-image';
import { CONTENT_LINKS, CONTENT_LINKS_KIND } from '../templates/content-links';
import { CONTENT_IMAGE_VIEW, imageSource } from '../views/ContentImageView';
import { CONTENT_LINKS_VIEW } from '../views/ContentLinksView';
import { CONTENT_EMBED_VIEW } from '../views/ContentEmbedView';
import { expandAttrTemplate, hasAttrTokens, toQuickLinks } from '../views/content-logic';

const record = { id: 'pump 7/a', n: 42, ok: true, empty: '', obj: { a: 1 } };

describe('expandAttrTemplate', () => {
  it('leaves an address without tokens alone', () => {
    expect(hasAttrTokens('/devices/1')).toBe(false);
    expect(expandAttrTemplate('/devices/1', record)).toBe('/devices/1');
    expect(expandAttrTemplate(undefined, record)).toBeUndefined();
  });
  it('fills a path or a query, URL-encoded, so a value cannot add a segment or a host', () => {
    expect(expandAttrTemplate('/devices/{{attr_id}}', record)).toBe('/devices/pump%207%2Fa');
    expect(expandAttrTemplate('https://grafana.example.com/d?id={{attr_n}}&ok={{attr_ok}}', record)).toBe('https://grafana.example.com/d?id=42&ok=true');
    expect(expandAttrTemplate('/x/{{attr_id}}', { id: '../../admin' })).toBe('/x/..%2F..%2Fadmin');
    expect(expandAttrTemplate('/x/{{attr_id}}', { id: '//evil.com' })).toBe('/x/%2F%2Fevil.com');
  });
  it('a token in the host part makes the address unusable', () => {
    expect(expandAttrTemplate('https://{{attr_id}}.example.com/', record)).toBeNull();
    expect(expandAttrTemplate('https://x@{{attr_id}}/p', record)).toBeNull();
    expect(expandAttrTemplate('https://{{attr_id}}', record)).toBeNull();
    // a token after the authority is fine even when the host also has a dot
    expect(expandAttrTemplate('https://a.example.com/{{attr_n}}', record)).toBe('https://a.example.com/42');
  });
  it('a token with no usable value drops the address, never half-builds it', () => {
    expect(expandAttrTemplate('/d/{{attr_missing}}', record)).toBeNull();
    expect(expandAttrTemplate('/d/{{attr_empty}}', record)).toBeNull();
    expect(expandAttrTemplate('/d/{{attr_obj}}', record)).toBeNull();
    expect(expandAttrTemplate('/d/{{attr_id}}', undefined)).toBeNull();
  });
  it('only {{attr_key}} is a token (no spaces, no other prefixes)', () => {
    expect(hasAttrTokens('/d/{{ attr_id }}')).toBe(false);
    expect(hasAttrTokens('/d/{{param_id}}')).toBe(false);
  });
});

describe('save-time rules accept an address template', () => {
  it('links, embed and image link keep their templates valid', () => {
    expect(validate(CONTENT_LINKS, { links: [{ label: 'Device', href: '/devices/{{attr_id}}' }] }).issues).toEqual([]);
    expect(validate(CONTENT_EMBED, { url: 'https://grafana.example.com/d/{{attr_uid}}' }).issues).toEqual([]);
    expect(validate(CONTENT_IMAGE, { src: 'https://img.example.com/a.png', href: '/devices/{{attr_id}}' }).issues).toEqual([]);
  });
  it('an unsafe template is still refused', () => {
    expect(validate(CONTENT_LINKS, { links: [{ label: 'x', href: 'javascript:{{attr_id}}' }] }).issues.length).toBeGreaterThan(0);
  });
});

describe('content views with attributes', () => {
  const data = { record: { shape: 'record', record: { id: '7', host: 'x' } } as SlotData };
  it('quick links expand per link', () => {
    const links = toQuickLinks([{ label: 'Pump', href: '/pumps/{{attr_id}}' }, { label: 'Gone', href: '/pumps/{{attr_none}}' }], 24, data.record.record);
    expect(links.map((l) => l.link.href)).toEqual(['/pumps/7']);
    const View = CONTENT_LINKS_VIEW.View;
    const { container } = render(<View settings={effective(CONTENT_LINKS, { links: [{ label: 'Pump', href: '/pumps/{{attr_id}}' }] })} format={{}} data={data} locale="en" />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/pumps/7');
  });
  it('the embed frame takes the expanded address, the fixed host and the allow-list still apply', () => {
    const View = CONTENT_EMBED_VIEW.View;
    const ok = render(<View settings={effective(CONTENT_EMBED, { url: 'https://grafana.example.com/d/{{attr_id}}' })} format={{}} data={data} locale="en" title="g" />);
    expect(ok.container.querySelector('iframe')?.getAttribute('src')).toBe('https://grafana.example.com/d/7');
    ok.unmount();
    const bad = render(<View settings={effective(CONTENT_EMBED, { url: 'https://{{attr_host}}.example.com/' })} format={{}} data={data} locale="en" title="g" />);
    expect(bad.container.querySelector('iframe')).toBeNull();
  });
});

describe('content.image with a bound address', () => {
  it('declares an optional source and record slot', () => {
    expect(CONTENT_IMAGE_KIND.slots.map((s) => [s.key, s.shape, s.required])).toEqual([['source', 'scalar', false], ['record', 'record', false]]);
    expect(CONTENT_LINKS_KIND.slots[0]).toMatchObject({ key: 'record', shape: 'record', required: false });
  });
  it('the bound address wins when it is safe, else the setting stands', () => {
    const bound = (value: unknown): Record<string, SlotData> => ({ source: { shape: 'scalar', value: value as never } });
    expect(imageSource({ src: '/fallback.png' }, bound('https://img.example.com/plan.png'))).toBe('https://img.example.com/plan.png');
    expect(imageSource({ src: '/fallback.png' }, bound('javascript:alert(1)'))).toBe('/fallback.png');
    expect(imageSource({ src: '/fallback.png' }, bound('data:image/svg+xml,<svg/>'))).toBe('/fallback.png');
    expect(imageSource({}, bound(null))).toBeNull();
    expect(imageSource({ src: '/a.png' }, {})).toBe('/a.png');
  });
  it('renders the bound image and is empty only without any address', () => {
    const View = CONTENT_IMAGE_VIEW.View;
    const data = { source: { shape: 'scalar', value: 'https://img.example.com/plan.png' } as SlotData };
    const { container } = render(<View settings={effective(CONTENT_IMAGE, {})} format={{}} data={data} locale="en" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://img.example.com/plan.png');
    expect(CONTENT_IMAGE_VIEW.isEmpty!(data, effective(CONTENT_IMAGE, {}))).toBe(false);
    expect(CONTENT_IMAGE_VIEW.isEmpty!({}, effective(CONTENT_IMAGE, {}))).toBe(true);
  });
});
