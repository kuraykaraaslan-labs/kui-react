'use client';
import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { Select } from '@/modules/ui/Select';
import { SchemaForm } from '@/modules/app/SchemaForm/SchemaForm';
import { validateSchemaValues } from '@/modules/app/SchemaForm/validate';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessagesInput } from '../messages';
import type { RuleScope } from '../types/rules';

/**
 * PlaceCommands — the card's own command buttons (docs/concepts/iot-rules 05 §5.1, OD-206): pick a device of the place, pick one of its
 * kind's commands the card may send (basic, never high-impact: those go through the device console), fill the values the command
 * declares and send. Devices and commands are named; nothing here shows a method name as the label. The host sends and says how it went.
 */
export type PlaceCommandsProps = {
  scope: Pick<RuleScope, 'devices' | 'deviceTypes'>;
  canSend: boolean;
  /** Names of devices in Manual (their own rules are out of service; the command still goes through: the person has the plant). */
  manualDevices?: ReadonlySet<string>;
  onSend: (input: { deviceId: string; method: string; params: Record<string, unknown> }) => Promise<void>;
  messages?: IotMessagesInput;
  className?: string;
};

export function PlaceCommands({ scope, canSend, onSend, messages, className }: PlaceCommandsProps) {
  const { m } = useIotText(messages);
  const withCommands = useMemo(() => scope.devices.flatMap((d) => {
    const t = scope.deviceTypes.find((x) => x.profileId === d.profileId);
    const commands = (t?.commands ?? []).filter((c) => c.cardCanSend);
    return commands.length ? [{ device: d, commands }] : [];
  }), [scope]);
  const [deviceId, setDeviceId] = useState('');
  const [method, setMethod] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | undefined>();
  const [failed, setFailed] = useState<string | undefined>();

  if (!withCommands.length) return <p className={cn('text-sm text-text-secondary', className)}>{m.rules.commandsEmpty}</p>;

  const entry = withCommands.find((x) => x.device.deviceId === deviceId);
  const command = entry?.commands.find((c) => c.method === method);
  const schema = (command?.paramsSchema ?? {}) as Record<string, never>;

  const send = async () => {
    if (!entry || !command) return;
    const errs = validateSchemaValues(schema, values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setDone(undefined);
    setFailed(undefined);
    try {
      await onSend({ deviceId: entry.device.deviceId, method: command.method, params: values });
      setDone(fill(m.rules.commandSent, { command: command.label, device: entry.device.name }));
    } catch (e) {
      setFailed(e instanceof Error ? e.message : fill(m.rules.commandFailed, { command: command.label }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          id="place-command-device" label={m.rules.commandDevice} value={deviceId}
          onChange={(e) => { setDeviceId(e.target.value); setMethod(''); setValues({}); setErrors({}); setDone(undefined); }}
          options={[{ value: '', label: m.rules.pickDevice }, ...withCommands.map((x) => ({ value: x.device.deviceId, label: x.device.name }))]}
        />
        <Select
          id="place-command-method" label={m.rules.command} value={method} disabled={!entry}
          onChange={(e) => { setMethod(e.target.value); setValues({}); setErrors({}); setDone(undefined); }}
          options={[{ value: '', label: m.rules.commandChoose }, ...(entry?.commands ?? []).map((c) => ({ value: c.method, label: c.label }))]}
        />
      </div>
      {command && Object.keys(schema).length ? <SchemaForm schema={schema} values={values} errors={errors} onChange={setValues} debounceMs={0} messages={{ on: m.rules.on, off: m.rules.off }} /> : null}
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!canSend || !command} loading={busy} onClick={() => void send()}>
          <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />{m.rules.commandSend}
        </Button>
        {done ? <span role="status" className="text-sm text-success-fg">{done}</span> : null}
        {failed ? <span role="alert" className="text-sm text-error-fg">{failed}</span> : null}
      </div>
    </div>
  );
}
