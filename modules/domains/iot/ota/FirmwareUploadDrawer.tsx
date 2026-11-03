'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { FileInput } from '@/modules/ui/FileInput';
import { Input } from '@/modules/ui/Input';
import { Progress } from '@/modules/ui/Progress';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { fill } from '../format';
import type { OtaMessagesInput } from './messages';
import { formatBytes, sha256Hex, type OtaAdapter } from './ota-adapter';
import { otaErrorText, useOtaText } from './OtaText';
import { OTA_PACKAGE_TYPES, OTA_SIGNATURE_SCHEMES, type OtaOption, type OtaPackage, type OtaPackageType, type OtaSignatureScheme } from './types';

const TITLE_RE = /^[A-Za-z0-9._+-]{1,128}$/;
const VERSION_RE = /^[A-Za-z0-9._+~-]{1,64}$/;

/** Digit runs as numbers, other runs as text (NB iot_ota D237): 24.10.0-r1234 after 24.9.1. */
export function compareOtaVersions(a: string, b: string): number {
  const parts = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i];
    const q = y[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const np = /^\d/.test(p);
    const nq = /^\d/.test(q);
    if (np && nq) { const d = Number(p) - Number(q); if (d) return d < 0 ? -1 : 1; continue; }
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

export interface FirmwareUploadDrawerProps {
  open: boolean;
  onClose: () => void;
  adapter: OtaAdapter;
  /** The packages already there (the version check against the same name). */
  existing: readonly OtaPackage[];
  profiles: readonly OtaOption[];
  onUploaded: (pkg: OtaPackage) => void;
  messages?: OtaMessagesInput;
  locale?: string;
}

/**
 * FirmwareUploadDrawer — one firmware image with its details: the file (its SHA-256 worked out in the browser and shown before anything
 * is sent; the server checks it again), name and version (a version already used by the same name is refused before upload), type, the
 * profile it is for, hardware models, the lowest version it updates from, how it is signed (a usign `.sig` file, an ESP32 image with its
 * signature inside, or unsigned) and release notes. The upload shows its progress; a refusal is put into plain words.
 */
export function FirmwareUploadDrawer({ open, onClose, adapter, existing, profiles, onUploaded, messages, locale }: FirmwareUploadDrawerProps) {
  const { m } = useOtaText(messages, locale);
  const [file, setFile] = useState<File | null>(null);
  const [checksum, setChecksum] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [type, setType] = useState<OtaPackageType>('FIRMWARE');
  const [profileId, setProfileId] = useState('');
  const [hardware, setHardware] = useState('');
  const [minFrom, setMinFrom] = useState('');
  const [scheme, setScheme] = useState<OtaSignatureScheme>('usign-ed25519');
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const reset = () => {
    setFile(null); setChecksum(null); setHashing(false); setTitle(''); setVersion(''); setType('FIRMWARE'); setProfileId(''); setHardware(''); setMinFrom('');
    setScheme('usign-ed25519'); setSigFile(null); setNotes(''); setProgress(null); setError(null); setTried(false);
  };
  const close = () => { reset(); onClose(); };
  const pick = (f: File | null) => {
    setFile(f);
    setChecksum(null);
    if (!f) return;
    setHashing(true);
    sha256Hex(f).then((h) => setChecksum(h), () => setChecksum(null)).finally(() => setHashing(false));
  };

  const sameName = useMemo(() => existing.filter((p) => p.title === title.trim()), [existing, title]);
  const newest = useMemo(() => [...sameName].sort((a, b) => compareOtaVersions(b.version, a.version))[0], [sameName]);
  const taken = sameName.some((p) => p.version === version.trim());

  const titleError = tried && !TITLE_RE.test(title.trim()) ? m.upload.invalidName : undefined;
  const versionError = taken ? fill(m.upload.versionTaken, { version: version.trim() }) : tried && !VERSION_RE.test(version.trim()) ? m.upload.invalidVersion : undefined;
  const minFromError = minFrom.trim() && !VERSION_RE.test(minFrom.trim()) ? m.upload.invalidVersion : undefined;
  const busy = progress !== null;

  async function submit() {
    setTried(true);
    setError(null);
    if (!file) { setError(m.upload.needFile); return; }
    if (scheme === 'usign-ed25519' && !sigFile) { setError(m.upload.needSignature); return; }
    if (!TITLE_RE.test(title.trim()) || !VERSION_RE.test(version.trim()) || taken || minFromError || !checksum) return;
    setProgress(0);
    try {
      const signature = scheme === 'usign-ed25519' && sigFile ? (await sigFile.text()).trim() : undefined;
      const pkg = await adapter.packages.upload(file, {
        title: title.trim(), version: version.trim(), type, profileId: profileId || null,
        hardwareModels: hardware.split(',').map((s) => s.trim()).filter(Boolean),
        minFromVersion: minFrom.trim() || null, checksum, signatureScheme: scheme, ...(signature ? { signature } : {}),
        ...(notes.trim() ? { releaseNotes: notes.trim() } : {}),
      }, (f) => setProgress(Math.round(f * 100)));
      reset();
      onUploaded(pkg);
    } catch (e) {
      setError(otaErrorText(m, e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!busy) close(); }}
      title={m.upload.title}
      closeLabel={m.common.close}
      className="w-full max-w-xl"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>{m.common.cancel}</Button>
          <Button variant="primary" onClick={() => void submit()} loading={busy} disabled={busy || hashing}>{m.upload.submit}</Button>
        </div>
      )}
    >
      <div className="space-y-4" data-ota-upload>
        <p className="text-sm text-text-secondary">{m.upload.intro}</p>
        <FileInput id="ota-upload-file" label={m.upload.file} hint={m.upload.fileHint} accept=".bin,.img,.itb,.gz,application/octet-stream" required onFiles={(fs) => pick(fs[0] ?? null)} disabled={busy} />
        {file && (
          <div className="rounded-md border border-border bg-surface-sunken p-3 text-sm" aria-live="polite">
            <p className="font-medium text-text-primary">{file.name} · {formatBytes(file.size)}</p>
            {hashing ? <p className="text-text-secondary">{m.upload.checksumComputing}</p> : checksum && (
              <>
                <p className="mt-1 text-xs text-text-secondary">{m.upload.checksum}</p>
                <p className="break-all font-mono text-xs text-text-primary" data-ota-checksum>{checksum}</p>
                <p className="mt-1 text-xs text-text-secondary">{m.upload.checksumHint}</p>
              </>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="ota-upload-title" label={m.upload.name} hint={m.upload.nameHint} value={title} onChange={(e) => setTitle(e.target.value)} error={titleError} required disabled={busy} maxLength={128} />
          <Input
            id="ota-upload-version" label={m.upload.version} value={version} onChange={(e) => setVersion(e.target.value)} error={versionError} required disabled={busy} maxLength={64}
            hint={newest ? fill(m.upload.versionNewer, { version: newest.version }) : m.upload.versionHint}
          />
          <Select id="ota-upload-type" label={m.upload.type} value={type} onChange={(e) => setType(e.target.value as OtaPackageType)} options={OTA_PACKAGE_TYPES.map((t) => ({ value: t, label: m.type[t] }))} disabled={busy} />
          <Select
            id="ota-upload-profile" label={m.upload.profile} hint={m.upload.profileHint} value={profileId} onChange={(e) => setProfileId(e.target.value)} disabled={busy}
            options={[{ value: '', label: m.common.anyProfile }, ...profiles.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <Input id="ota-upload-hw" label={m.upload.hardware} hint={m.upload.hardwareHint} value={hardware} onChange={(e) => setHardware(e.target.value)} disabled={busy} />
          <Input id="ota-upload-min" label={m.upload.minFrom} hint={m.upload.minFromHint} value={minFrom} onChange={(e) => setMinFrom(e.target.value)} error={minFromError} disabled={busy} maxLength={64} />
        </div>
        <Select
          id="ota-upload-scheme" label={m.upload.scheme} value={scheme} onChange={(e) => setScheme(e.target.value as OtaSignatureScheme)} disabled={busy}
          options={OTA_SIGNATURE_SCHEMES.map((s) => ({ value: s, label: m.scheme[s] }))}
        />
        {scheme === 'usign-ed25519' && <FileInput id="ota-upload-sig" label={m.upload.signature} hint={m.upload.signatureHint} accept=".sig,text/plain" required onFiles={(fs) => setSigFile(fs[0] ?? null)} disabled={busy} />}
        {scheme === 'esp32-secure-boot-v2' && <p className="text-sm text-text-secondary">{m.upload.esp32Hint}</p>}
        {scheme === 'none' && <Callout variant="warning">{m.upload.unsignedHint}</Callout>}
        <Textarea id="ota-upload-notes" label={m.upload.notes} value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={4000} disabled={busy} />
        {progress !== null && (
          <div aria-live="polite">
            <Progress value={progress} showLabel={false} label={progress >= 100 ? m.upload.checking : fill(m.upload.uploading, { percent: progress })} />
            <p className="mt-1 text-xs text-text-secondary">{progress >= 100 ? m.upload.checking : fill(m.upload.uploading, { percent: progress })}</p>
          </div>
        )}
        {error && <Callout variant="danger" role="alert">{error}</Callout>}
      </div>
    </Drawer>
  );
}
