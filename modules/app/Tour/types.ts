// Types of the guided tour (modules/app/Tour). Plain data, so the same step list drives the React component, the
// kui-ejs partial and any host that stores tours as JSON.

export type TourPlacement = 'top' | 'right' | 'bottom' | 'left' | 'center';
export type TourAlign = 'start' | 'center' | 'end';

export type TourStep = {
  /** Unique in the tour; hosts derive translation keys from it. */
  id: string;
  /** CSS selector of the element to highlight (hosts use `[data-tour="…"]`). Omitted: a centred step with no highlight. */
  target?: string;
  /** Plain text, never HTML. */
  title?: string;
  /** Plain text, never HTML. */
  text: string;
  /** Side of the target the popover opens on. `center` (or no target) centres it. Mirrored left/right in RTL. */
  placement?: TourPlacement;
  align?: TourAlign;
  /** `click`: clicking the highlighted element also moves on (the Next button stays). Default `next`. */
  advanceOn?: 'next' | 'click';
  /** Milliseconds to wait for the target to appear (content that loads late). Default 3000; then the step is centred. */
  waitFor?: number;
  /**
   * The page stays usable while this step shows: the overlay only dims, every click goes through. For a step the reader
   * works through in a drawer, a dialog or the canvas the step only points at (drawing lines, picking from a list).
   * Default false: only the highlighted element can be used.
   */
  interactive?: boolean;
};

export type TourCloseReason = 'completed' | 'dismissed';

export type TourLabels = {
  next: string;
  previous: string;
  done: string;
  close: string;
  /** `{current}` and `{total}` are replaced: "{current} of {total}". */
  progress: string;
};

export const DEFAULT_TOUR_LABELS: TourLabels = {
  next: 'Next',
  previous: 'Previous',
  done: 'Done',
  close: 'Close tour',
  progress: '{current} of {total}',
};
