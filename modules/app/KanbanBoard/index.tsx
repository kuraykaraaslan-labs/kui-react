'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { useDnD } from './hooks/useDnD';
import { Column } from './parts/Column';
import { DEFAULT_KANBAN_MESSAGES, type ColumnId, type KanbanBoardProps, type KanbanCard } from './types';

export type {
  CardId,
  ColumnId,
  KanbanAssignee,
  KanbanBoardProps,
  KanbanCard,
  KanbanColumn,
  KanbanFilters,
  KanbanLabel,
  KanbanMessages,
  KanbanPriority,
  KanbanTelemetry,
  Swimlane,
} from './types';
export { DEFAULT_KANBAN_MESSAGES } from './types';

export function KanbanBoard<T = unknown>({
  columns,
  cards,
  onCardMove,
  canMove,
  renderCard,
  onCardClick,
  collapsible = true,
  messages,
  ariaLabel = 'Kanban board',
  className,
}: KanbanBoardProps<T>) {
  const msgs = { ...DEFAULT_KANBAN_MESSAGES, ...messages };
  const {
    cards: effectiveCards,
    performMove,
    draggingId,
    dropTarget,
    onCardDragStart,
    onCardDragEnd,
    onColumnDragOver,
    onColumnDragLeave,
    onColumnDrop,
  } = useDnD<T>({ cards, onCardMove, canMove });

  // Folded columns: each column's `collapsed` is the starting state; the header toggles it.
  const [folded, setFolded] = useState<Record<ColumnId, boolean>>({});
  const isFolded = (id: ColumnId) => folded[id] ?? columns.find((c) => c.id === id)?.collapsed ?? false;

  // Group cards by columnId once per render.
  const cardsByColumn = useMemo(() => {
    const map = new Map<ColumnId, KanbanCard<T>[]>();
    columns.forEach((c) => map.set(c.id, []));
    effectiveCards.forEach((card) => {
      const list = map.get(card.columnId);
      if (list) list.push(card);
    });
    return map;
  }, [columns, effectiveCards]);

  // Keyboard moves (Alt + arrows) go through the same optimistic move as a drop, and are announced.
  const [announcement, setAnnouncement] = useState('');
  function keyMove(card: KanbanCard<T>, key: 'left' | 'right' | 'up' | 'down') {
    const from = card.columnId;
    const colIndex = columns.findIndex((c) => c.id === from);
    const inColumn = cardsByColumn.get(from) ?? [];
    const at = inColumn.findIndex((c) => c.id === card.id);
    let to = from;
    let index = at;
    if (key === 'left' || key === 'right') {
      // The next column that is not folded.
      const step = key === 'left' ? -1 : 1;
      let i = colIndex + step;
      while (columns[i] && isFolded(columns[i].id)) i += step;
      if (!columns[i]) return;
      to = columns[i].id;
      index = cardsByColumn.get(to)?.length ?? 0;
    } else {
      index = key === 'up' ? at - 1 : at + 1;
      if (index < 0 || index >= inColumn.length) return;
    }
    if (canMove && !canMove(card, from, to)) return;
    void performMove(card, from, to, index).then(() => {
      const title = (id: ColumnId) => columns.find((c) => c.id === id)?.title ?? id;
      setAnnouncement(msgs.moveAnnouncement(card.title, title(from), title(to)));
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(card.id)}"]`)?.focus();
      });
    });
  }

  const isDragActive = draggingId !== null;

  return (
    <div
      role="application"
      aria-label={ariaLabel}
      className={cn(
        'kanban-board w-full overflow-x-auto',
        'flex gap-3 items-start p-2',
        className,
      )}
    >
      {columns.map((column) => (
        <Column<T>
          key={column.id}
          column={column}
          cards={cardsByColumn.get(column.id) ?? []}
          draggingId={draggingId}
          dropTarget={dropTarget}
          isDragActive={isDragActive}
          renderCard={renderCard}
          onCardClick={onCardClick}
          onCardKeyMove={keyMove}
          msgs={msgs}
          collapsed={isFolded(column.id)}
          onToggle={collapsible ? () => setFolded((f) => ({ ...f, [column.id]: !isFolded(column.id) })) : undefined}
          onCardDragStart={onCardDragStart}
          onCardDragEnd={onCardDragEnd}
          onColumnDragOver={onColumnDragOver}
          onColumnDragLeave={onColumnDragLeave}
          onColumnDrop={onColumnDrop}
        />
      ))}
      <p className="sr-only" aria-live="polite" data-part="announcer">{announcement}</p>
      {/*
        TODO M2: trailing "+ Add column" button (onColumnAdd).
        TODO M3: swimlane rows wrap columns; filter/search bar above.
        TODO M6: react-window virtualized lists per column.
      */}
    </div>
  );
}
