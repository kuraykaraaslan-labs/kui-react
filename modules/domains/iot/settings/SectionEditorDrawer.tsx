'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { fill } from '../format';
import type { DeviceSettings, SettingClass, SettingsDryRun, SettingsHistoryEntry, SettingsManifestSection, SettingsSection } from '../types/settings';
import type { SettingsMessages, SettingsMessagesInput } from './messages';
import { isSettingsApiError, type DeviceSettingsAdapter } from './settings-adapter';
import { issueMessages, pathLabel, SettingsForm } from './SettingsForm';
import { leafText, SettingsDiffTable } from './SettingsDiffTable';
import { SettingsHistoryTable } from './SettingsHistoryTable';
import { SettingsStateBadge } from './SettingsStateBadge';
import { sectionWarnings, type PresetContext } from './settings-presets';
import { annotationsOf, localized, prepareForEdit, prepareForSave, reportedAsValues, sameValues, validateValues } from './settings-schema';
import { useSettingsText } from './SettingsText';

/** A refused request in words: the server's reason, else its message. */
export function errorText(m: SettingsMessages, e: unknown): string {
  if (isSettingsApiError(e)) return (e.reason && (m.errors as Record<string, string>)[e.reason]) || fill(m.common.unknownError, { message: e.message });
  return fill(m.common.unknownError, { message: e instanceof Error ? e.message : String(e) });
}

/** What saving does to the device, from the section's annotations: what restarts, and whether it can cut the device off. */
export function impactLines(m: SettingsMessages, section: SettingsManifestSection | undefined): string[] {
  const a = annotationsOf(section?.schema);
  const out: string[] = [];
  const r = a.restarts;
  if (r === 'network') out.push(m.editor.impactNetwork);
  else if (r === 'reboot') out.push(m.editor.impactReboot);
  else if (typeof r === 'string' && r.startsWith('service:')) out.push(fill(m.editor.impactRestarts, { what: fill(m.editor.impactService, { name: r.slice('service:'.length) }) }));
  if (a.connectivity) out.push(fill(m.editor.impactConnectivity, { seconds: a.confirmS ?? 120 }));
  return out;
}

export interface SectionEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  adapter: DeviceSettingsAdapter;
  deviceId: string;
  /** The device's settings as last read (the section, the others for the editors' pickers, writable, the viewer's classes). */
  settings: DeviceSettings;
  section: SettingsSection;
  manifest: SettingsManifestSection;
  /** Read the device's settings again (after a save, a conflict, a send again). */
  onReload: () => void;
  messages?: SettingsMessagesInput;
  locale?: string;
}

type Pending = { kind: 'write'; values: Record<string, unknown>; dry: SettingsDryRun; warnings: string[] } | { kind: 'reapply'; dangerous: boolean };

/**
 * SectionEditorDrawer — one settings section of a device, in a drawer (no tabs inside the device tab): where it stands, the notices that
 * need the person (on its way, being tried, undone or refused with "Send again", changed on the device with the differences and "Send ours
 * again" / "Keep the device's", a firmware update to check with what it could not carry over), the editor (generic, or the firewall, Wi-Fi
 * and LTE hints), what saving restarts or may cut, and "History" in place of the editor. Mount it per section (`key`): it starts from
 * the section it is given. Saving checks on the client, then asks the server
 * for a dry run and shows what changes in the one ConfirmDialog; a change that can cut the device off asks for the section's name typed.
 */
