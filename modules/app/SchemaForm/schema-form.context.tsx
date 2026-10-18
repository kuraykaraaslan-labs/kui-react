'use client';
import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import type { FieldSchema } from './types';
import { DEFAULT_SCHEMA_FORM_MESSAGES, type SchemaFormMessages } from './messages';

/**
 * Props every injected field renderer receives. A host registers one per
 * `FieldSchema.type` it understands (media library, remote select, symbol
 * picker, colour tokens ...). kui-react never learns where the data comes from.
 */
export interface SchemaFieldOverrideProps {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Stable DOM id of the control, so the label can point at it. */
  id: string;
}

export type FieldOverrides = Record<string, ComponentType<SchemaFieldOverrideProps>>;

const OverridesContext = createContext<FieldOverrides | undefined>(undefined);

/** Supplies `fieldOverrides` to every SchemaForm below it (a `fieldOverrides` prop wins). */
export function SchemaFormProvider({
  fieldOverrides,
  children,
}: {
  fieldOverrides: FieldOverrides;
  children: ReactNode;
}) {
  return <OverridesContext.Provider value={fieldOverrides}>{children}</OverridesContext.Provider>;
}

export function useFieldOverrides(): FieldOverrides | undefined {
  return useContext(OverridesContext);
}

const MessagesContext = createContext<SchemaFormMessages>(DEFAULT_SCHEMA_FORM_MESSAGES);

/** The texts of the form's own controls; SchemaForm supplies them from its `messages` prop. */
export const SchemaFormMessagesProvider = MessagesContext.Provider;

export function useSchemaFormMessages(): SchemaFormMessages {
  return useContext(MessagesContext);
}

/**
 * Draws an option's `preview` id (a select with `display: 'cards'`); `null` for an id it does not
 * know. kui-react owns no drawings: WidgetKit supplies its layout thumbnails, a host its own.
 */
export type OptionPreviewRenderer = (id: string) => ReactNode;

const OptionPreviewContext = createContext<OptionPreviewRenderer | undefined>(undefined);

/** SchemaForm supplies it from its `renderOptionPreview` prop. */
export const OptionPreviewProvider = OptionPreviewContext.Provider;

export function useOptionPreview(): OptionPreviewRenderer | undefined {
  return useContext(OptionPreviewContext);
}
