'use client';
import { useState } from 'react';
import { KanbanBoard, type KanbanCard, type KanbanColumn } from '@/modules/app/KanbanBoard';
import { Badge } from '@/modules/ui/Badge';
import type { ShowcaseComponent } from '../showcase.types';

const COLUMNS_3: KanbanColumn[] = [
  { id: 'todo',  title: 'To Do' },
  { id: 'doing', title: 'In Progress' },
  { id: 'done',  title: 'Done' },
];

const INITIAL_CARDS_3: KanbanCard[] = [
  { id: 'c1', columnId: 'todo',  title: 'Audit dark-mode tokens',     priority: 'medium', labels: [{ id: 'l1', label: 'design',    tone: 'info' }] },
  { id: 'c2', columnId: 'todo',  title: 'Wire i18n for /account',     priority: 'low',    labels: [{ id: 'l2', label: 'i18n',      tone: 'primary' }] },
  { id: 'c3', columnId: 'todo',  title: 'Fix flaky e2e on Firefox',   priority: 'urgent', labels: [{ id: 'l3', label: 'bug',       tone: 'error' }] },
  { id: 'c4', columnId: 'doing', title: 'Refactor Quill toolbar',     priority: 'medium', assignees: [{ id: 'u1', name: 'Jane Doe' }] },
  { id: 'c5', columnId: 'doing', title: 'Document KanbanBoard API',                       assignees: [{ id: 'u2', name: 'John Smith' }, { id: 'u3', name: 'Ada Lovelace' }] },
  { id: 'c6', columnId: 'done',  title: 'Ship release notes',         priority: 'high',   labels: [{ id: 'l4', label: 'docs',      tone: 'success' }] },
];

function BasicDemo() {
  const [cards, setCards] = useState<KanbanCard[]>(INITIAL_CARDS_3);
  return (
    <div className="w-full">
      <KanbanBoard
        columns={COLUMNS_3}
        cards={cards}
        ariaLabel="Engineering board"
        onCardMove={(card, _from, to) => {
          setCards((prev) =>
            prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)),
          );
        }}
      />
    </div>
  );
}

function ValidatedDemo() {
  const [cards, setCards] = useState<KanbanCard[]>(INITIAL_CARDS_3);
  return (
    <div className="w-full">
      <KanbanBoard
        columns={COLUMNS_3}
        cards={cards}
        ariaLabel="Validated board (no backwards moves from Done)"
        canMove={(_card, _from, to) => {
          // Prevent moves back out of Done — illustrates the validation hook.
          return _from !== 'done' || to === 'done';
        }}
        onCardMove={(card, _from, to) => {
          setCards((prev) =>
            prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)),
          );
        }}
      />
    </div>
  );
}

function AsyncRevertDemo() {
  const [cards, setCards] = useState<KanbanCard[]>(INITIAL_CARDS_3);
  return (
    <div className="w-full">
      <KanbanBoard
        columns={COLUMNS_3}
        cards={cards}
        ariaLabel="Server-validated board — moves into 'Done' get rejected"
        onCardMove={async (card, _from, to) => {
          // Simulate a server roundtrip that rejects any move into Done.
          await new Promise((r) => setTimeout(r, 350));
          if (to === 'done') throw new Error('Server rejected move into Done');
          setCards((prev) =>
            prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)),
          );
        }}
      />
    </div>
  );
}

/** Phase 11.16: an API with stages but no order inside a stage, and a refusal by returning false. */
function StagesOnlyDemo() {
  const [cards, setCards] = useState<KanbanCard[]>(INITIAL_CARDS_3);
  return (
    <div className="w-full">
      <KanbanBoard
        columns={COLUMNS_3}
        cards={cards}
        ariaLabel="Stages only: cards move between columns; a move back to To Do is refused"
        reorderWithinColumn={false}
        onCardMove={(card, _from, to) => {
          if (to === 'todo') return false; // refused: the card goes back
          setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)));
        }}
      />
    </div>
  );
}

