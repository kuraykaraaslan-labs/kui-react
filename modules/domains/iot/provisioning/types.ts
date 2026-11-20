/** A device's claim code: what the QR on its screen carries, or what a person types from it. The host owns its format. */
export interface ClaimCode {
  serial: string;
  secret: string;
}

/** The dry run's "ready to add" answer. */
export interface ClaimPreview {
  serial: string;
  model: string;
  hw?: string | null;
}

/** A device added (or found already added). `notes` are the host's lines in the viewer's language; the first is the headline. */
export interface ClaimDone {
  deviceId: string;
  notes: string[];
}

/** What the host's check (dry run) or claim answered. `busy`: the device is being added by another request right now. */
export type ClaimAnswer =
  | { status: 'ready'; preview: ClaimPreview }
  | { status: 'done'; done: ClaimDone }
  | { status: 'busy' };

/** A refusal in the viewer's words; `retry` offers "Try again" (a claim window that was still closed). */
export interface ClaimProblem {
  text: string;
  retry?: boolean;
}
