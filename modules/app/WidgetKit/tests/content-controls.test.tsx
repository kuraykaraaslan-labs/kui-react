import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { effective, templateDefaults, validate } from '../settings/engine';
import type { SettingsTemplate } from '../settings/types';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { CONTENT_MARKDOWN, CONTENT_MARKDOWN_KIND } from '../templates/content-markdown';
import { CONTENT_IMAGE, CONTENT_IMAGE_KIND } from '../templates/content-image';
import { CONTENT_LINKS, CONTENT_LINKS_KIND } from '../templates/content-links';
import { CONTENT_EMBED, CONTENT_EMBED_KIND } from '../templates/content-embed';
import { CONTROL_BUTTON, CONTROL_BUTTON_KIND } from '../templates/control-button';
import { CONTROL_SWITCH, CONTROL_SWITCH_KIND } from '../templates/control-switch';
import { CONTROL_SLIDER, CONTROL_SLIDER_KIND } from '../templates/control-slider';
import { CONTROL_SETPOINT, CONTROL_SETPOINT_KIND } from '../templates/control-setpoint';
import { CONTENT_MARKDOWN_VIEW } from '../views/ContentMarkdownView';
import { CONTENT_IMAGE_VIEW } from '../views/ContentImageView';
import { CONTENT_LINKS_VIEW } from '../views/ContentLinksView';
import { CONTENT_EMBED_VIEW } from '../views/ContentEmbedView';
import { CONTROL_BUTTON_VIEW } from '../views/ControlButtonView';
import { CONTROL_SWITCH_VIEW } from '../views/ControlSwitchView';
import { CONTROL_SLIDER_VIEW } from '../views/ControlSliderView';
import { CONTROL_SETPOINT_VIEW } from '../views/ControlSetpointView';
import { EMBED_SANDBOX, embedHostAllowed, embedSandbox, normalizeEmbedHost, resolveEmbedUrl, resolveLink } from '../views/content-logic';
import { WidgetKitProvider } from '../WidgetKitContext';
import { buttonLookOf } from '../views/ControlButtonView';
import { footerKeys, keyLabel } from '../views/ContentMarkdownView';
import { imageFilter } from '../views/ContentImageView';
import { parseMarkdown } from '../views/markdown';

const CASES: Array<[SettingsTemplate, { type: string; template: SettingsTemplate }, WidgetKindView]> = [
  [CONTENT_MARKDOWN, CONTENT_MARKDOWN_KIND, CONTENT_MARKDOWN_VIEW],
  [CONTENT_IMAGE, CONTENT_IMAGE_KIND, CONTENT_IMAGE_VIEW],
  [CONTENT_LINKS, CONTENT_LINKS_KIND, CONTENT_LINKS_VIEW],
  [CONTENT_EMBED, CONTENT_EMBED_KIND, CONTENT_EMBED_VIEW],
  [CONTROL_BUTTON, CONTROL_BUTTON_KIND, CONTROL_BUTTON_VIEW],
  [CONTROL_SWITCH, CONTROL_SWITCH_KIND, CONTROL_SWITCH_VIEW],
  [CONTROL_SLIDER, CONTROL_SLIDER_KIND, CONTROL_SLIDER_VIEW],
  [CONTROL_SETPOINT, CONTROL_SETPOINT_KIND, CONTROL_SETPOINT_VIEW],
];

function props(template: SettingsTemplate, over: Partial<WidgetViewProps> & { settings?: Record<string, unknown> } = {}): WidgetViewProps {
  return {
    format: {},
    data: {},
    locale: 'en',
    ...over,
    settings: effective(template, over.settings),
  };
}

