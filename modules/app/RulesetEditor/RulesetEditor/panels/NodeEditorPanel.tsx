'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrash, faXmark, faRotateLeft, faBug, faFlask,
} from '@fortawesome/free-solid-svg-icons';
import { Input } from '@/modules/ui/Input';
import { Textarea } from '@/modules/ui/Textarea';
import { lookOf } from '../block-visual';
import { useState, type ComponentType } from 'react';
import { isNote } from '../../catalog/note';
import { nodeName } from '../../graph/names';
import { Markdown } from '../help/markdown';
import { SCRIPT_API_HELP } from '../script/api';
import { fillTemplate, useMessages } from '../messages';
import { portColor } from '../node-meta';
import type { NodeLayout } from '../geometry';
import { ParamForm } from '../../forms/ParamForm';
import type { ParamValues } from '../../catalog/params';
import type { BlockDecl, ParamChoices } from '../../catalog/types';
import type { GraphIssue } from '../../graph/validate';
import type { RuleNode } from '../../types';
import type { NodeActivity } from '../../graph/activity';
import { NodeMessages, type NodeMessage } from './NodeMessages';

/** the tabs of the node panel */
export type NodePanelTab = 'settings' | 'messages' | 'help';

const SOURCE_TITLE = { kui: 'kui ruleset', 'node-red': 'Node-RED', roltek: 'roltek-automation-1' } as const;

/**
 * What a host's own param editor for one block type gets (`RulesetEditorProps.paramEditors`): the params being edited and a way to
 * replace them, in place of the generated form. It edits the same values the form would (a param stored in the script field
 * included), so validation, the issues list and saving work as for the form; the host still validates on its side.
 */
export interface ParamEditorProps {
  /** the params being edited */
  params: ParamValues;
  /** replaces all the params; the panel applies them as the form's own changes are applied */
  onChange: (params: ParamValues) => void;
  /** true in a read-only editor: show the values, change nothing */
  disabled?: boolean;
  /** the block on the canvas, its declaration and the lists a field may offer, for an editor that needs them */
  node: RuleNode;
  decl: BlockDecl;
  choices?: ParamChoices;
}

/** Why a placeholder exists, and what it was (read-only). */
function PlaceholderDetails({ node }: { node: RuleNode }) {
  const m = useMessages();
  const o = node.original;
  const settings = o?.settings === undefined ? '{}' : JSON.stringify(o.settings, null, 2);
  return (
    <div className="space-y-4">
      <div role="note" className="rounded-lg border border-dashed border-warning bg-warning-subtle px-3 py-2.5 text-xs leading-relaxed text-text-primary">
        <p className="font-semibold">{m.panelPlaceholderTitle}</p>
        <p className="mt-1">
          {fillTemplate(m.panelPlaceholderBody, {
            source: { kui: m.panelSourceKui, 'node-red': m.panelSourceNodeRed, roltek: m.panelSourceRoltek }[o?.source ?? 'kui'],
            type: <span className="font-mono font-semibold">{o?.type ?? 'unknown'}</span>,
          })}
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="font-semibold text-text-secondary">{m.panelOriginalType}</dt>
        <dd className="break-all font-mono text-text-primary">{o?.type ?? 'unknown'}</dd>
        <dt className="font-semibold text-text-secondary">{m.panelSource}</dt>
        <dd className="text-text-primary">{SOURCE_TITLE[o?.source ?? 'kui']}</dd>
      </dl>
      <div>
        <p id={`ph-settings-${node.nodeId}`} className="mb-1.5 text-xs font-semibold text-text-secondary">{m.panelOriginalSettings}</p>
        <pre tabIndex={0} aria-labelledby={`ph-settings-${node.nodeId}`}
          className="max-h-64 overflow-auto rounded-lg border border-border bg-surface-base px-3 py-2 font-mono text-[11px] leading-relaxed text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          {settings}
        </pre>
      </div>
    </div>
  );
}