/** Phase 11.14: a sales pipeline — column totals, won/lost badges, a WIP limit, a folded column, keyboard moves. */
function PipelineDemo() {
  const columns: KanbanColumn[] = [
    { id: 'lead', title: 'Lead', summary: '$18,400 · 3 deals', color: '#2457c5' },
    { id: 'proposal', title: 'Proposal', summary: '$42,000 · 2 deals', wipLimit: 2 },
    { id: 'won', title: 'Won', badge: <Badge variant="success" size="sm">Won</Badge>, summary: '$9,900' },
    { id: 'lost', title: 'Lost', badge: <Badge variant="error" size="sm">Lost</Badge>, collapsed: true },
  ];
  const [cards, setCards] = useState<KanbanCard[]>([
    { id: 'p1', columnId: 'lead', title: 'Northwind renewal', description: '$8,000' },
    { id: 'p2', columnId: 'lead', title: 'Contoso pilot', description: '$6,400' },
    { id: 'p3', columnId: 'lead', title: 'Fabrikam add-on', description: '$4,000' },
    { id: 'p4', columnId: 'proposal', title: 'Adatum rollout', description: '$30,000' },
    { id: 'p5', columnId: 'proposal', title: 'Tailspin support', description: '$12,000' },
    { id: 'p6', columnId: 'won', title: 'Wingtip licence', description: '$9,900' },
    { id: 'p7', columnId: 'lost', title: 'Litware trial', description: '$2,000' },
  ]);
  const [opened, setOpened] = useState('Focus a card: Alt + arrows move it, Enter opens it');
  return (
    <div className="w-full space-y-2">
      <KanbanBoard
        ariaLabel="Sales pipeline"
        columns={columns}
        cards={cards}
        onCardClick={(c) => setOpened(`Opened ${c.title}`)}
        onCardMove={(card, _from, to) => setCards((all) => all.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)))}
      />
      <p className="text-xs text-text-secondary" aria-live="polite">{opened}</p>
    </div>
  );
}