describe('templates', () => {
  it.each(CASES.map(([t, k, v]) => [t.id, t, k, v] as const))('%s: v1, valid defaults, groups and kind', (_id, t, k, v) => {
    expect(t.version).toBe(1);
    expect(t.migrations).toEqual([]);
    expect(t.id).toBe(`builtin:${k.type}`);
    expect(k.template).toBe(t);
    expect(t.cardDefaults?.buttons).toEqual([]);
    const r = validate(t, templateDefaults(t));
    expect(r.issues).toEqual([]);
    const groups = new Set(t.groups.map((g) => g.id));
    for (const [key, f] of Object.entries(t.fields)) expect(groups.has(f.group ?? ''), `${key} -> ${f.group}`).toBe(true);
    expect(v.View).toBeTypeOf('function');
  });
  it('image and embed have no card padding; markdown has an optional record slot', () => {
    expect(CONTENT_IMAGE.cardDefaults).toEqual({ buttons: [], padding: 0 });
    expect(CONTENT_EMBED.cardDefaults).toEqual({ buttons: [], padding: 0 });
    expect(CONTENT_MARKDOWN_KIND.slots).toEqual([expect.objectContaining({ key: 'record', shape: 'record', required: false })]);
  });
  it('save-time rules refuse unsafe links, images and embeds, and bad ranges', () => {
    expect(validate(CONTENT_IMAGE, { href: 'javascript:alert(1)' }).issues.map((i) => i.path)).toContain('href');
    expect(validate(CONTENT_LINKS, { links: [{ label: 'x', href: 'javascript:alert(1)' }] }).issues.map((i) => i.path)).toContain('links.0.href');
    expect(validate(CONTENT_EMBED, { url: 'https://localhost/x' }).issues).toHaveLength(1);
    expect(validate(CONTROL_SLIDER, { min: 10, max: 5 }).issues.map((i) => i.path)).toContain('max');
    expect(validate(CONTROL_SETPOINT, { step: 0 }).issues.map((i) => i.path)).toContain('step');
  });
  it('content is empty without content; controls never are', () => {
    expect(CONTENT_MARKDOWN_VIEW.isEmpty!({}, { content: ' ' })).toBe(true);
    expect(CONTENT_MARKDOWN_VIEW.isEmpty!({}, { content: 'Hi' })).toBe(false);
    expect(CONTENT_IMAGE_VIEW.isEmpty!({}, {})).toBe(true);
    expect(CONTENT_LINKS_VIEW.isEmpty!({}, { links: [] })).toBe(true);
    expect(CONTENT_EMBED_VIEW.isEmpty!({}, {})).toBe(true);
    for (const v of [CONTROL_BUTTON_VIEW, CONTROL_SWITCH_VIEW, CONTROL_SLIDER_VIEW, CONTROL_SETPOINT_VIEW]) expect(v.isEmpty!({}, {})).toBe(false);
  });
});

describe('views render with defaults', () => {
  it.each(CASES.map(([t, , v]) => [t.id, t, v] as const))('%s', (_id, t, v) => {
    const { container } = render(<v.View {...props(t, { onControl: vi.fn().mockResolvedValue(undefined) })} />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe('content security', () => {
  it('link allow-list', () => {
    expect(resolveLink('/admin')).toEqual({ href: '/admin', external: false });
    expect(resolveLink('//evil.com')).toBeNull();
    expect(resolveLink('java\tscript:alert(1)')).toBeNull();
    expect(resolveLink('javascript:alert(1)')).toBeNull();
    expect(resolveLink('mailto:a@b.co')?.external).toBe(true);
  });
  it('embed gate: https and public hosts only', () => {
    expect(resolveEmbedUrl('http://example.org/')).toEqual({ ok: false, reason: 'scheme' });
    expect(resolveEmbedUrl('https://10.0.0.1/')).toEqual({ ok: false, reason: 'host' });
    expect(resolveEmbedUrl('https://[::1]/')).toEqual({ ok: false, reason: 'host' });
    expect(resolveEmbedUrl('https://intranet/')).toEqual({ ok: false, reason: 'host' });
    expect(resolveEmbedUrl('https://u:p@grafana.com/')).toEqual({ ok: false, reason: 'credentials' });
    expect(resolveEmbedUrl('https://grafana.com:8443/')).toEqual({ ok: false, reason: 'port' });
    expect(resolveEmbedUrl('https://grafana.com/d/1').ok).toBe(true);
  });
  it('markdown shows raw HTML as text and never builds markup', () => {
    const { container } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings: { content: '<img src=x onerror=alert(1)> **bold** <script>alert(1)</script>' } })} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });
  it('markdown inserts {{field}} values as escaped, formatted text, never as markdown', () => {
    const { container } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, {
      settings: { content: 'Temp: {{temp}} · Name: {{name}} · Missing: {{nope}}' },
      format: { unit: '°C', decimals: 1 },
      data: { record: { shape: 'record', record: { temp: 21.456, name: '**<b>x</b>** [y](javascript:alert(1))' } } },
    })} />);
    expect(container.textContent).toContain('Temp: 21.5 °C');
    expect(container.textContent).toContain('Name: **<b>x</b>** [y](javascript:alert(1))');
    expect(container.textContent).toContain('Missing: —');
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
  it('markdown leaves {{field}} literal when no record is bound, and inside code', () => {
    expect(parseMarkdown('`{{a}}`')[0]).toEqual({ t: 'paragraph', children: [{ t: 'code', text: '{{a}}' }] });
    const { container } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings: { content: 'v={{a}}' } })} />);
    expect(container.textContent).toBe('v={{a}}');
  });
  it('a javascript: markdown link keeps its label as text; a safe one gets the link colour', () => {
    const { container } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, {
      settings: { content: '[bad](javascript:alert(1)) [good](https://kui.dev)', linkColor: '#ff0000' },
    })} />);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://kui.dev/');
    expect(links[0].getAttribute('rel')).toContain('noopener');
    expect(links[0].style.color).toBe('rgb(255, 0, 0)');
    expect(container.textContent).toContain('bad');
  });
  it('quick links drop a javascript: target; image refuses one', () => {
    render(<CONTENT_LINKS_VIEW.View {...props(CONTENT_LINKS, {
      settings: { links: [{ label: 'Evil', href: 'javascript:alert(1)' }, { label: 'Users', href: '/admin/users' }] },
    })} />);
    expect(screen.queryByText('Evil')).toBeNull();
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
    const { container } = render(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, { settings: { src: 'javascript:alert(1)' } })} />);
    expect(container.querySelector('img')).toBeNull();
  });
  it('a non-https embed is refused; an https one is sandboxed without same-origin', () => {
    const { container, rerender } = render(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url: 'http://example.org/' } })} />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('cannot be embedded');
    rerender(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url: 'https://grafana.com/d/1', aspect: '16:9' } })} />);
    const frame = container.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
  });
  it('image applies fit, position and overlay', () => {
    const { container } = render(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, {
      settings: { src: 'https://x.dev/a.png', fit: 'contain', position: 'top', overlayColor: 'rgba(0,0,0,0.4)', caption: 'Plant' },
    })} />);
    const img = container.querySelector('img')!;
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.objectPosition).toBe('top');
    expect(screen.getByText('Plant')).toBeInTheDocument();
  });
});

