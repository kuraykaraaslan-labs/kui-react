/**
 * The shapes the import wizard reads through `ImportAdapter` (next-boilerplate `data_import`: upload → map → dry run → review → apply →
 * undo). The wizard knows nothing about what is imported: a target names its fields, whether it can be undone, which column names it takes
 * as they are (`columnPrefixes`, e.g. `attr:`), and the extra steps after an import (`followUps`, e.g. downloading the new devices'
 * credentials once).
 */

export type ImportFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'uuid' | 'enum' | 'money_minor';

export interface ImportField {
  name: string;
  label: string;
  type: ImportFieldType;
  required?: boolean;
  enumValues?: string[];
  /** The example row of the downloadable template. */
  example?: string;
  group?: string;
}

/** An extra step a target offers after its import was applied. `download_once`: a file the host can hand out one time only. */
export interface ImportFollowUp {
  kind: 'download_once';
  key: string;
  label: string;
  description?: string;
}

export interface ImportTarget {
  key: string;
  label: string;
  fields: ImportField[];
  /** The target can take an applied import back. */
  undoable?: boolean;
  /** Column names starting with one of these are taken as they are (mapped onto themselves). */
  columnPrefixes?: string[];
  followUps?: ImportFollowUp[];
}

export const IMPORT_STRATEGIES = ['CREATE_ONLY', 'UPDATE_ONLY', 'UPSERT', 'SKIP_DUPLICATES'] as const;
export type ImportStrategy = (typeof IMPORT_STRATEGIES)[number];

export type ImportJobStatus =
  | 'PENDING' | 'PARSING' | 'VALIDATING' | 'AWAITING_REVIEW' | 'APPLYING' | 'COMPLETED' | 'FAILED' | 'UNDOING' | 'UNDONE' | 'CANCELLED';

export interface ImportJob {
  importJobId: string;
  name: string;
  targetKey: string;
  fileName?: string | null;
  status: ImportJobStatus;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  warnedRows?: number;
  notUndoableRows?: number;
  /** `DUPLICATE_FILE`: the same file was imported before. */
  warnings?: string[] | null;
  createdAt: string;
  finishedAt?: string | null;
  undoneAt?: string | null;
}

/** A problem the target found in one row, in its own words. */
export interface ImportRowProblem {
  rowNumber: number;
  field?: string | null;
  code: string;
  message: string;
}

export interface ImportDryRunInput {
  targetKey: string;
  fileName: string;
  content: string;
  /** Source column → target field. */
  mapping: Record<string, string>;
  strategy: ImportStrategy;
  delimiter?: string;
  hasHeader: boolean;
}

export interface ImportAdapter {
  targets(signal?: AbortSignal): Promise<ImportTarget[]>;
  /** Uploads the file and checks every row; nothing is written to the target. */
  dryRun(input: ImportDryRunInput): Promise<ImportJob>;
  job(jobId: string, signal?: AbortSignal): Promise<ImportJob>;
  /** The problems of a checked import, by row (a page). */
  problems(jobId: string, q: { page: number; pageSize: number }, signal?: AbortSignal): Promise<{ rows: ImportRowProblem[]; total: number }>;
  apply(jobId: string): Promise<ImportJob>;
  undo(jobId: string): Promise<ImportJob>;
  /** Runs a target's extra step (a `download_once` saves the file in the browser and keeps nothing). */
  followUp(jobId: string, followUp: ImportFollowUp): Promise<void>;
}

/** A refused request: the HTTP status and the server's `details.reason`. */
export class ImportApiError extends Error {
  readonly status: number;
  readonly reason?: string;
  readonly details: Record<string, unknown>;
  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ImportApiError';
    this.status = status;
    this.details = details;
    this.reason = typeof details.reason === 'string' ? details.reason : undefined;
  }
}
