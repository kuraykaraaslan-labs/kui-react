'use client';
import { useEffect, useRef } from 'react';
import { TourRunner, type DriverFactory } from './runner';
import { DEFAULT_TOUR_LABELS, type TourCloseReason, type TourLabels, type TourStep } from './types';
import './tour.css';

export type { TourStep, TourLabels, TourCloseReason, TourPlacement, TourAlign } from './types';
export { DEFAULT_TOUR_LABELS } from './types';
export { TourRunner, waitForElement } from './runner';

export type TourProps = {
  /** The steps, in order. Each step's target is a CSS selector (`[data-tour="…"]`); a step without one is centred. */
  steps: TourStep[];
  /** The tour runs while true. Set it false (or unmount) to stop it without `onClose`. */
  open: boolean;
  /** Step index to start (or resume) at. */
  startAt?: number;
  /** The reader finished (`completed`) or stopped it (`dismissed`: Close, Escape). */
  onClose: (reason: TourCloseReason, stepIndex: number) => void;
  onStepChange?: (index: number, step: TourStep) => void;
  /** Runs before a step shows and is awaited: navigate to the step's page here; the tour then waits for the target. */
  beforeStep?: (step: TourStep, index: number) => void | Promise<void>;
  labels?: Partial<TourLabels>;
  /** Text direction of the popover; in `rtl` left/right placements and the arrow keys are mirrored. */
  dir?: 'ltr' | 'rtl';
  /** Accessible name of the step dialog. */
  ariaLabel?: string;
};

const loadDriver = (): Promise<DriverFactory> => import('driver.js').then((m) => m.driver);

/**
 * A guided tour over the live page: each step dims the page, cuts out the target element and explains it in a popover
 * (Driver.js draws; the runner owns the steps, the text and the keyboard). The popover's content is plain text, never
 * HTML. Driver.js is loaded only when a tour opens. Renders nothing itself.
 *
 * Keyboard: Next / Previous / Close buttons (focus starts on Next), → and ← on the popover or the bare page (mirrored in RTL;
 * a focused field, list or canvas keeps its own arrows), Escape stops.
 */
export function Tour({
  steps,
  open,
  startAt = 0,
  onClose,
  onStepChange,
  beforeStep,
  labels,
  dir = 'ltr',
  ariaLabel = 'Guided tour',
}: TourProps) {
  const callbacks = useRef({ onClose, onStepChange, beforeStep });
  useEffect(() => {
    callbacks.current = { onClose, onStepChange, beforeStep };
  });

  // A new tour only when its content changes, not on every render of the host.
  const stepsKey = JSON.stringify(steps);
  const labelsKey = JSON.stringify({ ...DEFAULT_TOUR_LABELS, ...labels });

  useEffect(() => {
    if (!open) return;
    const runner = new TourRunner(loadDriver, {
      steps: JSON.parse(stepsKey) as TourStep[],
      labels: JSON.parse(labelsKey) as TourLabels,
      dir,
      ariaLabel,
      beforeStep: (step, index) => callbacks.current.beforeStep?.(step, index),
      onStepChange: (index, step) => callbacks.current.onStepChange?.(index, step),
      onClose: (reason, index) => callbacks.current.onClose(reason, index),
    });
    void runner.start(startAt);
    return () => runner.dispose();
  }, [open, stepsKey, labelsKey, startAt, dir, ariaLabel]);

  return null;
}