describe('controls', () => {
  it('a button the host gives a pressed state is a toggle; without one it is a plain button', () => {
    const { unmount } = render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { settings: { label: 'Fan' }, pressed: true })} />);
    expect(screen.getByRole('button', { name: 'Fan' })).toHaveAttribute('aria-pressed', 'true');
    unmount();
    render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { settings: { label: 'Fan' } })} />);
    expect(screen.getByRole('button', { name: 'Fan' })).not.toHaveAttribute('aria-pressed');
  });

  it('a switch asks the host to set the toggled value and shows success', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: { value: { shape: 'scalar', value: false } }, onControl })} />);
    await userEvent.setup().click(screen.getByRole('switch'));
    expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: true });
    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
  });
  it('a switch reads onMatch exactly', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { settings: { onMatch: 'RUNNING' }, data: { value: { shape: 'scalar', value: 'RUNNING' } }, onControl })} />);
    expect(screen.getByRole('switch')).toBeChecked();
    await userEvent.setup().click(screen.getByRole('switch'));
    expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: false });
  });
  it('a switch is disabled with the host reason', () => {
    render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, {
      data: { value: { shape: 'scalar', value: true } }, onControl: vi.fn(), controlDisabledReason: 'No permission',
    })} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('No permission');
  });
  it('a switch is disabled when stale with disableWhen [stale], and enabled when not', () => {
    const value = { value: { shape: 'scalar' as const, value: true } };
    const { rerender } = render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: value, onControl: vi.fn(), stale: true, settings: { disableWhen: ['stale'] } })} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent(/old/);
    rerender(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: value, onControl: vi.fn(), stale: true, settings: { disableWhen: [] } })} />);
    expect(screen.getByRole('switch')).not.toBeDisabled();
  });
  it('a switch with an unknown state is disabled by disableWhen [unknown]', () => {
    render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { onControl: vi.fn(), settings: { disableWhen: ['unknown'] } })} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
  });
  it('a control with no onControl is disabled as not connected', () => {
    render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON)} />);
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  });
  it('a button runs and applies its colours', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { settings: { label: 'Start', mainColor: '#00ff00' }, onControl })} />);
    const btn = screen.getByRole('button', { name: 'Start' });
    expect(btn.style.getPropertyValue('--kb-bg')).toBe('#00ff00');
    expect(btn.className).toContain('bg-[color:var(--kb-bg)]');
    await userEvent.setup().click(btn);
    expect(onControl).toHaveBeenCalledWith({ kind: 'run' });
  });
  it('a setpoint applies a typed value; a stepper sets value + step', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { unmount } = render(<CONTROL_SETPOINT_VIEW.View {...props(CONTROL_SETPOINT, { data: { value: { shape: 'scalar', value: 20 } }, onControl })} />);
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '22{Enter}');
    expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: 22 });
    unmount();
    onControl.mockClear();
    render(<CONTROL_SETPOINT_VIEW.View {...props(CONTROL_SETPOINT, { settings: { layout: 'stepper', step: 5 }, data: { value: { shape: 'scalar', value: 20 } }, onControl })} />);
    await user.click(screen.getByRole('button', { name: 'Increase' }));
    // a stepper writes once its presses settle (ControlSetpoint settleMs, 700 ms)
    await waitFor(() => expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: 25 }));
  });
  it('a slider shows the formatted value and is disabled when the value is unknown and disableWhen has it', () => {
    const { rerender } = render(<CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, {
      data: { value: { shape: 'scalar', value: 40 } }, format: { unit: '%' }, onControl: vi.fn(),
    })} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '40 %');
    expect(screen.getByRole('slider')).not.toBeDisabled();
    rerender(<CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, { onControl: vi.fn(), settings: { disableWhen: ['unknown'] } })} />);
    expect(screen.getByRole('slider')).toBeDisabled();
  });
});

