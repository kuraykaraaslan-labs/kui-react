// modules/ui/CodeEditor/types.ts
//
// CodeEditor — shared public + engine-internal types.
//
// Pixel-identical EJS sibling at modules/ui/CodeEditor/CodeEditor.ejs.
//
// M1 implements: engine flag (default codemirror — falls back to a textarea-
// based engine when CodeMirror 6 is not installed), language prop (data attr
// only in fallback), light/dark/high-contrast theme, readonly, placeholder.
//
// M2 (done in the textarea engine): Tab / Shift+Tab indent (Esc, then Tab
//          leaves the field), Ctrl/Cmd+/ comment toggle, auto-indent on
//          Enter, bracket and quote pairs (wrap, step over, Backspace),
//          find / replace bar (Ctrl/Cmd+F), toolbar (language, find, format,
//          copy, fullscreen), format + formatOnSave through `format`.
//          Not in the textarea engine: multi-cursor, bracket-match highlight.
// M3 (done in the textarea engine): diagnostics (`markers`: gutter icon,
//          tinted line, a list under the field that jumps to the spot),
//          completion (`getSuggestions`, Ctrl+Space or typing, a listbox),
//          hover (`getHover` on the word under the pointer).
//          `extraLibs` stays unused until a real TS engine lands.
// TODO M4: minimap, code folding, vim/emacs keymap, snippet expansion,
//          collaborative cursor, split diff view.
// TODO M5: a11y mode (screen reader), reduced motion.

export type Lang =
  | 'js'
  | 'ts'
  | 'json'
  | 'html'
  | 'css'
  | 'sql'
  | 'python'
  | 'yaml'
  | 'markdown'
  | 'plaintext';

export type CodeEditorEngine = 'codemirror' | 'monaco';

export type CodeEditorTheme = 'light' | 'dark' | 'high-contrast';

/** A diagnostic: 1-based `line` and `column`; `source` and `code` say who found it (shown with the message). */
export type Marker = {
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
  code?: string;
};

/** What a completion provider is asked: the text, the 1-based caret, and the dotted name being typed (`prefix`). */
export type SuggestContext = {
  language: Lang;
  value: string;
  cursor: { line: number; column: number };
  triggerCharacter?: string;
  /** the dotted name that ends at the caret (`msg.pay`); a suggestion replaces it */
  prefix?: string;
};

export type Suggestion = {
  label: string;
  insertText?: string;
  detail?: string;
  documentation?: string;
};

export type HoverContext = {
  language: Lang;
  value: string;
  word: string;
  cursor: { line: number; column: number };
};

export type Hover = {
  contents: string;
};

export type CodeEditorMessages = {
  placeholder: string;
  loading: string;
  readOnlyLabel: string;
  toolbarLabel: string;
  find: string;
  findPlaceholder: string;
  replacePlaceholder: string;
  findPrev: string;
  findNext: string;
  findClose: string;
  replaceOne: string;
  replaceAll: string;
  matchCase: string;
  findNone: string;
  findCount: (current: number, total: number) => string;
  format: string;
  copy: string;
  copied: string;
  fullscreen: string;
  exitFullscreen: string;
  suggestions: string;
  problems: string;
  markerAt: (line: number, column: number | undefined, message: string) => string;
};

export type CodeEditorProps = {
  /** Editor value (controlled). */
  value: string;
  /** Change handler — receives the full updated source. */
  onChange?: (next: string) => void;

  /** Source language. Used for syntax highlighting + auto-indent hints. */
  language?: Lang;

  /** Visual theme. `light` | `dark` | `high-contrast`. */
  theme?: CodeEditorTheme;

  /** Engine implementation. Defaults to `codemirror` (lightweight). */
  engine?: CodeEditorEngine;

  /** Read-only mode — disables editing but keeps selection / copy. */
  readonly?: boolean;

  /** Placeholder text when the value is empty. */
  placeholder?: string;

  /** Visible label rendered above the editor. */
  label?: string;

  /** Helper text under the editor. */
  hint?: string;

  /** Error text — when present switches the border to error tones. */
  error?: string;

  /** Minimum height in px. Default 200. */
  minHeight?: number;

  /** Whether to show the line-number gutter. Default `true`. */
  showLineNumbers?: boolean;

  /** Stable id — used by the label/textarea for `htmlFor` + ARIA. */
  id?: string;

  /** Form name — when set, registers a hidden input synced to `value`. */
  name?: string;

  /** Wrapper class. */
  className?: string;

  // ── M2 ──
  /** The bar above the field: language, find, format (with `format`), copy, fullscreen. */
  showToolbar?: boolean;
  /** Ctrl/Cmd+S runs `format` first (the key still reaches the page, e.g. a host's save). */
  formatOnSave?: boolean;
  /** Tidies the code (the toolbar's Format button, Shift+Alt+F, `formatOnSave`); a throw leaves the code as it was. */
  format?: (value: string) => string | Promise<string>;
  /** The spaces one Tab inserts. Default 2. */
  tabSize?: number;
  // ── M3 ──
  /** Diagnostics: an icon in the gutter, a tinted line, and a list under the field whose rows jump to the spot. */
  markers?: Marker[];
  /** Completion: asked on Ctrl+Space and while a name or a dot is typed; the editor filters by what was typed. */
  getSuggestions?: (ctx: SuggestContext) => Suggestion[] | Promise<Suggestion[]>;
  /** Hover: asked for the dotted name under the pointer after a short rest; null or empty contents show nothing. */
  getHover?: (ctx: HoverContext) => Hover | null | undefined | Promise<Hover | null | undefined>;
  /** Type definitions for a TypeScript engine; unused by the textarea engine. */
  extraLibs?: { path: string; content: string }[];
  // TODO M4:
  showMinimap?: boolean;
  keymap?: 'default' | 'vim' | 'emacs';
  /** The words of the toolbar, find bar and lists (English by default). */
  messages?: Partial<CodeEditorMessages>;
};

/** Shared shape every engine implementation accepts — keeps engines swap-
 * compatible behind the public CodeEditorProps surface. */
export type CodeEditorEngineProps = Required<
  Pick<
    CodeEditorProps,
    | 'value'
    | 'language'
    | 'theme'
    | 'readonly'
    | 'placeholder'
    | 'minHeight'
    | 'showLineNumbers'
  >
> & {
  id?: string;
  name?: string;
  className?: string;
  onChange?: (next: string) => void;
  markers?: Marker[];
  getSuggestions?: CodeEditorProps['getSuggestions'];
  getHover?: CodeEditorProps['getHover'];
  tabSize?: number;
  /** the textarea, for the find bar and the marker list */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Ctrl/Cmd+F in the field */
  onFind?: () => void;
  /** Shift+Alt+F in the field */
  onFormat?: () => void;
  messages: CodeEditorMessages;
  /** ids of the elements that describe the field (hint, problems) */
  describedBy?: string;
  /** the field has errors */
  invalid?: boolean;
};