export function NodeEditorPanel({
  node, decl, layout, readOnly, draftLabel, draftDescription, draftValues, choices, issues = [], showRequired = false,
  onLabelChange, onDescriptionChange, onValueChange, onValuesChange, paramEditor: ParamEditor, onClose, onDelete, onResetScript, onDebug,
  nodeMessages, messageBodies = false, activity, activityWindow, onTestMessage, onTestScript, tabs: onlyTabs, bare = false, tab: tabProp, onTabChange,
}: {
  node: RuleNode;
  decl: BlockDecl | undefined;
  layout: NodeLayout;
  readOnly: boolean;
  draftLabel: string;
  /** the optional note about the block (at most 500 characters) */
  draftDescription: string;
  /** the params being edited; a param stored in the script field is among them */
  draftValues: ParamValues;
  choices?: ParamChoices;
  issues?: GraphIssue[];
  /** show "is required" under empty required fields (after a first change) */
  showRequired?: boolean;
  onLabelChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onValueChange: (key: string, value: unknown) => void;
  /** replaces all the params at once (a custom `paramEditor`) */
  onValuesChange?: (values: ParamValues) => void;
  /** the host's own editor for this block type, shown in place of the generated form */
  paramEditor?: ComponentType<ParamEditorProps>;
  onClose: () => void; onDelete: () => void;
  /** put the default script back; null when the block has no script param with a default */
  onResetScript: (() => void) | null;
  /** the "Debug node" button is shown only when this is given */
  onDebug?: () => void;
  /** the recent messages through this block (UI-33): the Messages tab is shown when this is given */
  nodeMessages?: NodeMessage[];
  /** the viewer may see message bodies */
  messageBodies?: boolean;
  /** the block's live counters, at the top of the Messages tab */
  activity?: NodeActivity;
  activityWindow?: string;
  /** "Test with this input" on a received message */
  onTestMessage?: (message: NodeMessage) => void;
  /** the "Test script" button of a block with an automation script (06 §6.7) */
  onTestScript?: () => void;
  /** which tabs to offer (default: all that apply); one tab draws no tab strip */
  tabs?: NodePanelTab[];
  /** drawn inside another side bar: no frame, no width of its own */
  bare?: boolean;
  /** the open tab, when the host keeps it */
  tab?: NodePanelTab;
  onTabChange?: (tab: NodePanelTab) => void;
}) {
  const m = useMessages();
  const [ownTab, setOwnTab] = useState<NodePanelTab>('settings');
  const look = lookOf(decl);
  const placeholder = layout.placeholder;
  const canTab = !placeholder && !isNote(node) && !!decl;
  const available: NodePanelTab[] = canTab
    ? (['settings', 'messages', 'help'] as const).filter((t) => (t !== 'messages' || nodeMessages !== undefined) && (!onlyTabs || onlyTabs.includes(t)))
    : ['settings'];
  const wanted = tabProp ?? ownTab;
  const tab: NodePanelTab = available.includes(wanted) ? wanted : available[0] ?? 'settings';
  const setTab = (t: NodePanelTab) => { setOwnTab(t); onTabChange?.(t); };
  const hasTabs = canTab && available.length > 1;
  const onHelp = canTab && tab === 'help';
  const onMessages = canTab && tab === 'messages';
  const title = placeholder ? m.panelNotAvailable : decl?.title ?? node.type;
  const hasScript = Object.values(decl?.params ?? {}).some((spec) => spec.store === 'script');
  const hasParams = Object.keys(decl?.params ?? {}).length > 0;
  return (
    <aside aria-label={m.panelLabel(nodeName(node, decl))} className={cn('flex flex-col overflow-hidden bg-surface-raised',
      bare ? 'h-full min-h-0 w-full' : 'w-80 shrink-0 border-l border-border max-md:absolute max-md:inset-0 max-md:z-50 max-md:w-auto max-md:border-l-0')}>
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', look.headerBg)}>
          <FontAwesomeIcon icon={look.icon} className={cn('w-3.5 h-3.5', look.iconColor)} aria-hidden="true" />
        </div>
        <p className="flex-1 min-w-0 truncate text-[11px] font-bold uppercase tracking-widest text-text-secondary">{title}</p>
        {onTestScript && (
          <button type="button" onClick={onTestScript} title={m.panelTestScript} aria-label={m.panelTestScript} data-testid="panel-test-script"
            className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-primary-subtle hover:text-primary">
            <FontAwesomeIcon icon={faFlask} className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        {onDebug && (
          <button onClick={onDebug} title={m.panelDebugNode} aria-label={m.panelDebugNode}
            className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-primary-subtle hover:text-primary">
            <FontAwesomeIcon icon={faBug} className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        {!readOnly && (
          <button onClick={onDelete} title={m.panelDeleteNode} aria-label={m.panelDeleteNode}
            className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-error-subtle hover:text-error">
            <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        <button onClick={onClose} aria-label={m.panelClose}
          className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:text-text-primary">
          <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
      {hasTabs && (
        <div role="tablist" aria-label={m.panelTabsLabel} className="flex gap-1 border-b border-border px-3 pt-1.5">
          {available.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} data-testid={`panel-tab-${id}`} onClick={() => setTab(id)}
              className={cn('-mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                tab === id ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary')}>
              {id === 'settings' ? m.panelTabSettings : id === 'messages' ? m.panelTabMessages : m.panelTabHelp}
              {id === 'messages' && (nodeMessages?.length ?? 0) > 0 && (
                <span data-testid="panel-messages-count" className="min-w-[1.1rem] rounded-full bg-primary px-[.3rem] text-center text-[0.625rem] leading-[1.1rem] text-primary-fg">
                  {nodeMessages!.length > 99 ? '99+' : nodeMessages!.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {/* Body */}
      <div role={hasTabs ? 'tabpanel' : undefined} className="flex-1 space-y-5 overflow-y-auto p-4">
        {onHelp && (
          <div data-testid="panel-help">
            <Markdown text={decl?.help ?? ''} />
            {!decl?.help && <p className="text-xs text-text-secondary">{decl?.description || m.panelHelpNone}</p>}
            {Object.values(decl?.params ?? {}).some((s) => s.api === 'automation-script') && (
              <section data-testid="script-api" aria-label={m.scriptApiTitle} className="mt-3 border-t border-border pt-3"><Markdown text={SCRIPT_API_HELP} /></section>
            )}
            {(layout.inputs.length > 0 || layout.outputs.length > 0 || layout.hasError) && (
              <>
                <h4 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{m.panelHelpPorts}</h4>
                <ul className="space-y-0.5 text-xs">
                  {layout.inputs.map((p) => <li key={`in-${p.id}`}><code className="font-mono">{p.id}</code> · {m.panelIn}</li>)}
                  {[...layout.outputs, ...(layout.hasError ? [{ id: 'error', label: 'error' }] : [])].map((p) => <li key={`out-${p.id}`}><code className="font-mono">{p.id}</code> · {m.panelOut}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
        {onMessages && (
          <NodeMessages messages={nodeMessages ?? []} bodies={messageBodies} activity={activity} activityWindow={activityWindow} onTest={onTestMessage} />
        )}
        {!onHelp && !onMessages && <>
        {!isNote(node) && <Input id={`node-${node.nodeId}-label`} label={m.panelNameLabel} placeholder={decl?.title} value={draftLabel} readOnly={readOnly} onChange={(e) => onLabelChange(e.target.value)} />}
        {!placeholder && !isNote(node) && (
          <Textarea id={`node-${node.nodeId}-description`} label={m.panelDescriptionLabel} hint={m.panelDescriptionHint} rows={2} maxLength={500}
            value={draftDescription} readOnly={readOnly} onChange={(e) => onDescriptionChange(e.target.value)} />
        )}
        {!placeholder && decl?.description && <p className="text-xs -mt-2 leading-relaxed text-text-secondary">{decl.description}</p>}
        {issues.length > 0 && (
          <ul aria-label={m.panelProblems} className="space-y-1">
            {issues.map((issue, i) => (
              <li key={`${issue.code}-${i}`} className={cn('rounded-md border px-2.5 py-1.5 text-xs', issue.severity === 'error' ? 'border-error bg-error-subtle text-error' : 'border-warning bg-warning-subtle text-text-primary')}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        {placeholder && <PlaceholderDetails node={node} />}
        {!placeholder && hasScript && <div>
          <p className="mb-2 text-xs font-semibold text-text-secondary">{m.panelAvailableInputs}</p>
          <div className="flex flex-wrap gap-1.5">
            {(['msg','metadata','message_type'] as const).map((v) => (
              <span key={v} className="rounded-md border border-primary/25 bg-primary-subtle px-2 py-0.5 font-mono text-xs font-semibold text-primary">{v}</span>
            ))}
          </div>
        </div>}
        {(layout.inputs.length > 0 || layout.outputs.length > 0 || layout.hasError) && (
          <div className="flex gap-6">
            {layout.inputs.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{m.panelIn}</p>
                {layout.inputs.map((p) => (
                  <div key={p.id} className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full border-2 border-border-strong bg-surface-base" />
                    <span className="font-mono text-[11px] text-text-secondary">{p.id}</span>
                  </div>
                ))}
              </div>
            )}
            {(layout.outputs.length > 0 || layout.hasError) && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{m.panelOut}</p>
                {[...layout.outputs, ...(layout.hasError ? [{ id: 'error', label: 'error' }] : [])].map((p) => (
                  <div key={p.id} className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: portColor(p.id) }} />
                    <span className="font-mono text-[11px]" style={{ color: portColor(p.id) }}>{p.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!placeholder && hasParams && decl && (
          <div>
            {onResetScript && !readOnly && (
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={onResetScript} className="flex items-center gap-1 text-xs text-text-secondary transition-colors hover:text-primary">
                  <FontAwesomeIcon icon={faRotateLeft} className="w-3 h-3" aria-hidden="true" /> {m.panelResetScript}
                </button>
              </div>
            )}
            {ParamEditor && onValuesChange ? (
              <div data-param-editor={node.type}>
                <ParamEditor params={draftValues} onChange={onValuesChange} disabled={readOnly} node={node} decl={decl} choices={choices} />
              </div>
            ) : (
              <ParamForm
                schema={decl.params ?? {}} values={draftValues} onChange={onValueChange} readOnly={readOnly}
                choices={choices} idPrefix={`node-${node.nodeId}`} showRequired={showRequired}
              />
            )}
          </div>
        )}
        </>}
      </div>
      {/* Footer */}
      {!readOnly && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-[11px] text-text-secondary">{m.panelAppliesAsYouType}</p>
          <button onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
            Close
          </button>
        </div>
      )}
    </aside>
  );
}