describe('host hooks', () => {
  it('markdown inserts {{param_x}} from board params as escaped text; literal without params', () => {
    const settings = { content: 'Site: {{param_site}} / {{param_none}}' };
    const { container, rerender } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings, params: { site: '<b>Plant **A**</b>' } })} />);
    expect(container.textContent).toBe('Site: <b>Plant **A**</b> / —');
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('strong')).toBeNull();
    rerender(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings })} />);
    expect(container.textContent).toBe('Site: {{param_site}} / {{param_none}}');
  });
  it('markdown action links call onElementClick, and are plain text without the hook', async () => {
    const onElementClick = vi.fn();
    const settings = { content: 'Go [open valve](action:valve_1) now' };
    const { container, rerender } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings, onElementClick })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'open valve' }));
    expect(onElementClick).toHaveBeenCalledWith('valve_1');
    expect(container.querySelector('a')).toBeNull();
    rerender(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings })} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toBe('Go open valve now');
  });
  it('markdown internal links go through resolveUrl', () => {
    const { container } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, {
      settings: { content: '[users](/admin/users)' }, resolveUrl: (u) => `/t/acme${u}`,
    })} />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/t/acme/admin/users');
  });
  it('image resolves internal src and href through resolveUrl, and re-checks the result', () => {
    const { container, rerender } = render(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, {
      settings: { src: '/uploads/a.png', href: '/admin' }, resolveUrl: (u) => `/t/acme${u}`,
    })} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/t/acme/uploads/a.png');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/t/acme/admin');
    rerender(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, {
      settings: { src: '/uploads/a.png' }, resolveUrl: () => 'javascript:alert(1)',
    })} />);
    expect(container.querySelector('img')).toBeNull();
    rerender(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, {
      settings: { src: 'https://x.dev/a.png' }, resolveUrl: (u) => `/t/acme${u}`,
    })} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x.dev/a.png');
  });
  it('quick links resolve internal hrefs, keep external ones', () => {
    render(<CONTENT_LINKS_VIEW.View {...props(CONTENT_LINKS, {
      settings: { links: [{ label: 'Users', href: '/admin/users' }, { label: 'Docs', href: 'https://kui.dev' }] },
      resolveUrl: (u) => `/t/acme${u}`,
    })} />);
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/t/acme/admin/users');
    expect(screen.getByRole('link', { name: /^Docs/ })).toHaveAttribute('href', 'https://kui.dev/');
  });
  it('embed frame is named by the card title, else by the host', () => {
    const settings = { url: 'https://grafana.com/d/1' };
    const { container, rerender } = render(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings, title: 'Boiler room' })} />);
    expect(container.querySelector('iframe')?.getAttribute('title')).toBe('Boiler room');
    rerender(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings })} />);
    expect(container.querySelector('iframe')?.getAttribute('title')).toBe('Embedded page: grafana.com');
  });
  it('a button with a confirm policy asks first, using the policy text as the question', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { onControl, confirm: { mode: 'confirm', text: 'Restart the pump?' } })} />);
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(onControl).not.toHaveBeenCalled();
    expect(screen.getByText('Restart the pump?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onControl).toHaveBeenCalledWith({ kind: 'run', confirmation: { confirmed: true } });
  });
  it('a button with a typed policy needs the exact text', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { onControl, confirm: { mode: 'typed', text: 'pump-1' } })} />);
    await user.click(screen.getByRole('button', { name: 'Run' }));
    const ok = screen.getByRole('button', { name: 'Confirm' });
    await user.type(screen.getByRole('textbox'), 'pump-2');
    expect(ok).toBeDisabled();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'pump-1');
    await user.click(ok);
    expect(onControl).toHaveBeenCalledWith({ kind: 'run', confirmation: { confirmed: true, typed: 'pump-1' } });
  });
  it('a switch with a confirm policy writes only after Confirm; Cancel writes nothing', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, {
      data: { value: { shape: 'scalar', value: false } }, onControl, confirm: { mode: 'confirm' },
    })} />);
    await user.click(screen.getByRole('switch'));
    expect(onControl).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onControl).not.toHaveBeenCalled();
    expect(screen.getByRole('switch')).not.toBeChecked();
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: true, confirmation: { confirmed: true } });
  });
  it('a switch with a typed policy requires the exact text', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, {
      data: { value: { shape: 'scalar', value: true } }, onControl, confirm: { mode: 'typed', text: 'OFF' },
    })} />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await user.type(screen.getByRole('textbox'), 'OFF');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: false, confirmation: { confirmed: true, typed: 'OFF' } });
  });
  it('a setpoint and a slider ask before writing under a confirm policy', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { unmount } = render(<CONTROL_SETPOINT_VIEW.View {...props(CONTROL_SETPOINT, {
      data: { value: { shape: 'scalar', value: 20 } }, onControl, confirm: { mode: 'confirm' },
    })} />);
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '22{Enter}');
    expect(onControl).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: 22, confirmation: { confirmed: true } });
    unmount();
    onControl.mockClear();
    render(<CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, {
      data: { value: { shape: 'scalar', value: 40 } }, onControl, confirm: { mode: 'confirm' },
    })} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '41' } });
    fireEvent.pointerUp(slider);
    expect(onControl).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: 41, confirmation: { confirmed: true } });
  });
});

