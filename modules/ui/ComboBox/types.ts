// Public types for ComboBox (and shared with MultiSelect).
// Kept dependency-free so server components can import the types.

export type ComboBoxOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

// M1: async search signature used by useAsync hook.
export type SearchFn = (query: string, signal?: AbortSignal) => Promise<ComboBoxOption[]>;

// M1: cursor-style pagination — host owns the cursor in closure.
export type LoadMoreFn = () => Promise<ComboBoxOption[]>;

/** Built-in strings, overridable per instance through `messages` (to translate them). */
export type ComboBoxMessages = {
  /** Input placeholder when no `placeholder` prop is given. */
  placeholder: string;
  /** Shown when nothing matches, unless the `noResultsText` prop is given. */
  noResults: string;
  /** Accessible name of the clear button. */
  clear: string;
  /** Announced while an async search is pending (the skeleton rows carry no text). */
  loading: string;
  /** Shown while `onLoadMore` fetches the next page. */
  loadingMore: string;
};

export const DEFAULT_COMBOBOX_MESSAGES: ComboBoxMessages = {
  placeholder: 'Search or select...',
  noResults: 'No results found.',
  clear: 'Clear selection',
  loading: 'Loading…',
  loadingMore: 'Loading more…',
};

export type ComboBoxProps = {
  id: string;
  label: string;
  options: ComboBoxOption[];
  value?: string;
  onChange?: (value: string) => void;
  // Legacy sync signature still supported (M1 keeps backwards compat).
  // Async signature receives AbortSignal so callers can cancel fetches.
  onSearch?: (query: string, signal?: AbortSignal) => ComboBoxOption[] | Promise<ComboBoxOption[]>;
  onLoadMore?: LoadMoreFn;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  noResultsText?: string;
  className?: string;
  // M1 — debounce window for onSearch (default 300 ms).
  debounceMs?: number;
  // M1 — virtualization threshold (when options.length > this, fixed-height windowing kicks in).
  virtualize?: boolean | number;
  // TODO M3: groupBy?: (opt: ComboBoxOption) => string;
  // TODO M3: renderOption?: (opt: ComboBoxOption) => React.ReactNode;
  // TODO M3: creatable?: boolean | { onCreate: (input: string) => Promise<ComboBoxOption> };
  // TODO M5: freeSolo?: boolean;
  /** Overrides for the built-in English strings (`placeholder` / `noResultsText` props still win). */
  messages?: Partial<ComboBoxMessages>;
};
