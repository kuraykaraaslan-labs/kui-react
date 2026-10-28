'use client';
// The 2D preview of the scene setup drawer (next-boilerplate phase 42.5.4, D42-10): a stored diagram drawn read-only with the card's own view
// (`ScadaSceneView`, nothing forked), every symbol a button that answers a click with its id, and the picked one outlined. It is what "Pick in the
// scene" needs for kind `diagram`: the drawer's host passes it as `preview`, keeps the picked key and hands it back as `selected`.
//
// The diagram is drawn as it is stored, with no data: its rules run on nothing, so they are left out, and a symbol that is locked out (mode `lockout`)
// is drawn as a plain one, because a lock is a reason not to RUN it, not a reason not to pick it.
import { useId, useMemo } from 'react';
import type { ElementGesture, WidgetViewProps } from '../kind';
import { ScadaSceneView } from './ScadaSceneView';
import { cn } from '@/libs/utils/cn';

export interface SceneSetupPreview2DMessages {
  /** The accessible name of the drawing. */
  label: string;
  /** What to do. */
  hint: string;
  /** "Picked: pump1". */
  picked: (key: string) => string;
  /** A diagram with no symbols. */
  empty: string;
}

const DEFAULT_MESSAGES: SceneSetupPreview2DMessages = {
  label: 'Diagram preview',
  hint: 'Click a symbol to pick it for the key you are matching.',
  picked: (key) => `Picked: ${key}`,
  empty: 'This diagram has no symbols.',
};

export interface SceneSetupPreview2DProps {
  /** The diagram's document: the scene settings it was stored with (`elements`, `links`, `shapes`, `width`, ...). */
  document: Record<string, unknown>;
  /** The symbol id to outline (null: none). A name no symbol has outlines nothing. */
  selected?: string | null;
  /** A symbol was clicked (or Enter / Space on it): its id. */
  onPick: (key: string) => void;
  messages?: Partial<SceneSetupPreview2DMessages>;
  locale?: string;
  className?: string;
}

const NO_DATA: WidgetViewProps['data'] = {};
const NO_FORMAT: WidgetViewProps['format'] = {};

/** A string as a CSS attribute-selector value (double-quoted): backslash, quote and line breaks escaped. */
export function cssAttrValue(v: string): string {
  return `"${v.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\a ').replace(/\r/g, '\\d ')}"`;
}

/** The document as the preview draws it: no rules, no lockouts. Pure. */
export function previewSettings(document: Record<string, unknown>): Record<string, unknown> {
  const elements = Array.isArray(document.elements)
    ? (document.elements as unknown[]).map((e) => (e && typeof e === 'object' ? { ...(e as Record<string, unknown>), mode: undefined } : e))
    : [];
  return { ...document, elements, rules: [] };
}

export function SceneSetupPreview2D({ document, selected = null, onPick, messages, locale, className }: SceneSetupPreview2DProps) {
  const m = { ...DEFAULT_MESSAGES, ...messages };
  const scope = useId().replace(/[^\w-]/g, '');
  const settings = useMemo(() => previewSettings(document), [document]);
  const ids = useMemo(() => new Set((settings.elements as Array<Record<string, unknown>>).map((e) => (e && typeof e.id === 'string' ? e.id : '')).filter(Boolean)), [settings]);
  const elementActions = useMemo(() => ({
    has: (gesture: ElementGesture, id: string) => gesture === 'click' && ids.has(id),
    run: (_gesture: ElementGesture, id: string) => { onPick(id); },
  }), [ids, onPick]);
  const outlined = selected && ids.has(selected) ? selected : null;

  if (ids.size === 0) return <p role="status" className={cn('p-3 text-sm text-text-secondary', className)}>{m.empty}</p>;
  return (
    <div className={cn('space-y-1', className)} data-scene-preview={scope} data-testid="scene-preview-2d">
      {outlined && (
        <style>{`[data-scene-preview="${scope}"] rect[data-element=${cssAttrValue(outlined)}]{fill:color-mix(in srgb,var(--primary) 22%,transparent);stroke:var(--primary);stroke-width:4}`}</style>
      )}
      <div className="h-64 w-full">
        <ScadaSceneView
          settings={settings} format={NO_FORMAT} data={NO_DATA} locale={locale} title={m.label}
          elementActions={elementActions}
        />
      </div>
      <p role="status" className="text-xs text-text-secondary">{outlined ? m.picked(outlined) : m.hint}</p>
    </div>
  );
}