describe('embed settings', () => {
  const url = 'https://www.openstreetmap.org/export/embed.html?bbox=1,2,3,4';
  it('an allow-list entry is a public hostname or a subdomain wildcard, nothing else', () => {
    expect(normalizeEmbedHost(' Grafana.Example.COM. ')).toBe('grafana.example.com');
    expect(normalizeEmbedHost('*.openstreetmap.org')).toBe('*.openstreetmap.org');
    for (const bad of ['*', '*.com', 'https://grafana.com', 'grafana.com:443', 'grafana.com/d', '8.8.8.8', 'intranet', 'nas.local', '-a.com', 'a..com', 42, '']) {
      expect(normalizeEmbedHost(bad), String(bad)).toBeNull();
    }
  });
  it('a wildcard matches subdomains only; an exact entry matches only itself; an empty list matches nothing', () => {
    const list = ['grafana.com', '*.openstreetmap.org', 'not a host'];
    expect(embedHostAllowed('grafana.com', list)).toBe(true);
    expect(embedHostAllowed('GRAFANA.com.', list)).toBe(true);
    expect(embedHostAllowed('play.grafana.com', list)).toBe(false);
    expect(embedHostAllowed('www.openstreetmap.org', list)).toBe(true);
    expect(embedHostAllowed('openstreetmap.org', list)).toBe(false);
    expect(embedHostAllowed('evilopenstreetmap.org', list)).toBe(false);
    expect(embedHostAllowed('grafana.com', [])).toBe(false);
  });
  it('the gate refuses a site off the list, and no list keeps the old behaviour', () => {
    expect(resolveEmbedUrl(url, ['grafana.com'])).toEqual({ ok: false, reason: 'notAllowed', host: 'www.openstreetmap.org' });
    expect(resolveEmbedUrl(url, []).ok).toBe(false);
    expect(resolveEmbedUrl(url, ['*.openstreetmap.org']).ok).toBe(true);
    expect(resolveEmbedUrl(url).ok).toBe(true);
    // The private-host gate still comes first.
    expect(resolveEmbedUrl('https://10.0.0.1/', ['10.0.0.1'])).toEqual({ ok: false, reason: 'host' });
  });
  it('a card whose site the host does not allow frames nothing and names the site', () => {
    const { container } = render(
      <WidgetKitProvider value={{ embedHosts: ['grafana.com'] }}>
        <CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url } })} />
      </WidgetKitProvider>,
    );
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/Pages from www\.openstreetmap\.org may not be embedded here/)).toBeInTheDocument();
  });
  it('the sandbox can only lose permissions, never gain same-origin or top navigation', () => {
    expect(embedSandbox(undefined)).toBe(EMBED_SANDBOX);
    expect(embedSandbox(['scripts'])).toBe('allow-scripts');
    expect(embedSandbox([])).toBe('');
    const crafted = embedSandbox(['same-origin', 'top-navigation', 'scripts allow-same-origin', 'forms', 42]);
    expect(crafted).toBe('allow-forms');
    for (const v of [crafted, embedSandbox(['same-origin'])]) {
      expect(v).not.toContain('same-origin');
      expect(v).not.toContain('top-navigation');
    }
    const { container } = render(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url, sandboxAllow: ['forms', 'same-origin'] } })} />);
    expect(container.querySelector('iframe')!.getAttribute('sandbox')).toBe('allow-forms');
  });
  it('the address bar names the host, shows the hint and opens the page in a new tab', () => {
    render(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url } })} />);
    expect(screen.getByText('www.openstreetmap.org')).toBeInTheDocument();
    expect(screen.getByText(/may not allow embedding/)).toBeInTheDocument();
    const open = screen.getByRole('link', { name: /Open/ });
    expect(open).toHaveAttribute('href', url.replace('?', '?'));
    expect(open).toHaveAttribute('target', '_blank');
    expect(open.getAttribute('rel')).toContain('noopener');
  });
  it('the bar can be hidden or moved; the hint and link text are settings', () => {
    const { container, rerender } = render(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url, showToolbar: false } })} />);
    expect(screen.queryByRole('link')).toBeNull();
    rerender(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url, toolbarPosition: 'top', hintText: 'Live map', openLabel: 'Full map' } })} />);
    expect(screen.getByText('Live map')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Full map/ })).toBeInTheDocument();
    expect(container.firstElementChild!.firstElementChild!.className).toContain('border-b');
  });
  it('zoom scales the frame, border and radius frame it', () => {
    const { container } = render(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url, zoom: 50, border: true, borderColor: '#ff0000', radius: 12 } })} />);
    const frame = container.querySelector('iframe')!;
    expect(frame.style.transform).toBe('scale(0.5)');
    expect(frame.style.width).toBe('200%');
    const box = frame.parentElement!;
    expect(box.style.borderColor).toBe('rgb(255, 0, 0)');
    expect(box.style.borderRadius).toBe('12px');
  });
  it('reloads the frame on the refresh interval', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url, refreshSeconds: 30 } })} />);
      const first = container.querySelector('iframe');
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(container.querySelector('iframe')).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('markdown settings', () => {
  it('callout styles use theme tones; custom uses its colours; an icon setting is accepted', () => {
    const { container, rerender } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings: { content: 'Hi', layout: 'callout', calloutStyle: 'warning' } })} />);
    const box = () => container.querySelector('.border-l-4') as HTMLElement;
    expect(box().style.borderLeftColor).toBe('var(--warning)');
    expect(box().style.background).toBe('var(--warning-subtle)');
    rerender(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings: { content: 'Hi', layout: 'callout', calloutStyle: 'custom', calloutColor: '#00ff00' } })} />);
    expect(box().style.borderLeftColor).toBe('rgb(0, 255, 0)');
  });
  it('clamps long text to a number of lines; scrolls by default', () => {
    const { container, rerender } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings: { content: 'a\n\nb', overflow: 'clamp', clampLines: 3 } })} />);
    const text = container.querySelector('.space-y-2') as HTMLElement;
    expect(text.style.webkitLineClamp).toBe('3');
    rerender(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, { settings: { content: 'a' } })} />);
    expect((container.firstElementChild as HTMLElement).className).toContain('overflow-auto');
  });
  it('heading font and colour, link underline, padding and vertical position change the render', () => {
    const { container } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, {
      settings: { content: '# Title\n\n[x](/a)', headingColor: '#ff0000', headingFont: { weight: 800 }, linkUnderline: 'always', padding: 12, verticalAlign: 'center' },
    })} />);
    const h = screen.getByText('Title');
    expect(h.style.color).toBe('rgb(255, 0, 0)');
    expect(h.style.fontWeight).toBe('800');
    expect(container.querySelector('a')!.className).toContain('underline');
    expect(container.querySelector('a')!.className).not.toContain('hover:underline');
    expect((container.firstElementChild as HTMLElement).style.padding).toBe('12px');
    expect(container.querySelector('.justify-center')).not.toBeNull();
  });
  it('lists record values as a footer: chosen keys, else every scalar; values are escaped text', () => {
    const record = { model: 'S200', uptimeHours: 12, nested: { a: 1 }, html: '<b>x</b>' };
    expect(footerKeys(record, [])).toEqual(['model', 'uptimeHours', 'html']);
    expect(footerKeys(record, ['model'])).toEqual(['model']);
    expect(keyLabel('uptimeHours')).toBe('Uptime hours');
    expect(keyLabel('serial_number')).toBe('Serial number');
    const { container, rerender } = render(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, {
      settings: { content: 'Hi', showRecord: true }, data: { record: { shape: 'record', record } },
    })} />);
    expect(screen.getByText('Uptime hours')).toBeInTheDocument();
    expect(screen.getByText('<b>x</b>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    rerender(<CONTENT_MARKDOWN_VIEW.View {...props(CONTENT_MARKDOWN, {
      settings: { content: 'Hi', showRecord: false }, data: { record: { shape: 'record', record } },
    })} />);
    expect(screen.queryByText('Uptime hours')).toBeNull();
  });
});