export function SectionEditorDrawer({ open, onClose, adapter, deviceId, settings, section, manifest, onReload, messages, locale }: SectionEditorDrawerProps) {
  const { m, locale: lang } = useSettingsText(messages, locale);
  const schema = manifest.schema;
  const title = localized(section.title ?? manifest.title, lang) ?? section.section;
  const start = () => prepareForEdit(schema, section.desired ?? section.reported);
  const [values, setValues] = useState<Record<string, unknown>>(start);
  const [initial, setInitial] = useState(values);
  const [formKey, setFormKey] = useState(0);
  const [view, setView] = useState<'edit' | 'history'>('edit');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<string[]>([]);
  const [banner, setBanner] = useState<{ tone: 'danger' | 'tip' | 'info'; text: string; conflict?: boolean } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [review, setReview] = useState<SettingsHistoryEntry | null>(null);
  const dirty = !sameValues(values, initial);
  const classes = useMemo<ReadonlySet<SettingClass> | null>(() => (settings.viewer ? new Set(settings.viewer.classes) : null), [settings.viewer]);
  const canChange = settings.writable && (!classes || classes.size > 0);

  const reset = (doc = start()) => {
    setInitial(doc);
    setValues(doc);
    setErrors({});
    setLines([]);
    setFormKey((k) => k + 1);
  };
  // a newer document from the server (a save, someone else's change) replaces an editor nobody has typed in
  const [seenRev, setSeenRev] = useState(section.desiredRev);
  if (seenRev !== section.desiredRev) {
    setSeenRev(section.desiredRev);
    if (!dirty) reset();
  }

  // a section to check after a firmware update: what the update could not carry over, from the history
  useEffect(() => {
    if (!open || section.state !== 'needs_review') return;
    const ac = new AbortController();
    adapter.history(deviceId, { section: section.section, page: 0, pageSize: 10, dir: 'desc' }, ac.signal)
      .then((r) => setReview(r.data.find((e) => e.kind === 'needs_review') ?? null), () => undefined);
    return () => ac.abort();
  }, [open, adapter, deviceId, section.section, section.state]);

  const presetCtx = useMemo<PresetContext['sections']>(() => Object.fromEntries(settings.sections.map((s) => [s.section, s.desired ?? s.reported])), [settings.sections]);

  const fail = (e: unknown) => {
    if (isSettingsApiError(e) && e.reason === 'invalid_values' && Array.isArray(e.details.issues)) {
      const r = issueMessages(m, section.section, schema, e.details.issues as Array<{ path: string; code: string }>, lang);
      setErrors(r.byPath);
      setLines(r.lines);
      setBanner({ tone: 'danger', text: m.errors.invalid_values });
      return;
    }
    if (isSettingsApiError(e) && (e.reason === 'class_forbidden' || e.reason === 'remote_forbidden') && Array.isArray(e.details.paths)) {
      setLines((e.details.paths as string[]).map((p) => pathLabel(m, section.section, schema, p, lang)));
    }
    setBanner({ tone: 'danger', text: errorText(m, e), conflict: isSettingsApiError(e) && e.reason === 'rev_mismatch' });
  };

  async function save(doc = values) {
    setBanner(null);
    const issues = validateValues(schema, doc);
    const prepared = prepareForSave(schema, doc);
    const extra = [
      ...prepared.moved.map((p) => ({ path: p, text: fill(m.save.movedSecret, { field: pathLabel(m, section.section, schema, p, lang) }) })),
      ...prepared.blank.map((p) => ({ path: p, text: fill(m.save.blankSecret, { field: pathLabel(m, section.section, schema, p, lang) }) })),
    ];
    if (issues.length || extra.length) {
      const r = issueMessages(m, section.section, schema, issues, lang);
      setErrors({ ...r.byPath, ...Object.fromEntries(extra.map((x) => [x.path, x.text])) });
      setLines([...r.lines, ...extra.map((x) => x.text)]);
      setBanner({ tone: 'danger', text: m.editor.invalid });
      return;
    }
    setErrors({});
    setLines([]);
    setBusy(true);
    try {
      const r = await adapter.write(deviceId, section.section, { values: prepared.values, ifMatch: section.desiredRev, dryRun: true });
      if ('dryRun' in r) {
        const warnings = sectionWarnings(section.section, prepared.values, { sections: { ...presetCtx, [section.section]: prepared.values }, m, locale: lang });
        setPending({ kind: 'write', values: prepared.values, dry: r, warnings });
      } else if (r.unchanged) setBanner({ tone: 'info', text: m.save.unchanged });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'write') {
        const r = await adapter.write(deviceId, section.section, { values: pending.values, ifMatch: section.desiredRev, confirm: pending.dry.needsConfirm || undefined });
        setBanner({ tone: 'tip', text: 'unchanged' in r && r.unchanged ? m.save.unchanged : m.save.saved });
        setInitial(values);
      } else {
        await adapter.reapply(deviceId, section.section, { ifMatch: section.desiredRev, confirm: pending.dangerous || undefined });
        setBanner({ tone: 'tip', text: m.save.saved });
      }
      setPending(null);
      onReload();
    } catch (e) {
      setPending(null);
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function reapply() {
    setBanner(null);
    setBusy(true);
    try {
      await adapter.reapply(deviceId, section.section, { ifMatch: section.desiredRev });
      setBanner({ tone: 'tip', text: m.save.saved });
      onReload();
    } catch (e) {
      // a change that can cut the device off asks first, then goes again with the confirmation
      if (isSettingsApiError(e) && e.reason === 'confirm_required') setPending({ kind: 'reapply', dangerous: true });
      else fail(e);
    } finally {
      setBusy(false);
    }
  }

  const reason = section.error?.code ? ((m.errors as Record<string, string>)[section.error.code] ?? section.error.code) : m.common.none;
  const impact = impactLines(m, manifest);
  const needsReview = section.state === 'needs_review';
  const reviewIssues = needsReview && Array.isArray(review?.detail?.issues) ? (review!.detail.issues as Array<{ path: string; code: string }>) : [];
  const showDiff = section.drift || ((section.state === 'reverted' || section.state === 'rejected') && !!section.reported);

  const dry = pending?.kind === 'write' ? pending.dry : null;
  const dangerous = pending?.kind === 'reapply' ? pending.dangerous : !!dry?.needsConfirm;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={fill(m.editor.title, { section: title })}
      closeLabel={m.common.close}
      className="w-full sm:max-w-2xl"
      footer={view === 'edit' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setView('history')}>{m.editor.history}</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{m.common.close}</Button>
            {canChange && (
              <Button onClick={() => void save()} loading={busy} disabled={busy || (!dirty && !needsReview && section.manifestCurrent)}>
                {needsReview ? m.editor.confirmValues : m.common.save}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-start"><Button variant="ghost" onClick={() => setView('edit')}>{m.editor.hideHistory}</Button></div>
      )}
    >
      <div className="space-y-4" data-section={section.section}>
        <div className="flex flex-wrap items-center gap-2"><SettingsStateBadge state={section.state} drift={section.drift} messages={m} /></div>
        {view === 'history' ? (
          <SettingsHistoryTable adapter={adapter} deviceId={deviceId} section={section.section} reasonText={(c) => (m.errors as Record<string, string>)[c] ?? c} messages={m} locale={lang} />
        ) : (
          <>
            {!settings.writable && <Callout variant="warning" title={m.tab.readOnly}>{m.tab.readOnlyHint}</Callout>}
            {settings.writable && classes && classes.size === 0 && <Callout variant="info">{m.tab.viewOnly}</Callout>}
            {section.state === 'pending' && <Callout variant="info">{m.editor.pending}</Callout>}
            {section.state === 'confirming' && <Callout variant="info">{m.editor.confirming}</Callout>}
            {(section.state === 'reverted' || section.state === 'rejected' || section.state === 'expired') && (
              <Callout variant="warning">
                <p>{section.state === 'expired' ? m.editor.expired : fill(section.state === 'reverted' ? m.editor.reverted : m.editor.rejected, { reason })}</p>
                {canChange && <Button className="mt-2" size="sm" variant="outline" onClick={() => void reapply()} disabled={busy}>{m.editor.tryAgain}</Button>}
              </Callout>
            )}
            {section.drift && (
              <Callout variant="warning">
                <p>{m.editor.drift}</p>
                {canChange && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void reapply()} disabled={busy}>{m.editor.sendOurs}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { const doc = reportedAsValues(schema, section.reported); setValues(doc); setFormKey((k) => k + 1); void save(doc); }} disabled={busy}>{m.editor.keepDevice}</Button>
                  </div>
                )}
              </Callout>
            )}
            {showDiff && <SettingsDiffTable section={section.section} schema={schema} desired={section.desired} reported={section.reported} messages={m} locale={lang} />}
            {needsReview && (
              <Callout variant="warning">
                <p>{m.editor.needsReview}</p>
                {reviewIssues.length > 0 && (
                  <>
                    <p className="mt-2 font-medium">{m.editor.needsReviewIssues}</p>
                    <ul className="mt-1 list-disc pl-5">{issueMessages(m, section.section, schema, reviewIssues, lang).lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
                  </>
                )}
              </Callout>
            )}
            {!section.manifestCurrent && <Callout variant="info">{m.editor.oldManifest}</Callout>}
            {banner && (
              <Callout variant={banner.tone} role={banner.tone === 'danger' ? 'alert' : 'status'}>
                <p>{banner.text}</p>
                {lines.length > 0 && <ul className="mt-1 list-disc pl-5">{lines.slice(0, 20).map((l, i) => <li key={i}>{l}</li>)}</ul>}
                {banner.conflict && <Button className="mt-2" size="sm" variant="outline" onClick={() => { onReload(); setBanner(null); }}>{m.common.reload}</Button>}
              </Callout>
            )}
            <SettingsForm
              key={formKey}
              section={section.section}
              schema={schema}
              values={values}
              onChange={setValues}
              reported={section.reported}
              classes={classes}
              readOnly={!canChange}
              errors={errors}
              sections={presetCtx}
              messages={m}
              locale={lang}
            />
            {canChange && impact.length > 0 && (
              <ul className="space-y-1 text-xs text-text-secondary" aria-label={m.save.changes}>{impact.map((l, i) => <li key={i}>{l}</li>)}</ul>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={!!pending}
        tone={dangerous ? 'danger' : 'default'}
        title={dangerous ? m.save.dangerousTitle : m.save.title}
        phrase={dangerous ? title : undefined}
        phraseLabel={dangerous ? fill(m.save.phraseLabel, { phrase: title }) : undefined}
        confirmLabel={dangerous ? m.save.confirmDangerous : m.save.confirm}
        cancelLabel={m.common.cancel}
        busy={busy}
        size="lg"
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmPending()}
        message={(
          <div className="space-y-3 text-sm">
            {dry && (
              <>
                <p className="font-medium">{m.save.changes}</p>
                <ul className="max-h-64 list-disc space-y-0.5 overflow-auto pl-5">
                  {dry.paths.slice(0, 12).map((c) => (
                    <li key={c.path}>
                      <span className="font-medium">{pathLabel(m, section.section, schema, c.path, lang)}</span>
                      {': '}
                      {c.sensitive ? m.save.secret : `${leafText(m, section.section, c.path, c.before)} → ${leafText(m, section.section, c.path, c.after)}`}
                    </li>
                  ))}
                  {(dry.paths.length > 12 || dry.truncated) && <li>{fill(m.save.more, { n: Math.max(0, dry.paths.length - 12) })}</li>}
                </ul>
              </>
            )}
            {pending?.kind === 'write' && pending.warnings.map((w, i) => <p key={i} className="text-error">{fill(m.save.wanWarning, { what: w })}</p>)}
            {impact.map((l, i) => <p key={i} className="text-text-secondary">{l}</p>)}
          </div>
        )}
      />
    </Drawer>
  );
}
