/*
 * Every text of the import wizard, in English. A host passes translations as `ImportWizardMessagesInput` (a group may be partial) or builds
 * the whole set from its dictionary with `importWizardMessagesFrom`. `{name}` placeholders are filled by the wizard.
 */

export const IMPORT_WIZARD_MESSAGES = {
  common: {
    close: 'Close',
    cancel: 'Cancel',
    back: 'Back',
    next: 'Next',
    loading: 'Loading…',
    none: '—',
    unknownError: 'Something went wrong: {message}',
    retry: 'Try again',
  },
  steps: {
    file: 'File',
    columns: 'Columns',
    check: 'Check',
    result: 'Result',
  },
  file: {
    intro: 'Bring records in from a CSV file. Nothing is written until you have seen what would happen.',
    target: 'What to import',
    targetPlaceholder: 'Pick what the file holds',
    noTargets: 'Nothing can be imported in this account.',
    file: 'CSV file',
    fileHint: 'Comma, semicolon or tab separated, saved as UTF-8. The first line holds the column names.',
    hasHeader: 'The first line holds the column names',
    template: 'Download a template',
    templateHint: 'A file with every column this import takes and one example row.',
    columnsTitle: 'Columns this import takes',
    required: 'required',
    optional: 'optional',
    prefixes: 'Columns starting with {prefixes} are taken as they are.',
    empty: 'The file has no rows.',
    tooLarge: 'The file is too large: up to {mb} MB.',
    rows: '{n} rows found.',
  },
  columns: {
    intro: 'Tell which column of your file goes into which field. Columns with matching names are already filled in.',
    field: 'Field',
    column: 'Column in your file',
    leaveOut: 'Leave empty',
    asIs: 'Taken as it is',
    extra: 'Columns of your file not used: {columns}',
    missing: 'Pick a column for every required field: {fields}.',
    strategy: 'When a record already exists',
    strategies: {
      CREATE_ONLY: 'Only add new records; report the existing ones',
      UPDATE_ONLY: 'Only update existing records',
      UPSERT: 'Add new records and update existing ones',
      SKIP_DUPLICATES: 'Add new records and skip the existing ones',
    },
    preview: 'First rows as they will be read',
    previewCaption: 'The first rows of the file, mapped onto the fields',
    check: 'Check the file',
    checking: 'Checking every row…',
  },
  check: {
    intro: 'Every row was checked. Nothing has been written yet.',
    total: 'Rows in the file',
    ready: 'Ready to import',
    skipped: 'Will be skipped',
    failed: 'Have a problem',
    duplicate: 'This exact file was imported before. Importing it again is safe only if that is what you mean.',
    problems: 'Rows with a problem',
    problemsCaption: 'The rows that will not be imported and why',
    row: 'Row',
    field: 'Field',
    problem: 'Problem',
    noProblems: 'No row has a problem.',
    failedNote: 'Rows with a problem are left out; the others can be imported. Fix the file and check it again to bring them in too.',
    nothing: 'No row can be imported. Fix the file and check it again.',
    import: 'Import {n} rows',
    another: 'Pick another file',
    confirmTitle: 'Import {n} rows?',
    confirmMessage: 'The rows are written now. {undo}',
    confirmUndo: 'You can undo this import afterwards.',
    confirmNoUndo: 'This import cannot be undone.',
    importing: 'Importing…',
  },
  result: {
    done: 'The import is finished.',
    failed: 'The import stopped part way. The rows written before the stop can be undone.',
    undone: 'This import was undone.',
    created: 'Added',
    updated: 'Updated',
    skipped: 'Skipped',
    failedRows: 'Not imported',
    notUndoable: '{n} rows could not be put back.',
    undo: 'Undo this import',
    undoTitle: 'Undo this import?',
    undoMessage: 'Records it added are removed and records it changed are put back as they were. A record changed since then may not be put back.',
    undoing: 'Undoing…',
    nextSteps: 'One more step',
    followUpDone: 'Done. This cannot be repeated.',
    start: 'Start another import',
  },
  status: {
    PENDING: 'Waiting',
    PARSING: 'Reading',
    VALIDATING: 'Checking',
    AWAITING_REVIEW: 'Checked, not imported',
    APPLYING: 'Importing',
    COMPLETED: 'Imported',
    FAILED: 'Stopped',
    UNDOING: 'Undoing',
    UNDONE: 'Undone',
    CANCELLED: 'Cancelled',
  },
  errors: {
    not_reviewable: 'This import cannot be imported from where it is.',
    already_applied: 'This import was already imported.',
  },
};

export type ImportWizardMessages = typeof IMPORT_WIZARD_MESSAGES;
type Deep<T> = { [K in keyof T]?: T[K] extends string ? string : Deep<T[K]> };
export type ImportWizardMessagesInput = Deep<ImportWizardMessages>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function merge<T>(base: T, over: unknown): T {
  if (!isObj(over)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  }
  return out as T;
}

export function mergeImportWizardMessages(...inputs: Array<ImportWizardMessagesInput | undefined>): ImportWizardMessages {
  return inputs.reduce<ImportWizardMessages>((acc, i) => merge(acc, i), IMPORT_WIZARD_MESSAGES);
}

/** Every text as `group.key` with its English: a host's dictionary walk. */
export function flattenImportWizardMessages(m: ImportWizardMessages = IMPORT_WIZARD_MESSAGES): Record<string, string> {
  const out: Record<string, string> = {};
  const go = (v: unknown, prefix: string) => {
    if (typeof v === 'string') { out[prefix] = v; return; }
    if (isObj(v)) for (const [k, x] of Object.entries(v)) go(x, prefix ? `${prefix}.${k}` : k);
  };
  go(m, '');
  return out;
}

/** The whole set from a host's dictionary: `importWizardMessagesFrom((key, en) => t(\`data_import.wizard.${key}\`, en))`. */
export function importWizardMessagesFrom(translate: (key: string, english: string) => string): ImportWizardMessages {
  const go = (v: unknown, prefix: string): unknown => {
    if (typeof v === 'string') return translate(prefix, v);
    if (!isObj(v)) return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = go(x, prefix ? `${prefix}.${k}` : k);
    return out;
  };
  return go(IMPORT_WIZARD_MESSAGES, '') as ImportWizardMessages;
}

export function fillText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