describe('image settings', () => {
  const src = 'https://x.dev/a.png';
  it('filters, zoom on hover and overlay strength change the render', () => {
    expect(imageFilter({})).toBeUndefined();
    expect(imageFilter({ grayscale: 100, brightness: 80 })).toBe('grayscale(100%) brightness(80%)');
    const { container } = render(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, {
      settings: { src, grayscale: 50, zoomOnHover: true, overlayColor: '#000000', overlayOpacity: 40 },
    })} />);
    const img = container.querySelector('img')!;
    expect(img.style.filter).toBe('grayscale(50%)');
    expect(img.className).toContain('group-hover/img:scale-105');
    const overlay = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(overlay.style.background).toContain('40%');
  });
  it('caption positions: on the image (top or bottom), below or above; background and alignment', () => {
    const { container, rerender } = render(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, { settings: { src, caption: 'Line 2' } })} />);
    expect(screen.getByText('Line 2').className).toContain('bottom-0');
    rerender(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, { settings: { src, caption: 'Line 2', captionPlacement: 'overlay-top' } })} />);
    expect(screen.getByText('Line 2').className).toContain('top-0');
    rerender(<CONTENT_IMAGE_VIEW.View {...props(CONTENT_IMAGE, { settings: { src, caption: 'Line 2', captionPlacement: 'above', captionAlign: 'end', captionBackground: '#ff0000' } })} />);
    const cap = container.querySelector('figcaption')!;
    expect(cap.parentElement!.firstElementChild).toBe(cap);
    expect(cap.className).toContain('text-right');
    expect(cap.style.background).toBe('rgb(255, 0, 0)');
  });
});

