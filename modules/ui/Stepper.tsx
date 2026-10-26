'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';

// `warning`: the step ran but needs attention (a check that passed with a caveat). Hollow, so the mark reads in both
// themes: a white or near-white glyph on the amber fill falls below 3:1 in one of them.
export type StepState = 'complete' | 'active' | 'warning' | 'error' | 'pending';

export type StepItem = {
  label: string;
  description?: string;
  state?: StepState;
};

const stateStyles: Record<StepState, { circle: string; text: string; line: string }> = {
  complete: {
    circle: 'bg-success text-text-inverse border-success',
    text:   'text-text-primary',
    line:   'bg-success',
  },
  active: {
    circle: 'bg-primary text-primary-fg border-primary',
    text:   'text-text-primary font-semibold',
    line:   'bg-border',
  },
  warning: {
    circle: 'bg-warning-subtle text-warning-fg border-warning',
    text:   'text-warning-fg',
    line:   'bg-warning',
  },
  error: {
    circle: 'bg-error text-text-inverse border-error',
    text:   'text-error-fg',
    line:   'bg-border',
  },
  pending: {
    circle: 'bg-surface-base text-text-disabled border-border',
    text:   'text-text-disabled',
    line:   'bg-border',
  },
};

function StepIcon({ state, index }: { state: StepState; index: number }) {
  if (state === 'complete') return <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5" aria-hidden="true" />;
  if (state === 'warning')  return <FontAwesomeIcon icon={faExclamation} className="w-3.5 h-3.5" aria-hidden="true" />;
  if (state === 'error')    return <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" aria-hidden="true" />;
  return <span>{index + 1}</span>;
}

export function Stepper({
  steps,
  orientation = 'horizontal',
  className,
}: {
  steps: StepItem[];
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  if (orientation === 'vertical') {
    return (
      <ol className={cn('flex flex-col gap-0', className)}>
        {steps.map((step, i) => {
          const state: StepState = step.state ?? 'pending';
          const s = stateStyles[state];
          const isLast = i === steps.length - 1;

          return (
            <li key={i} className="flex gap-3 items-start">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0',
                    s.circle
                  )}
                  aria-label={`Step ${i + 1}: ${step.label} — ${state}`}
                >
                  <StepIcon state={state} index={i} />
                </div>
                {!isLast && (
                  <div className={cn('w-0.5 flex-1 min-h-[2rem] mt-1', s.line)} aria-hidden="true" />
                )}
              </div>
              <div className={cn('pb-6', isLast && 'pb-0')}>
                <p className={cn('text-sm', s.text)}>{step.label}</p>
                {step.description && (
                  <p className="text-xs text-text-secondary mt-0.5">{step.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className={cn('flex items-center', className)}>
      {steps.map((step, i) => {
        const state: StepState = step.state ?? 'pending';
        const s = stateStyles[state];
        const isLast = i === steps.length - 1;

        return (
          <li key={i} className={cn('flex items-center', !isLast && 'flex-1')}>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  'h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                  s.circle
                )}
                aria-label={`Step ${i + 1}: ${step.label} — ${state}`}
              >
                <StepIcon state={state} index={i} />
              </div>
              <div className="text-center">
                <p className={cn('text-xs whitespace-nowrap', s.text)}>{step.label}</p>
                {step.description && (
                  <p className="text-xs text-text-secondary">{step.description}</p>
                )}
              </div>
            </div>
            {!isLast && (
              <div
                className={cn('h-0.5 flex-1 mx-2 mt-[-1.25rem]', stateStyles[steps[i].state ?? 'pending'].line)}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
