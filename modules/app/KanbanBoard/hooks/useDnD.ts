'use client';
import { useCallback, useRef, useState } from 'react';
import type {
  CardId,
  ColumnId,
  DropTarget,
  KanbanCard,
  KanbanDragData,
} from '../types';

const MIME = 'application/x-kanban-card';

export type UseDnDOptions<T> = {
  cards: KanbanCard<T>[];
  onCardMove?: (
    card: KanbanCard<T>,
    from: ColumnId,
    to: ColumnId,
    index: number,
  ) => Promise<void> | void;
  canMove?: (card: KanbanCard<T>, from: ColumnId, to: ColumnId) => boolean;
};

export function useDnD<T>({ cards, onCardMove, canMove }: UseDnDOptions<T>) {
  // Optimistic local override — when set, overrides the prop-derived list.
  const [localCards, setLocalCards] = useState<KanbanCard<T>[] | null>(null);
  const [draggingId, setDraggingId] = useState<CardId | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Pre-move snapshot for rollback when onCardMove rejects.
  const snapshotRef = useRef<KanbanCard<T>[] | null>(null);

  // New cards from the host (a refetch, a socket update) replace the optimistic copy.
  const [seenCards, setSeenCards] = useState(cards);
  if (seenCards !== cards) {
    setSeenCards(cards);
    setLocalCards(null);
  }
  const effectiveCards = localCards ?? cards;

  const onCardDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, card: KanbanCard<T>) => {
      const payload: KanbanDragData = {
        cardId: card.id,
        fromColumnId: card.columnId,
      };
      try {
        e.dataTransfer.setData(MIME, JSON.stringify(payload));
        // Fallback for browsers that don't expose custom MIME on dragover.
        e.dataTransfer.setData('text/plain', card.id);
      } catch {
        // setData can throw in some sandboxed contexts — proceed silently.
      }
      e.dataTransfer.effectAllowed = 'move';
      setDraggingId(card.id);
    },
    [],
  );

  const onCardDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const onColumnDragOver = useCallback(
    (
      e: React.DragEvent<HTMLElement>,
      columnId: ColumnId,
      computeIndex: (clientY: number) => number,
    ) => {
      // Must preventDefault to allow drop.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const idx = computeIndex(e.clientY);
      setDropTarget((prev) => {
        if (prev && prev.columnId === columnId && prev.index === idx) return prev;
        return { columnId, index: idx };
      });
    },
    [],
  );

  const onColumnDragLeave = useCallback(
    (e: React.DragEvent<HTMLElement>, columnId: ColumnId) => {
      // Only clear if leaving the column boundary (not entering a child).
      const related = e.relatedTarget as Node | null;
      if (related && e.currentTarget.contains(related)) return;
      setDropTarget((prev) =>
        prev && prev.columnId === columnId ? null : prev,
      );
    },
    [],
  );

  const performMove = useCallback(
    async (
      card: KanbanCard<T>,
      fromColumnId: ColumnId,
      toColumnId: ColumnId,
      destIndex: number,
    ) => {
      if (canMove && !canMove(card, fromColumnId, toColumnId)) return;

      // Snapshot for rollback.
      const snapshot = effectiveCards;
      snapshotRef.current = snapshot;

      // Build optimistic next list: remove card, insert at destIndex within target column.
      const withoutCard = snapshot.filter((c) => c.id !== card.id);
      const targetSlice = withoutCard.filter((c) => c.columnId === toColumnId);
      const clampedIndex = Math.max(0, Math.min(destIndex, targetSlice.length));

      // Index in the full array where we'll insert: position of N-th card in target column.
      let insertAt = withoutCard.length;
      let seen = 0;
      for (let i = 0; i < withoutCard.length; i++) {
        if (withoutCard[i].columnId === toColumnId) {
          if (seen === clampedIndex) {
            insertAt = i;
            break;
          }
          seen++;
        }
      }
      const movedCard: KanbanCard<T> = { ...card, columnId: toColumnId };
      const next = [
        ...withoutCard.slice(0, insertAt),
        movedCard,
        ...withoutCard.slice(insertAt),
      ];
      setLocalCards(next);

      if (!onCardMove) return;
      try {
        await onCardMove(movedCard, fromColumnId, toColumnId, clampedIndex);
        // Success: keep optimistic state; let parent re-sync via props if desired.
      } catch {
        // Revert.
        setLocalCards(snapshotRef.current);
      }
    },
    [canMove, effectiveCards, onCardMove],
  );

  const onColumnDrop = useCallback(
    async (e: React.DragEvent<HTMLElement>, columnId: ColumnId) => {
      e.preventDefault();
      let payload: KanbanDragData | null = null;
      try {
        const raw =
          e.dataTransfer.getData(MIME) || e.dataTransfer.getData('text/plain');
        if (!raw) return;
        // text/plain fallback holds the cardId only.
        if (raw.startsWith('{')) {
          payload = JSON.parse(raw) as KanbanDragData;
        } else {
          const found = effectiveCards.find((c) => c.id === raw);
          if (found) payload = { cardId: found.id, fromColumnId: found.columnId };
        }
      } catch {
        payload = null;
      }
      const finalIndex = dropTarget?.columnId === columnId ? dropTarget.index : 0;
      setDraggingId(null);
      setDropTarget(null);
      if (!payload) return;
      const card = effectiveCards.find((c) => c.id === payload!.cardId);
      if (!card) return;
      await performMove(card, payload.fromColumnId, columnId, finalIndex);
    },
    [dropTarget, effectiveCards, performMove],
  );

  return {
    cards: effectiveCards,
    performMove,
    draggingId,
    dropTarget,
    onCardDragStart,
    onCardDragEnd,
    onColumnDragOver,
    onColumnDragLeave,
    onColumnDrop,
  };
}