describe('links settings', () => {
  const links = [{ label: 'Users', href: '/admin/users', description: 'Everyone' }, { label: 'Docs', href: 'https://kui.dev' }];
  it('tiles lay out in columns; descriptions can be hidden; dividers are a setting', () => {
    const { container, rerender } = render(<CONTENT_LINKS_VIEW.View {...props(CONTENT_LINKS, { settings: { links, layout: 'tiles', columns: '2' } })} />);
    expect((container.querySelector('ul') as HTMLElement).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(screen.getByText('Everyone')).toBeInTheDocument();
    rerender(<CONTENT_LINKS_VIEW.View {...props(CONTENT_LINKS, { settings: { links, showDescription: false } })} />);
    expect(screen.queryByText('Everyone')).toBeNull();
    expect(container.querySelector('ul')!.className).toContain('divide-y');
    rerender(<CONTENT_LINKS_VIEW.View {...props(CONTENT_LINKS, { settings: { links, divider: false } })} />);
    expect(container.querySelector('ul')!.className).not.toContain('divide-y');
  });
  it('external links are marked and say they open a new tab; item colour and radius reach the items', () => {
    const { container, rerender } = render(<CONTENT_LINKS_VIEW.View {...props(CONTENT_LINKS, { settings: { links, itemColor: '#eeeeee', radius: 4 } })} />);
    const docs = screen.getByRole('link', { name: /Docs/ });
    expect(docs.textContent).toContain('↗');
    expect(docs).toHaveAccessibleName(/^Docs ?\(opens in a new tab\)$/);
    const li = container.querySelector('li') as HTMLElement;
    expect(li.style.getPropertyValue('--kui-link-bg')).toBe('#eeeeee');
    expect(li.style.getPropertyValue('--kui-link-radius')).toBe('4px');
    rerender(<CONTENT_LINKS_VIEW.View {...props(CONTENT_LINKS, { settings: { links, externalMark: false, openExternalInNewTab: false } })} />);
    expect(screen.getByRole('link', { name: 'Docs' }).textContent).not.toContain('↗');
    expect(screen.getByRole('link', { name: 'Docs' })).not.toHaveAttribute('target');
  });
});

describe('button settings', () => {
  it('colours per state become CSS variables the state classes read', () => {
    const look = buttonLookOf({ appearance: 'outlined', mainColor: '#0000ff', hoverColor: '#00ff00', disabledColor: '#cccccc', disabledTextColor: '#333333' });
    expect(look.style).toMatchObject({ '--kb-fg': '#0000ff', '--kb-border': '#0000ff', '--kb-hover-bg': '#00ff00', '--kb-dis-bg': '#cccccc' });
    expect(look.className).toContain('hover:bg-[color:var(--kb-hover-bg)]');
    expect(look.className).toContain('disabled:text-[color:var(--kb-dis-fg)]');
    expect(buttonLookOf({ mainColor: 'url(x)' }).style).not.toHaveProperty('--kb-bg');
  });
  it('round icon and pill layouts, icon after the text, and a description', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { settings: { layout: 'icon', label: 'Power' }, onControl })} />);
    const round = screen.getByRole('button', { name: 'Power' });
    expect(round.className).toContain('rounded-full');
    rerender(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { settings: { layout: 'fab', label: 'Go', description: 'Starts the line' }, onControl })} />);
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('shadow-md');
    expect(screen.getByText('Starts the line')).toBeInTheDocument();
    expect(container.querySelector('.justify-end-safe')).not.toBeNull();
  });
  it('feedback texts replace the status line; a failure keeps its reason', async () => {
    const user = userEvent.setup();
    const ok = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { settings: { successText: 'Line restarted' }, onControl: ok })} />);
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText('Line restarted')).toBeInTheDocument();
    unmount();
    const bad = vi.fn().mockRejectedValue(new Error('PLC offline'));
    render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { settings: { failureText: 'Restart failed' }, onControl: bad })} />);
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Restart failed (PLC offline)');
  });
  it('the confirmation wording is a setting; the policy and the typed text stay the command’s', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, {
      settings: { confirmQuestion: 'Restart line 2 now?', confirmLabel: 'Restart', cancelLabel: 'Keep running' },
      onControl, confirm: { mode: 'typed', text: 'line-2' },
    })} />);
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(screen.getByText('Restart line 2 now?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep running' })).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Restart' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByRole('textbox'), 'line-2');
    await user.click(confirm);
    expect(onControl).toHaveBeenCalledWith({ kind: 'run', confirmation: { confirmed: true, typed: 'line-2' } });
  });
});

