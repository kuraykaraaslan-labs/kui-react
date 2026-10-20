'use client';
import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react';
import { SettingIcon } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { markdownModel, type BlockView, type InlineView, type MarkdownSettings as S } from './markdown-logic';
import { Row } from './ui';

export * from './markdown-logic';

function Inline({ nodes, host }: { nodes: InlineView[]; host: Pick<WidgetViewProps, 'renderLink' | 'onElementClick'> }): ReactNode {
  return nodes.map((n, i): ReactNode => {
    switch (n.t) {
      case 'text': return <Fragment key={i}>{n.text}</Fragment>;
      case 'strong': return <strong key={i}><Inline nodes={n.children} host={host} /></strong>;
      case 'em': return <em key={i}><Inline nodes={n.children} host={host} /></em>;
      case 'code': return <code key={i} className={n.className}>{n.text}</code>;
      case 'action': {
        const onClick = host.onElementClick;
        return (
          <button key={i} type="button" onClick={() => onClick?.(n.id)} className={n.className} style={n.style as CSSProperties | undefined}>
            <Inline nodes={n.children} host={host} />
          </button>
        );
      }
      case 'link': {
        const children = <Inline nodes={n.children} host={host} />;
        if (n.internalViaHost && host.renderLink) return <span key={i} style={n.style as CSSProperties | undefined}>{host.renderLink(n.href, children, n.className)}</span>;
        return <a key={i} href={n.href} className={n.className} style={n.style as CSSProperties | undefined} {...n.attrs}>{children}</a>;
      }
    }
  });
}

function Block({ b, host }: { b: BlockView; host: Pick<WidgetViewProps, 'renderLink' | 'onElementClick'> }): ReactNode {
  switch (b.t) {
    case 'heading': return <p className={b.className} style={b.style as CSSProperties}><Inline nodes={b.children} host={host} /></p>;
    case 'paragraph': return <p className={b.className}><Inline nodes={b.children} host={host} /></p>;
    case 'quote': return <blockquote className={b.className}><Inline nodes={b.children} host={host} /></blockquote>;
    case 'code': return <pre className={b.className}>{b.text}</pre>;
    case 'hr': return <hr className={b.className} />;
    case 'ul':
    case 'ol': {
      const List = b.t;
      return <List className={b.className}>{b.items.map((it, j) => <li key={j} className={it.className}><Inline nodes={it.children} host={host} /></li>)}</List>;
    }
  }
}

/** `content.markdown`: author-written text from a parsed node tree, never an HTML string. */
export function ContentMarkdownView({ settings, format, data, locale, renderLink, resolveUrl, params, onElementClick }: WidgetViewProps) {
  const s = settings as S;
  const m = useMemo(
    () => markdownModel(s, format, data, locale, { resolveUrl, hostRendersLinks: !!renderLink, params, handlesActions: !!onElementClick }),
    [s, format, data, locale, resolveUrl, renderLink, params, onElementClick],
  );
  const host = { renderLink, onElementClick };
  const text = (
    <div className={m.textClass} style={m.textStyle as CSSProperties | undefined}>
      {m.blocks.map((b, i) => <Fragment key={i}><Block b={b} host={host} /></Fragment>)}
    </div>
  );
  return (
    <div className={m.rootClass} style={m.rootStyle as CSSProperties}>
      <div className={m.alignClass}>
        {m.callout ? (
          <div className="flex gap-2.5 rounded-lg border-l-4 p-3" style={{ borderLeftColor: m.tone.accent, background: m.tone.background }}>
            {m.calloutIcon && (
              <SettingIcon name={m.calloutIcon.name} className="mt-0.5 shrink-0" style={{ width: 16, height: 16, fontSize: 16, color: m.calloutIcon.color }} />
            )}
            {text}
          </div>
        ) : text}
      </div>
      {m.footer.length > 0 && (
        <div className="mt-3 shrink-0 border-t border-border pt-1">
          {m.footer.map((f) => <Row key={f.label} label={f.label} value={f.value} />)}
        </div>
      )}
    </div>
  );
}

export const CONTENT_MARKDOWN_VIEW: WidgetKindView = {
  View: ContentMarkdownView,
  isEmpty: (_data, settings) => typeof settings.content !== 'string' || settings.content.trim() === '',
};
