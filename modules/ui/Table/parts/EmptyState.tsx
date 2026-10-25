'use client';
import { Spinner } from '../../Spinner';
import { Button } from '../../Button';

// Loading / Empty / Error single-row state for the table body. The loading message is the visible text, so the
// spinner beside it carries no screen-reader label of its own (the words would be found twice).

export function StateRow({
  state,
  colSpan,
  message,
  onRetry,
  retryLabel,
}: {
  state: 'empty' | 'loading' | 'error';
  colSpan: number;
  message: React.ReactNode;
  /** Error state: adds a retry button. */
  onRetry?: () => void;
  retryLabel?: string;
}) {
  if (state === 'loading') {
    return (
      <tr>
        <td
          colSpan={colSpan}
          className="px-4 py-10 text-center text-sm text-text-secondary"
        >
          <span className="inline-flex items-center gap-2">
            <Spinner size="sm" label={null} />
            {message}
          </span>
        </td>
      </tr>
    );
  }
  if (state === 'error') {
    return (
      <tr>
        <td
          colSpan={colSpan}
          role="alert"
          className="px-4 py-10 text-center text-sm text-error-fg bg-error-subtle"
        >
          <span className="inline-flex flex-col items-center gap-2">
            <span>{message}</span>
            {onRetry && (
              <Button variant="outline" size="xs" onClick={onRetry} data-part="retry">
                {retryLabel ?? 'Retry'}
              </Button>
            )}
          </span>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-sm text-text-secondary"
      >
        {message}
      </td>
    </tr>
  );
}

/** The same states as a block, for the card layout. */
export function StateBlock({
  state,
  message,
  onRetry,
  retryLabel,
}: {
  state: 'empty' | 'loading' | 'error';
  message: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role={state === 'error' ? 'alert' : undefined}
      className={
        state === 'error'
          ? 'rounded-lg border border-border px-4 py-10 text-center text-sm text-error-fg bg-error-subtle'
          : 'rounded-lg border border-border px-4 py-10 text-center text-sm text-text-secondary'
      }
      data-part="state"
    >
      <span className="inline-flex flex-col items-center gap-2">
        {state === 'loading' ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="sm" label={null} />
            {message}
          </span>
        ) : (
          <span>{message}</span>
        )}
        {state === 'error' && onRetry && (
          <Button variant="outline" size="xs" onClick={onRetry} data-part="retry">
            {retryLabel ?? 'Retry'}
          </Button>
        )}
      </span>
    </div>
  );
}
