'use client';
import { createContext, useContext, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { FieldOverrides } from '../SchemaForm/schema-form.context';
import {
  DEFAULT_WIDGET_KIT_MESSAGES, mergeKitMessages, type KindTextFn, type TemplateTextFn, type WidgetKitMessages,
  type WidgetKitMessagesInput,
} from './messages';

export interface WidgetKitHost {
  /** Draw an icon setting value ('fas fa-bolt', 'mdi:lamp', …). The host owns its icon set. */
  renderIcon?: (name: string, props: { className?: string; style?: CSSProperties }) => ReactNode;
  /** Field renderers for app-bound field types (icon, media, data-key pickers, …). */
  fieldOverrides?: FieldOverrides;
  /**
   * The thumbnail of a layout option's `preview` id in the settings editor (a tenant template's own
   * ids, or a redrawn builtin one). Return `null`/`undefined` to fall back to WidgetKit's drawing
   * (`renderWidgetPreview`); an id neither knows shows its label only.
   */
  renderPreview?: (id: string) => ReactNode;
  /** Locale for numbers and dates; defaults to the browser's. */
  locale?: string;
  /**
   * The sites a `content.embed` card may frame: hostnames, or `*.example.com` for its subdomains
   * (`normalizeEmbedHost`). Absent = no list (only the public-https gate applies); an empty list
   * allows no embed at all. A refused card says which site was refused and frames nothing.
   */
  embedHosts?: readonly string[];
  /**
   * The texts the kit draws itself (card chrome, board, editor, form, controls, views), in the
   * host's language: any group, any key; the rest stays English. Placement settings and explicit
   * props still win. Keep the object stable (memoize it): it is merged once per change.
   */
  messages?: WidgetKitMessagesInput;
  /**
   * A template's label, description, placeholder, option or group label in the host's language
   * (`undefined` keeps the English). Called by the settings editor; keyed by the template id, so
   * a tenant template never picks up a builtin's text. Keep the function stable per language.
   */
  templateText?: TemplateTextFn;
  /** A widget type's label, description, category or slot label (the board's widget picker). */
  kindText?: KindTextFn;
}

const Ctx = createContext<WidgetKitHost>({});
const MessagesCtx = createContext<WidgetKitMessages>(DEFAULT_WIDGET_KIT_MESSAGES);

export function WidgetKitProvider({ value, children }: { value: WidgetKitHost; children: ReactNode }) {
  const messages = useMemo(() => mergeKitMessages(value.messages), [value.messages]);
  return (
    <Ctx.Provider value={value}>
      <MessagesCtx.Provider value={messages}>{children}</MessagesCtx.Provider>
    </Ctx.Provider>
  );
}

export const useWidgetKit = () => useContext(Ctx);

/** The kit's texts: the host's `messages` over the English defaults (the defaults without a provider). */
export const useKitMessages = () => useContext(MessagesCtx);

/** An icon from a setting, through the host's resolver; nothing when there is none. */
export function SettingIcon({ name, className, style }: { name?: unknown; className?: string; style?: CSSProperties }) {
  const { renderIcon } = useWidgetKit();
  if (typeof name !== 'string' || !name || !renderIcon) return null;
  return <>{renderIcon(name, { className, style })}</>;
}