describe('switch settings', () => {
  const on = { value: { shape: 'scalar' as const, value: true } };
  it('shows the state as large text in the on colour, as a pill, or not at all', () => {
    const { rerender } = render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: on, onControl: vi.fn(), settings: { label: 'Pump', onColor: '#00ff00' } })} />);
    expect(screen.getByText('Pump')).toBeInTheDocument();
    expect(screen.getByText('On').parentElement!.style.color).toBe('rgb(0, 255, 0)');
    expect(screen.getByRole('switch')).toHaveAccessibleName('Pump');
    expect(screen.getByRole('switch')).toHaveAccessibleDescription('On');
    rerender(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: on, onControl: vi.fn(), settings: { stateDisplay: 'pill', onLabel: 'Running' } })} />);
    expect(screen.getByText('Running').className).not.toContain('font-semibold');
    rerender(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: on, onControl: vi.fn(), settings: { stateDisplay: 'none' } })} />);
    expect(screen.queryByText('On')).toBeNull();
  });
  it('size and per-state knob colours change the switch', () => {
    const { container } = render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, {
      data: { value: { shape: 'scalar', value: false } }, onControl: vi.fn(), settings: { size: 'lg', thumbOffColor: '#ff0000' },
    })} />);
    expect(container.querySelector('.h-7.w-12')).not.toBeNull();
    expect((container.querySelector('.h-6.w-6') as HTMLElement).style.background).toBe('rgb(255, 0, 0)');
  });
  it('the card title names the switch when there is no label', () => {
    render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: on, onControl: vi.fn(), title: 'Coolant pump' })} />);
    expect(screen.getByRole('switch')).toHaveAccessibleName('Coolant pump');
  });
});

describe('slider settings', () => {
  const v = { value: { shape: 'scalar' as const, value: 40 } };
  it('label, value position and min/max', () => {
    const { container, rerender } = render(<CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, { data: v, onControl: vi.fn(), settings: { label: 'Speed' } })} />);
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toHaveAccessibleName('Speed');
    expect(screen.getByText('0')).toBeInTheDocument();
    rerender(<CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, { data: v, onControl: vi.fn(), settings: { showMinMax: false, showValue: false } })} />);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('40')).toBeNull();
    rerender(<CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, { data: v, onControl: vi.fn(), settings: { valuePosition: 'end' } })} />);
    expect(container.querySelector('.items-start .shrink-0')?.textContent).toBe('40');
  });
  it('tick marks with labels, thickness, thumb size and a vertical direction', () => {
    const { container, rerender } = render(<CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, {
      data: v, onControl: vi.fn(), settings: { tickMarks: 5, tickLabels: true, thickness: 10, thumbSize: 24 },
    })} />);
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    const input = screen.getByRole('slider');
    expect(input.style.height).toBe('10px');
    expect(input.style.getPropertyValue('--kui-slider-thumb-size')).toBe('24px');
    rerender(<CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, { data: v, onControl: vi.fn(), settings: { orientation: 'vertical' } })} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByRole('slider').style.writingMode).toBe('vertical-lr');
    expect(container).toBeTruthy();
  });
});

describe('setpoint settings', () => {
  const v = { value: { shape: 'scalar' as const, value: 22 } };
  it('shows the label and the current value; the caption, unit and range are settings', () => {
    const { rerender } = render(<CONTROL_SETPOINT_VIEW.View {...props(CONTROL_SETPOINT, {
      data: v, format: { unit: '°C' }, onControl: vi.fn(), settings: { label: 'Target', layout: 'stepper' },
    })} />);
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getAllByText('°C').length).toBe(2);
    rerender(<CONTROL_SETPOINT_VIEW.View {...props(CONTROL_SETPOINT, {
      data: v, format: { unit: '°C' }, onControl: vi.fn(), settings: { layout: 'stepper', unitDisplay: 'hide', currentLabel: 'Actual', showRange: true, min: 10, max: 30 },
    })} />);
    expect(screen.queryByText('°C')).toBeNull();
    expect(screen.getByText('Actual')).toBeInTheDocument();
    expect(screen.getByText('10 – 30')).toBeInTheDocument();
    rerender(<CONTROL_SETPOINT_VIEW.View {...props(CONTROL_SETPOINT, { data: v, onControl: vi.fn(), settings: { showValue: false } })} />);
    expect(screen.queryByText('Now')).toBeNull();
  });
  it('a dial steps and writes like the stepper; button colours apply', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<CONTROL_SETPOINT_VIEW.View {...props(CONTROL_SETPOINT, {
      data: v, onControl, settings: { layout: 'dial', step: 2, buttonColor: '#ff0000', buttonTextColor: '#00ff00' },
    })} />);
    expect(container.querySelector('svg circle')).not.toBeNull();
    const up = screen.getByRole('button', { name: 'Increase' });
    expect(up.style.color).toBe('rgb(0, 255, 0)');
    await userEvent.setup().click(up);
    await waitFor(() => expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: 24 }));
  });
});