export function buildAppKanbanBoardData(): ShowcaseComponent[] {
  return [
    {
      id: 'kanban-board',
      title: 'KanbanBoard',
      category: 'App',
      abbr: 'KB',
      description:
        'Trello / Linear-style kanban board. M1 ships HTML5-native drag and drop between columns with an inline drop-position indicator (thin line between cards) and full optimistic-UI rewind on rejected onCardMove. Use the canMove hook to gate transitions client-side, or return false (or a promise of false) or throw from onCardMove to revert; `reorderWithinColumn={false}` limits moves to between columns. Future milestones: column reorder + collapse + WIP limits (M2), swimlanes + filters + search (M3), inline edit + bulk select + card detail panel (M4), keyboard nav + ARIA announcements (M5), virtualization + auto-archive + dependencies (M6). Pixel-identical EJS sibling at modules/app/KanbanBoard/KanbanBoard.ejs.',
      filePath: 'modules/app/KanbanBoard/index.tsx',
      sourceCode: `import { useState } from 'react';
import { KanbanBoard, type KanbanCard, type KanbanColumn } from '@/modules/app/KanbanBoard';

const columns: KanbanColumn[] = [
  { id: 'todo',  title: 'To Do' },
  { id: 'doing', title: 'In Progress' },
  { id: 'done',  title: 'Done' },
];

const initialCards: KanbanCard[] = [
  { id: 'c1', columnId: 'todo',  title: 'Audit dark-mode tokens', priority: 'medium' },
  { id: 'c2', columnId: 'doing', title: 'Refactor Quill toolbar', assignees: [{ id: 'u1', name: 'Jane Doe' }] },
];

function Board() {
  const [cards, setCards] = useState(initialCards);
  return (
    <KanbanBoard
      columns={columns}
      cards={cards}
      onCardMove={async (card, from, to, index) => {
        // Optimistic: KanbanBoard already moved the card. Persist remotely;
        // throw to revert. \`index\` is the destination insertion index.
        await fetch('/api/cards/' + card.id, {
          method: 'PATCH',
          body: JSON.stringify({ columnId: to, index }),
        }).then((r) => { if (!r.ok) throw new Error(r.statusText); });
        setCards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)),
        );
      }}
      canMove={(card, from, to) => from !== 'done' || to === 'done'}
    />
  );
}`,
      since: '2026-05',
      status: 'beta',
      composes: ['badge', 'avatar'],
      designTokens: [
        '--surface-base',
        '--surface-raised',
        '--surface-overlay',
        '--text-primary',
        '--text-secondary',
        '--text-disabled',
        '--border',
        '--border-strong',
        '--border-focus',
        '--primary',
        '--primary-subtle',
        '--info-subtle',
        '--warning-subtle',
        '--error-subtle',
        '--success-subtle',
      ],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['region', 'list', 'listitem', 'application'],
        keyboardInteractions: [
          { keys: 'Tab',         action: 'Move focus across cards / columns' },
          { keys: 'Drag (mouse)', action: 'Pick up a card and drop on any column slot' },
          // TODO M5: Cmd/Ctrl + Arrow keys for keyboard moves.
        ],
        notes:
          'M1 uses HTML5 drag-and-drop; each column is role="region" with aria-label, the list is role="list", cards are role="listitem". aria-grabbed (deprecated but still announced by some screen readers) flips on the active card; aria-dropeffect="move" is set on all columns while a drag is in flight. Full keyboard parity ships in M5.',
      },
      variants: [
        {
          title: 'Three columns (basic)',
          layout: 'stack' as const,
          preview: <BasicDemo />,
          code: `const columns = [
  { id: 'todo',  title: 'To Do' },
  { id: 'doing', title: 'In Progress' },
  { id: 'done',  title: 'Done' },
];
const [cards, setCards] = useState(initialCards);
<KanbanBoard
  columns={columns}
  cards={cards}
  onCardMove={(card, from, to) =>
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)),
    )
  }
/>`,
        },
        {
          title: 'canMove validation (no exit from Done)',
          layout: 'stack' as const,
          preview: <ValidatedDemo />,
          code: `<KanbanBoard
  columns={columns}
  cards={cards}
  canMove={(card, from, to) => from !== 'done' || to === 'done'}
  onCardMove={persist}
/>`,
        },
        {
          title: 'Pipeline: totals, badges, WIP limit, folding, keyboard',
          layout: 'stack' as const,
          preview: <PipelineDemo />,
          code: `<KanbanBoard
  columns={[
    { id: 'lead', title: 'Lead', summary: '$18,400 · 3 deals', color: '#2457c5' },
    { id: 'proposal', title: 'Proposal', wipLimit: 2 },
    { id: 'won', title: 'Won', badge: <Badge variant="success">Won</Badge> },
    { id: 'lost', title: 'Lost', collapsed: true },
  ]}
  cards={cards}
  onCardClick={open}        // click or Enter
  onCardMove={persist}      // drag, or Alt + arrow keys
  messages={{ column: 'Sütun {title}', emptyColumn: 'Kart yok' }}
/>`,
        },
        {
          title: 'Async onCardMove with rollback',
          layout: 'stack' as const,
          preview: <AsyncRevertDemo />,
          code: `<KanbanBoard
  columns={columns}
  cards={cards}
  onCardMove={async (card, from, to) => {
    const res = await fetch('/api/move', { method: 'POST', body: JSON.stringify({ card, to }) });
    // Throw (or return false) to revert the optimistic update.
    if (!res.ok) throw new Error('Server rejected');
    setCards(next);
  }}
/>`,
        },
        {
          title: 'Stages only, refused by returning false (reorderWithinColumn)',
          layout: 'stack' as const,
          preview: <StagesOnlyDemo />,
          code: `<KanbanBoard
  columns={stages}
  cards={applicants}
  reorderWithinColumn={false}   // the API has no order inside a stage: no drop back, no Alt + Up / Down
  onCardMove={(card, from, to) => {
    if (!allowed(from, to)) return false;   // false, a promise of false, or a throw reverts the card
    return api.setStage(card.id, to);
  }}
/>`,
        },
      ],
    },
  ];
}
