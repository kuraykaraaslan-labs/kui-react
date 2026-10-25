'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import type { KanbanCard, KanbanPriority } from '../types';

type CardProps<T> = {
  card: KanbanCard<T>;
  isDragging: boolean;
  renderCard?: (card: KanbanCard<T>) => React.ReactNode;
  onClick?: (card: KanbanCard<T>) => void;
  /** Alt + arrow keys: move to the neighbouring column or one slot up / down. */
  onKeyMove?: (card: KanbanCard<T>, key: 'left' | 'right' | 'up' | 'down') => void;
  keyboardHint?: string;
  onDragStart: (e: React.DragEvent<HTMLElement>, card: KanbanCard<T>) => void;
  onDragEnd: () => void;
};

const PRIORITY_TONE: Record<KanbanPriority, string> = {
  low: 'bg-info-subtle text-info border-info/30',
  medium: 'bg-primary-subtle text-primary border-primary/30',
  high: 'bg-warning-subtle text-warning border-warning/30',
  urgent: 'bg-error-subtle text-error border-error/30',
};

const LABEL_TONE: Record<NonNullable<KanbanCard['labels']>[number]['tone'] & string, string> = {
  primary: 'bg-primary-subtle text-primary',
  success: 'bg-success-subtle text-success-fg',
  warning: 'bg-warning-subtle text-warning',
  error: 'bg-error-subtle text-error',
  info: 'bg-info-subtle text-info',
  neutral: 'bg-surface-overlay text-text-secondary',
};

export function Card<T>({
  card,
  isDragging,
  renderCard,
  onClick,
  onKeyMove,
  keyboardHint,
  onDragStart,
  onDragEnd,
}: CardProps<T>) {
  const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const;
  return (
    <li
      role="listitem"
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onDragEnd={onDragEnd}
      // aria-grabbed is deprecated but assistive tech still uses it as a hint
      // alongside the live region announcement (M5).
      aria-grabbed={isDragging || undefined}
      data-card-id={card.id}
      aria-description={onKeyMove ? keyboardHint : undefined}
      onClick={onClick ? (e) => {
        if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
        onClick(card);
      } : undefined}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.altKey && e.key in KEYS && onKeyMove) {
          e.preventDefault();
          onKeyMove(card, KEYS[e.key as keyof typeof KEYS]);
        } else if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick(card);
        }
      }}
      className={cn(
        'group select-none cursor-grab active:cursor-grabbing',
        'rounded-md border border-border bg-surface-base shadow-sm',
        'px-3 py-2 transition-opacity',
        'hover:border-border-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        isDragging && 'opacity-50',
      )}
      tabIndex={0}
    >
      {renderCard ? (
        renderCard(card)
      ) : (
        <div className="flex items-start gap-2">
          <FontAwesomeIcon
            icon={faGripVertical}
            aria-hidden="true"
            className="mt-0.5 w-3 h-3 text-text-disabled group-hover:text-text-secondary shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary leading-snug break-words">
              {card.title}
            </p>
            {card.description && (
              <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                {card.description}
              </p>
            )}
            {(card.priority || (card.labels && card.labels.length > 0) ||
              (card.assignees && card.assignees.length > 0)) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {card.priority && (
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                      PRIORITY_TONE[card.priority],
                    )}
                  >
                    {card.priority}
                  </span>
                )}
                {card.labels?.map((l) => (
                  <span
                    key={l.id}
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                      LABEL_TONE[l.tone ?? 'neutral'],
                    )}
                  >
                    {l.label}
                  </span>
                ))}
                {card.assignees && card.assignees.length > 0 && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-text-secondary">
                    {card.assignees.slice(0, 3).map((a) => (
                      <span
                        key={a.id}
                        title={a.name}
                        className={cn(
                          'inline-flex items-center justify-center',
                          'w-5 h-5 rounded-full bg-surface-overlay',
                          'text-[9px] font-medium text-text-primary',
                          'border border-border',
                        )}
                      >
                        {a.name
                          .split(/\s+/)
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    ))}
                    {card.assignees.length > 3 && (
                      <span className="text-text-secondary">+{card.assignees.length - 3}</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
