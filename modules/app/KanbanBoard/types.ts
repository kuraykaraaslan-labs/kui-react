// Type definitions for KanbanBoard (M1 — Core DnD).
// Future milestones extend these without breaking the M1 surface.

export type ColumnId = string;
export type CardId = string;

export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent';

export type KanbanAssignee = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export type KanbanLabel = {
  id: string;
  label: string;
  /** Optional Tailwind classes for the label chip — defaults handled by Card. */
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
};

export type KanbanCard<T = unknown> = {
  id: CardId;
  columnId: ColumnId;
  title: string;
  description?: string;
  priority?: KanbanPriority;
  labels?: KanbanLabel[];
  assignees?: KanbanAssignee[];
  /** Caller-defined opaque payload (issue link, raw row, etc.). */
  data?: T;
};

export type KanbanColumn<T = unknown> = {
  id: ColumnId;
  title: string;
  /** Work-in-progress limit: the count shows "3/5" and the column tints once it is over. */
  wipLimit?: number;
  /** A CSS colour for the stripe on top of the column. */
  color?: string;
  /** Starts folded (a narrow strip with the title and the count). */
  collapsed?: boolean;
  /** A line under the header: totals, an amount per currency, a hint. */
  summary?: React.ReactNode;
  /** Next to the title (a "Won" / "Lost" badge). */
  badge?: React.ReactNode;
  // Phantom type parameter to keep generics aligned with KanbanCard<T>.
  _t?: T;
};

// TODO M3: Swimlane (group rows by assignee / priority / label).
export type Swimlane = {
  id: string;
  title: string;
  groupBy?: 'assignee' | 'priority' | 'label';
};

// TODO M3: KanbanFilters (assignee, label, priority, due date chips + search).
export type KanbanFilters = {
  assignees?: string[];
  labels?: string[];
  priorities?: KanbanPriority[];
};

export type KanbanMessages = {
  emptyColumn: string;
  addCard: string;
  wipExceeded: (current: number, limit: number) => string;
  moveAnnouncement: (cardTitle: string, fromTitle: string, toTitle: string) => string;
  /** Accessible name of a column; `{title}`. */
  column: string;
  /** Accessible name of a column's card list; `{title}`. */
  columnCards: string;
  /** Accessible count; `{count}`. */
  cardCount: string;
  collapseColumn: string;
  expandColumn: string;
  /** Screen-reader hint on every card. */
  cardKeyboardHint: string;
};

export const DEFAULT_KANBAN_MESSAGES: KanbanMessages = {
  emptyColumn: 'Drop cards here',
  addCard: 'Add card',
  wipExceeded: (current, limit) => `${current} of ${limit}: over the limit`,
  moveAnnouncement: (card, from, to) => `${card} moved from ${from} to ${to}`,
  column: 'Column {title}',
  columnCards: '{title} cards',
  cardCount: '{count} cards',
  collapseColumn: 'Fold column',
  expandColumn: 'Unfold column',
  cardKeyboardHint: 'Alt + arrow keys move the card',
};

// TODO M6: telemetry hook.
export type KanbanTelemetry =
  | { kind: 'card-move'; cardId: CardId; from: ColumnId; to: ColumnId; index: number }
  | { kind: 'card-move-rejected'; cardId: CardId; from: ColumnId; to: ColumnId; reason: string };

export type KanbanBoardProps<T = unknown> = {
  columns: KanbanColumn<T>[];
  cards: KanbanCard<T>[];
  /**
   * Runs after the board has moved the card (optimistically). The move is reverted when it returns `false`, resolves
   * to `false`, throws or rejects; anything else (`undefined`, `true`) keeps it. The host may also send new `cards`,
   * which replace the board's copy either way.
   */
  onCardMove?: (
    card: KanbanCard<T>,
    from: ColumnId,
    to: ColumnId,
    index: number,
  ) => Promise<void | boolean> | void | boolean;
  /** Validation hook — return false to block the drop entirely. */
  canMove?: (card: KanbanCard<T>, from: ColumnId, to: ColumnId) => boolean;
  /**
   * `false`: a card only moves between columns (for an API with no order inside a column): dropping it back into its
   * own column does nothing and Alt + Up / Down do not reorder. Default `true`.
   */
  reorderWithinColumn?: boolean;
  /** Custom card renderer — receives the card; return JSX. */
  renderCard?: (card: KanbanCard<T>) => React.ReactNode;
  /** Click (or Enter on a focused card). */
  onCardClick?: (card: KanbanCard<T>) => void;
  /** Columns fold to a strip from their header. Default `true`. */
  collapsible?: boolean;
  /** Translated strings; any left out keep their English default. */
  messages?: Partial<KanbanMessages>;
  /** Board-level ARIA label for the wrapping region. */
  ariaLabel?: string;
  className?: string;

  // TODO M2: onColumnReorder, onColumnCollapse.
  // TODO M3: swimlanes, filters, search.
  // TODO M4: onCardCreate, onCardUpdate, bulkSelectable.
  // TODO M5: messages.
  // TODO M6: virtualize, onTelemetry.
};

/** Drag payload kept in dataTransfer (JSON-encoded). */
export type KanbanDragData = {
  cardId: CardId;
  fromColumnId: ColumnId;
};

/** Internal: which slot inside a column the pointer is hovering. */
export type DropTarget = {
  columnId: ColumnId;
  /** Insert index (0-based) within the destination column's card list. */
  index: number;
};
