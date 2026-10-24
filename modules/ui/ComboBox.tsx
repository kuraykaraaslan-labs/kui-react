'use client';
// Re-export shim — keeps `@/modules/ui/ComboBox` import path working.
// New code: import from `@/modules/ui/ComboBox/index` (or the bare folder).
export { ComboBox, DEFAULT_COMBOBOX_MESSAGES } from './ComboBox/index';
export type { ComboBoxMessages, ComboBoxOption, ComboBoxProps } from './ComboBox/index';
