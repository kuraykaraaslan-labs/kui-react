'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraGatewayRow, LoraIssuedCertificate, LoraIssuedToken, LoraSetup } from './types';

/**
 * LoraStationSetup — what a customer puts on a Basics Station gateway, alone (NB iot_lorawan 13; OD-60: configured once, no CUPS): the LNS
 * address (`tc.uri`), the discovery address, the server certificate (`tc.trust`) and the token header (`tc.key`). The token exists only right
 * after it was issued (`issued`): shown with Copy and the three files to download, and said to be shown once; later the card says how to get a
 * new one (rotate). A client-certificate gateway (NB LWP-1) gets `tc.crt` and, when the platform made its key, `tc.key` instead of the token
 * (`issuedCert`, right after issuance; later the card says how to get new ones). With `onDownloadAll` the host also offers every file in one
 * zip (the host packs it). A Roltek router has no token: it connects with its device certificate.
 */
export type LoraStationSetupProps = {
  gateway: Pick<LoraGatewayRow, 'eui' | 'protocol'> & Partial<Pick<LoraGatewayRow, 'authType'>>;
  setup: LoraSetup | null;
  issued?: LoraIssuedToken | null;
  /** A client certificate just issued: shown once, then the host drops it. */
  issuedCert?: LoraIssuedCertificate | null;
  /** The host saves a file (a Blob download); the component never builds a URL to a secret. */
  onDownload?: (file: { name: string; content: string }) => void;
  /** The host saves every file at once (one zip it packs); hidden without it. */
  onDownloadAll?: (files: Array<{ name: string; content: string }>) => void;
  messages?: LoraMessagesInput;
  className?: string;
};

function CopyValue({ label, value, copy, copied }: { label: string; value: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded border border-border bg-surface-sunken px-2 py-1 font-mono text-xs">{value}</code>
        <Button size="xs" variant="outline" onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
          {done ? copied : copy}
        </Button>
      </div>
    </div>
  );
}

export function LoraStationSetup({ gateway, setup, issued, issuedCert, onDownload, onDownloadAll, messages, className }: LoraStationSetupProps) {
  const all = mergeLoraMessages(messages);
  const m = all.setup;
  if (gateway.protocol === 'ROLTEK_LINK') return <Callout variant="info" className={className}>{m.roltek}</Callout>;
  if (!setup?.lnsUrl) return <Callout variant="warning" className={className}>{m.notConfigured}</Callout>;
  const cert = gateway.authType === 'CLIENT_CERT' || !!issuedCert;
  const keyLine = !cert && issued ? `Authorization: Bearer ${issued.token}` : null;
  const files = (cert ? issuedCert?.files : issued?.files) ?? null;
  return (
    <section className={['flex flex-col gap-4', className].filter(Boolean).join(' ')} aria-label={m.title}>
      <div>
        <h3 className="text-sm font-semibold">{m.title}</h3>
        <p className="mt-1 text-sm text-text-secondary">{m.intro}</p>
      </div>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>{m.step1}</li>
        <li className="flex flex-col gap-2">
          <span>{m.step2}</span>
          <CopyValue label={m.lnsUrl} value={setup.lnsUrl} copy={all.common.copy} copied={all.common.copied} />
          {setup.routerInfoUrl && <CopyValue label={m.discovery} value={setup.routerInfoUrl} copy={all.common.copy} copied={all.common.copied} />}
        </li>
        <li>{setup.trustAvailable ? m.step3 : m.trustMissing}</li>
        {cert ? (
          <li className="flex flex-col gap-2">
            <span>{m.step4Cert}</span>
            {issuedCert
              ? <Callout variant={issuedCert.keyIncluded ? 'warning' : 'note'}>{issuedCert.keyIncluded ? m.certKeyOnce : m.certOwnKey}</Callout>
              : <Callout variant="note">{m.certGone}</Callout>}
          </li>
        ) : (
          <li className="flex flex-col gap-2">
            <span>{m.step4}</span>
            {keyLine
              ? <><CopyValue label={m.token} value={keyLine} copy={all.common.copy} copied={all.common.copied} /><Callout variant="warning">{m.tokenOnce}</Callout></>
              : <Callout variant="note">{m.tokenGone}</Callout>}
          </li>
        )}
        <li>{m.step5}</li>
      </ol>
      {files?.length && (onDownload || onDownloadAll) ? (
        <div className="flex flex-wrap gap-2">
          {onDownloadAll && files.length > 1 && <Button size="sm" onClick={() => onDownloadAll(files)}>{m.downloadAll}</Button>}
          {onDownload && files.map((f) => <Button key={f.name} size="sm" variant="outline" onClick={() => onDownload(f)}>{fillText(m.download, { file: f.name })}</Button>)}
        </div>
      ) : null}
    </section>
  );
}
