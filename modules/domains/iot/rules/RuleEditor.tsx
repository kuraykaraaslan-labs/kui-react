'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Callout } from '@/modules/ui/Callout';
import { Select } from '@/modules/ui/Select';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import type { RuleDefinition, RuleProblem, RuleScope, RuleTestResult } from '../types/rules';
import { ActionList, ConditionGroup, TriggerList, type RuleRowsContext } from './RuleRows';
import { actsOnDevices, collectIds, draftProblems, emptyDefinition, emptyTrigger, freshId, problemsAt } from './rule-draft';
import { READY_KEYS, readyLabel, readyRule, type ReadyKey } from './rule-ready';

/**
 * RuleEditor — the body of the card's drawer (docs/concepts/iot-rules 05 §5.1, OD-201): a rule as four blocks of sentences, When (any of
 * these), Only if (all of these, with any/none groups), Then (in this order) and Options, each row a device, a value or a command picked by
 * name. Nothing here shows an id, a key or JSON. Before it asks the server it lists the rows that are plainly unfinished; the server's
 * own problems (a device outside the place, a command the catalog does not have) come back with the row's path and show under that row.
 * A rule that sends commands or changes settings asks for the author's confirmation first (a ConfirmDialog with a tick). Test now runs
 * the draft against the values stored now and shows the answer in words under the buttons.
 */
