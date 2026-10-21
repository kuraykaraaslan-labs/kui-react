'use client';
import { RulesetEditor } from '@/modules/app/RulesetEditor/RulesetEditor';
import { NEUTRAL_CATALOG, NEUTRAL_CHOICES, NEUTRAL_DIFF, NEUTRAL_FLOW } from '@/modules/app/RulesetEditor/demo-neutral';
import type { ShowcaseComponent } from '../showcase.types';

export function buildAppRulesetEditorData(): ShowcaseComponent[] {
  return [
    {
      id: 'ruleset-editor',
      title: 'RulesetEditor',
      category: 'App',
      abbr: 'RE',
      description:
        'A visual flow editor for the blocks of any catalog: typed blocks with params (each block gets a form from its schema), connections, groups, subflows, undo, search, a shortcuts sheet, comments and a help tab per block. It is not tied to a domain: this entry uses a business catalog (a schedule, a webhook in, a comparison, a notification, a webhook out); the IoT demos use device blocks.',
      filePath: 'modules/app/RulesetEditor/RulesetEditor/index.tsx',
      sourceCode: `'use client';
// The blocks come from a catalog (data); a block's form is built from its params. Right-click for the menu,
// Ctrl+F finds a block, ? lists the shortcuts, Alt+N adds a comment.
import { RulesetEditor, catalogFromBlocks } from '@/modules/app/RulesetEditor';

const catalog = catalogFromBlocks([[
  { type: 'trigger.schedule', title: 'Schedule', params: { time: { type: 'time', default: '08:00' } } },
  { type: 'action.notify', title: 'Send a notification', outputs: [], params: { to: { type: 'source', source: 'teams', required: true } } },
]]);

<RulesetEditor
  catalog={catalog}
  choices={{ teams: [{ value: 'finance', label: 'Finance team' }] }}
  initialNodes={nodes}
  initialEdges={edges}
  onChange={(graph) => save(graph)}
  messages={{ /* the words of the editor, to translate it */ }}
/>`,
      since: '2026-10',
      status: 'beta',
      whenToUse: 'A user builds "when X happens, do Y" flows from a set of blocks your product defines.',
      whenNotToUse: 'A fixed form or a linear wizard: use SchemaForm or OnboardingWizard.',
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['application', 'tablist', 'dialog'],
        keyboardInteractions: [
          { keys: 'Ctrl+Z / Ctrl+Y', action: 'Undo and redo' },
          { keys: 'Ctrl+F', action: 'Find a block by name, type, description or id' },
          { keys: 'Ctrl+D', action: 'Duplicate the selection' },
          { keys: 'Alt+N', action: 'Add a comment' },
          { keys: '?', action: 'List the keyboard shortcuts' },
        ],
      },
      variants: [
        {
          title: 'A business flow (no devices)',
          layout: 'stack' as const,
          preview: (
            <div className="h-[26rem] w-full overflow-hidden rounded-xl border border-border">
              <RulesetEditor
                catalog={NEUTRAL_CATALOG}
                choices={NEUTRAL_CHOICES}
                initialNodes={NEUTRAL_FLOW.nodes}
                initialEdges={NEUTRAL_FLOW.edges}
                chainName="Overdue invoices"
              />
            </div>
          ),
          code: `<RulesetEditor
  catalog={catalog}            // schedule, webhook in, compare, notification, webhook out
  choices={{ teams: [...] }}   // lists for source fields
  initialNodes={nodes}
  initialEdges={edges}
/>`,
        },
        {
          title: 'Read only',
          layout: 'stack' as const,
          preview: (
            <div className="h-72 w-full overflow-hidden rounded-xl border border-border">
              <RulesetEditor
                readOnly
                catalog={NEUTRAL_CATALOG}
                choices={NEUTRAL_CHOICES}
                initialNodes={NEUTRAL_FLOW.nodes}
                initialEdges={NEUTRAL_FLOW.edges}
                chainName="Overdue invoices"
              />
            </div>
          ),
          code: `<RulesetEditor readOnly catalog={catalog} initialNodes={nodes} initialEdges={edges} />`,
        },
        {
          title: 'In another language',
          layout: 'stack' as const,
          preview: (
            <div className="h-72 w-full overflow-hidden rounded-xl border border-border">
              <RulesetEditor
                catalog={NEUTRAL_CATALOG}
                choices={NEUTRAL_CHOICES}
                initialNodes={NEUTRAL_FLOW.nodes}
                initialEdges={NEUTRAL_FLOW.edges}
                chainName="Überfällige Rechnungen"
                messages={{ paletteTitle: 'Blocktypen', paletteSearchPlaceholder: 'Suchen…', toolUndo: 'Rückgängig', toolRedo: 'Wiederholen', toolFit: 'An Fenster anpassen', menuUndo: 'Rückgängig', menuRedo: 'Wiederholen', menuPaste: 'Einfügen', menuSelectAll: 'Alles auswählen' }}
              />
            </div>
          ),
          code: `<RulesetEditor
  catalog={catalog}
  messages={{ paletteTitle: 'Blocktypen', toolUndo: 'Rückgängig', menuPaste: 'Einfügen' /* … */ }}
/>
// Any part of the bundle can be given; the rest stays English. See EditorMessages.`,
        },
        {
          title: 'Version compare',
          layout: 'stack' as const,
          preview: (
            <div className="h-80 w-full overflow-hidden rounded-xl border border-border">
              <RulesetEditor
                readOnly
                catalog={NEUTRAL_CATALOG}
                choices={NEUTRAL_CHOICES}
                initialNodes={NEUTRAL_DIFF.nodes}
                initialEdges={NEUTRAL_DIFF.edges}
                diffTint={NEUTRAL_DIFF.tint}
                chainName="Overdue invoices"
              />
            </div>
          ),
          code: `import { diffView } from '@/modules/app/RulesetEditor';

// both versions in one graph: what was removed comes back at its old place
const view = diffView(deployedGraph, draftGraph);
<RulesetEditor readOnly catalog={catalog} initialNodes={view.nodes} initialEdges={view.edges} diffTint={view.tint} />
// view.diff is the change list per block and field (diffFlows, the router's flowlib diff)`,
        },
      ],
    },
  ];
}
