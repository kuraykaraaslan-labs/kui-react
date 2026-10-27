'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faPlug } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { CredentialType, DeviceConnectionInfo } from '../types/device';
import type { IotMessagesInput } from '../messages';

/**
 * DeviceConnectionCard — "Connection details" (NB phase 39 UX-23): what an integrator types into a device or a test client. The MQTT
 * endpoint (host, port, TLS or plain), how the credential logs in, the default topics (telemetry, attributes, commands and their
 * answers), the HTTPS telemetry URL with its bearer header, an example payload from the profile's keys, and ready `mosquitto_pub` and
 * `curl` lines with a copy button each. The secret is filled in only while the one-time notice shows it (`secret`); otherwise the lines
 * carry a placeholder, so nothing secret ever sits in the page.
 */
export type DeviceConnectionCardProps = {
  info: DeviceConnectionInfo;
  /** The device's credential type (default: an access token). */
  credentialType?: CredentialType;
  /** The access token or password, only while it is shown. */
  secret?: string | null;
  /** MQTT basic: the stored username and client id. */
  username?: string | null;
  clientId?: string | null;
  messages?: IotMessagesInput;
  className?: string;
};

export const TELEMETRY_TOPIC = 'v1/telemetry';
export const ATTRIBUTES_TOPIC = 'v1/attributes';
export const RPC_REQUEST_TOPIC = 'v1/rpc/req/+';
export const RPC_RESPONSE_TOPIC = 'v1/rpc/res/{id}';
export const TELEMETRY_PATH = '/api/v1/telemetry';

const SAMPLE: Record<string, unknown> = { number: 21.5, integer: 1, boolean: true, string: 'ok', json: {} };

/** A telemetry message with up to six of the profile's keys (a typed sample value each), or `{"temperature": 21.5}` without keys. */
export function examplePayload(keys: DeviceConnectionInfo['telemetryKeys']): string {
  const picked = (keys ?? []).filter((k) => k.key).slice(0, 6);
  const body = picked.length ? Object.fromEntries(picked.map((k) => [k.key, k.type && k.type in SAMPLE ? SAMPLE[k.type] : 21.5])) : { temperature: 21.5 };
  return JSON.stringify(body);
}

/** `'…'` for a shell line: a single quote inside is closed, escaped and reopened. */
const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** The ready command lines (exported for tests): `mosquitto_pub` when the MQTT endpoint is known, `curl` for an access token over HTTPS. */
export function connectionCommands(input: {
  info: DeviceConnectionInfo; credentialType: CredentialType; secret?: string | null; username?: string | null; clientId?: string | null;
  placeholders: { token: string; password: string };
}): { mqtt: string | null; http: string | null } {
  const { info, credentialType, secret, username, clientId, placeholders } = input;
  const payload = examplePayload(info.telemetryKeys);
  let mqtt: string | null = null;
  if (info.mqtt && credentialType !== 'X509_CERTIFICATE') {
    const login = credentialType === 'MQTT_BASIC'
      ? `${clientId ? `-i ${shellQuote(clientId)} ` : ''}-u ${shellQuote(username || '<username>')} -P ${shellQuote(secret || placeholders.password)}`
      : `-u ${shellQuote(secret || placeholders.token)}`;
    mqtt = `mosquitto_pub -h ${info.mqtt.host} -p ${info.mqtt.port}${info.mqtt.tls ? ' --capath /etc/ssl/certs' : ''} ${login} -t ${TELEMETRY_TOPIC} -m ${shellQuote(payload)}`;
  }
  const http = info.httpBase && credentialType === 'ACCESS_TOKEN'
    ? `curl -X POST ${info.httpBase}${TELEMETRY_PATH} -H ${shellQuote(`Authorization: Bearer ${secret || placeholders.token}`)} -H 'Content-Type: application/json' -d ${shellQuote(payload)}`
    : null;
  return { mqtt, http };
}

function CopyLine({ label, value, copyLabel, copiedLabel }: { label: string; value: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no clipboard: the line stays selectable on screen
    }
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-secondary">{label}</span>
        <Button variant="ghost" size="xs" onClick={() => void copy()} aria-label={`${copyLabel}: ${label}`}
          iconLeft={<FontAwesomeIcon icon={copied ? faCheck : faCopy} className="h-3 w-3" aria-hidden="true" />}>
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-border bg-surface-base px-2 py-1 font-mono text-xs text-text-primary">{value}</pre>
    </div>
  );
}

export function DeviceConnectionCard({ info, credentialType = 'ACCESS_TOKEN', secret, username, clientId, messages, className }: DeviceConnectionCardProps) {
  const { m } = useIotText(messages);
  if (!info.mqtt && !info.httpBase) return null;
  const c = m.connectionInfo;
  const cmd = connectionCommands({ info, credentialType, secret, username, clientId, placeholders: { token: c.tokenPlaceholder, password: c.passwordPlaceholder } });
  const rows: Array<[string, React.ReactNode]> = [];
  if (info.mqtt) {
    rows.push([c.broker, <code key="b" className="font-mono">{`${info.mqtt.host}:${info.mqtt.port}`}</code>]);
    rows.push([c.security, info.mqtt.tls ? c.tls : c.plain]);
    rows.push([c.login, credentialType === 'X509_CERTIFICATE' ? c.loginX509 : credentialType === 'MQTT_BASIC' ? c.loginBasic : c.loginToken]);
    rows.push([c.topicTelemetry, <code key="t" className="font-mono">{TELEMETRY_TOPIC}</code>]);
    rows.push([c.topicAttributes, <code key="a" className="font-mono">{ATTRIBUTES_TOPIC}</code>]);
    rows.push([c.topicCommands, <span key="r"><code className="font-mono">{RPC_REQUEST_TOPIC}</code>{' · '}{fill(c.answerOn, { topic: RPC_RESPONSE_TOPIC })}</span>]);
  }
  if (info.httpBase && credentialType === 'ACCESS_TOKEN') {
    rows.push([c.httpUrl, <code key="h" className="break-all font-mono">{`POST ${info.httpBase}${TELEMETRY_PATH}`}</code>]);
    rows.push([c.httpHeader, <code key="hh" className="font-mono">{`Authorization: Bearer ${c.tokenPlaceholder}`}</code>]);
  }

  return (
    <section className={cn('@container space-y-3 rounded-lg border border-border bg-surface-raised p-3', className)} aria-label={c.title}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <FontAwesomeIcon icon={faPlug} className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
        {c.title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm @md:grid-cols-[max-content_1fr]">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-text-secondary">{term}</dt>
            <dd className="min-w-0 text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <CopyLine label={c.example} value={examplePayload(info.telemetryKeys)} copyLabel={m.common.copy} copiedLabel={m.common.copied} />
      {cmd.mqtt && <CopyLine label={c.mqttLine} value={cmd.mqtt} copyLabel={m.common.copy} copiedLabel={m.common.copied} />}
      {cmd.http && <CopyLine label={c.httpLine} value={cmd.http} copyLabel={m.common.copy} copiedLabel={m.common.copied} />}
      <p className="text-xs text-text-secondary">{secret ? c.secretFilled : c.secretPlaceholder}</p>
    </section>
  );
}