export type RuleEditorProps = {
  scope: RuleScope;
  /** The rule being edited; absent for a new one. */
  initial?: { name: string; definition: RuleDefinition } | null;
  /** Problems the server found in the last save or test, with the path of each row. */
  problems?: readonly RuleProblem[];
  saving?: boolean;
  testing?: boolean;
  testResult?: RuleTestResult | null;
  /** The server asked for the author's confirmation (409): shown when the dialog opens, even if the draft looks harmless to the editor. */
  serverNeedsConfirmation?: readonly string[] | null;
  /** Other rules of the place, for "Switch another rule" (omit to hide that action). */
  otherRules?: ReadonlyArray<{ ruleId: string; name: string }>;
  onSave: (input: { name: string; definition: RuleDefinition; confirmed: boolean }) => Promise<void>;
  onTest: (input: { name: string; definition: RuleDefinition }) => Promise<void>;
  onCancel: () => void;
  /**
   * Every state of the draft, the first one as it opens: lets a host that closes the editor on its own (Escape, a click beside its drawer) ask
   * before it drops changes (run 3 note 157: Escape lost a new rule without a word).
   */
  onDraftChange?: (draft: { name: string; definition: RuleDefinition }) => void;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

const Block = ({ title, hint, children, id }: { title: string; hint?: string; children: React.ReactNode; id: string }) => (
  <section aria-labelledby={id} className="flex flex-col gap-2">
    <div>
      <h3 id={id} className="text-sm font-semibold text-text-primary">{title}</h3>
      {hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}
    </div>
    {children}
  </section>
);

export function RuleEditor({
  scope, initial, problems = [], saving = false, testing = false, testResult, serverNeedsConfirmation, otherRules, onSave, onTest, onCancel, onDraftChange, locale, messages, className,
}: RuleEditorProps) {
  const { m } = useIotText(messages);
  const [name, setName] = useState(initial?.name ?? '');
  const [def, setDef] = useState<RuleDefinition>(() => (initial ? structuredClone(initial.definition) : emptyDefinition()));
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [readyKey, setReadyKey] = useState('');
  useEffect(() => { onDraftChange?.({ name, definition: def }); }, [name, def, onDraftChange]);


  const own = useMemo(() => draftProblems(name, def, m.rules), [name, def, m.rules]);
  const shown = tried ? [...own, ...problems] : [...problems];
  const taken = useMemo(() => collectIds(def), [def]);
  const ctx: RuleRowsContext = { scope, m: m.rules, problems: shown, locale, otherRules, severity: m.severity };
  const acts = actsOnDevices(def) || (serverNeedsConfirmation?.length ?? 0) > 0;

  const input = { name: name.trim(), definition: def };
  const doSave = async (confirmed: boolean) => {
    setError(undefined);
    try { await onSave({ ...input, confirmed }); setConfirming(false); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const save = () => {
    setTried(true);
    if (own.length) return;
    if (acts) { setConfirming(true); return; }
    void doSave(false);
  };
  const test = () => {
    setTried(true);
    if (own.some((p) => p.path[0] !== 'name')) return;
    void onTest({ name: name.trim() || 'Test', definition: def });
  };

  const addTrigger = () => setDef((d) => ({ ...d, when: [...d.when, emptyTrigger('value', freshId('t', collectIds(d)))] }));

  // a ready rule only starts the draft: the name is kept when the person already typed one, nothing is saved
  const startFrom = (key: string) => {
    if (!key) return;
    const r = readyRule(key as ReadyKey, m.rules);
    setDef(r.definition);
    setName((n) => (n.trim() ? n : r.name));
    setTried(false);
    setReadyKey(key);
  };
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {!initial ? (
        <div>
          <Select
            id="rule-ready" label={m.rules.readyLabel} value={readyKey} hint={m.rules.readyHint} onChange={(e) => startFrom(e.target.value)}
            options={[{ value: '', label: m.rules.readyNone }, ...READY_KEYS.map((k) => ({ value: k, label: readyLabel(m.rules, k) }))]}
          />
        </div>
      ) : null}
      <div>
        <label className="flex flex-col gap-1 text-sm font-medium text-text-primary">
          {m.rules.name}
          <input
            id="rule-name" aria-label={m.rules.name} value={name} maxLength={120} placeholder={m.rules.namePlaceholder} onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-surface-base px-3 py-2 text-sm font-normal"
          />
        </label>
        {tried && problemsAt(shown, ['name'])[0] ? <p role="alert" className="mt-1 text-xs text-error-fg">{m.rules.namePlaceholder}</p> : null}
      </div>

      <Block id="rule-when" title={m.rules.when} hint={m.rules.whenHint}>
        <TriggerList items={def.when} path={['when']} ctx={ctx} onChange={(when) => setDef((d) => ({ ...d, when }))} />
        <Button size="sm" variant="outline" className="self-start" onClick={addTrigger}>{m.rules.addWhen}</Button>
      </Block>

      <Block id="rule-only-if" title={m.rules.onlyIf} hint={m.rules.onlyIfHint}>
        <ConditionGroup root value={def.onlyIf} path={['onlyIf']} ctx={ctx} onChange={(onlyIf) => setDef((d) => ({ ...d, onlyIf }))} />
      </Block>

      <Block id="rule-then" title={m.rules.then} hint={m.rules.thenHint}>
        <ActionList items={def.then} path={['then']} ctx={ctx} takenIds={taken} onChange={(then) => setDef((d) => ({ ...d, then }))} />
      </Block>

      <Block id="rule-options" title={m.rules.options}>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            id="rule-overlap" label={m.rules.overlapLabel} value={def.options.overlap}
            onChange={(e) => setDef((d) => ({ ...d, options: { ...d.options, overlap: e.target.value as RuleDefinition['options']['overlap'], ...(e.target.value === 'ignore' ? { max: undefined } : {}) } }))}
            options={[{ value: 'ignore', label: m.rules.overlapIgnore }, { value: 'queue', label: m.rules.overlapQueue }, { value: 'parallel', label: m.rules.overlapParallel }, { value: 'restart', label: m.rules.overlapRestart }]}
          />
          {def.options.overlap === 'queue' || def.options.overlap === 'parallel' ? (
            <label className="flex flex-col gap-1 text-sm text-text-primary">
              {m.rules.overlapMax}
              <input
                type="number" min={1} max={10} aria-label={m.rules.overlapMax} value={def.options.max ?? ''}
                onChange={(e) => setDef((d) => ({ ...d, options: { ...d.options, max: e.target.value === '' ? undefined : Number(e.target.value) } }))}
                className="w-20 rounded-md border border-border bg-surface-base px-2 py-2 text-sm"
              />
            </label>
          ) : null}
        </div>
        <Checkbox
          id="rule-in-manual" label={m.rules.runInManualLabel} hint={m.rules.runInManualHint} checked={def.options.runInManual === true} disabled={acts}
          onChange={(e) => setDef((d) => ({ ...d, options: { ...d.options, runInManual: e.target.checked ? true : undefined } }))}
        />
      </Block>

      {tried && shown.length ? (
        <Callout variant="warning" title={m.rules.problemsTitle}>
          <ul className="list-disc pl-5 text-sm">{shown.slice(0, 6).map((p, i) => <li key={`${p.path.join('.')}-${i}`}>{p.message}</li>)}</ul>
        </Callout>
      ) : null}
      {error ? <p role="alert" className="text-sm text-error-fg">{error}</p> : null}

      {testResult ? (
        <section aria-label={m.rules.testResult} className="flex flex-col gap-2 rounded-md border border-border bg-surface-sunken p-3" data-test-result>
          <p className={cn('text-sm font-medium', testResult.wouldRun ? 'text-success-fg' : 'text-text-primary')}>{testResult.summary}</p>
          <ul className="text-sm text-text-secondary">
            {testResult.triggers.map((t) => (
              <li key={t.id}>{t.holds === true ? m.rules.testTriggerHolds : t.holds === false ? m.rules.testTriggerNot : m.rules.testTriggerNone}: {t.why}</li>
            ))}
            {testResult.conditions ? <li>{testResult.conditions.ok ? '✓' : '✗'} {testResult.conditions.why}</li> : null}
            {testResult.mode.stops ? <li>{m.rules.testManual}</li> : null}
          </ul>
          {testResult.actions.length ? (
            <div><p className="text-xs font-medium text-text-secondary">{m.rules.testActions}</p><ul className="list-none text-sm text-text-primary">{testResult.actions.map((a, i) => <li key={i} className="whitespace-pre">{a}</li>)}</ul></div>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button onClick={save} loading={saving}>{saving ? m.rules.saving : m.rules.save}</Button>
        <Button variant="outline" onClick={test} loading={testing}>{testing ? m.rules.testing : m.rules.testNow}</Button>
        <Button variant="ghost" onClick={onCancel}>{m.rules.cancel}</Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={m.rules.confirmTitle}
        message={m.rules.confirmBody}
        tone="warning"
        confirmLabel={m.rules.save}
        cancelLabel={m.rules.cancel}
        acknowledgement={m.rules.confirmCheck}
        details={serverNeedsConfirmation?.length ? <ul className="list-disc pl-5 text-sm">{serverNeedsConfirmation.map((r) => <li key={r}>{r}</li>)}</ul> : undefined}
        busy={saving}
        error={error}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void doSave(true)}
      />
    </div>
  );
}
