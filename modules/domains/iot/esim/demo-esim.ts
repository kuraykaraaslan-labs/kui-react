import { EsimApiError, type EsimAdapter } from './esim-adapter';
import { esimConfirmText, esimMayBeOnlyUplink, readActivationCode, type EsimDeviceView, type EsimOperation, type EsimProfile, type EsimStartInput } from './types';

/**
 * An in-memory eSIM router for the showcase and the tests: it refuses what the platform refuses (slots, the profile in use, the only
 * uplink, the confirmation) and finishes an operation on `step()`. A download from a host containing `fail` fails at the operator; a switch
 * to a profile whose operator contains `NoSignal` is taken back (`reverted`). It keeps no activation code: only the host.
 */
export interface DemoEsimAdapter extends EsimAdapter {
  step(): void;
}

const iso = (t: number) => new Date(t).toISOString();

export function createDemoEsimAdapter(o: { deviceId?: string; supported?: boolean; uplink?: EsimDeviceView['uplink']; profiles?: EsimProfile[]; slots?: number } = {}): DemoEsimAdapter {
  const deviceId = o.deviceId ?? 'd-1';
  let profiles: EsimProfile[] = o.profiles ?? [
    { iccid: '8990011234567890123', operator: 'Turkcell', nickname: 'Main line', state: 'enabled', class: 'operational' },
    { iccid: '8990029876543210987', operator: 'Vodafone', state: 'disabled', class: 'operational' },
  ];
  const ops: EsimOperation[] = [];
  let n = 0;
  let downloads = 0;
  const now = () => Date.now();
  const view = (): EsimDeviceView => ({
    deviceId,
    supported: o.supported !== false,
    reason: o.supported === false ? 'unsupported' : null,
    capability: o.supported === false ? { reason: 'no_euicc' } : { eid: '89049032000001000000123456789012', modem: 'Quectel EG25-G', apdu: 'at', lpac: '2.2.1', slots: o.slots ?? 4 },
    profiles: o.supported === false ? [] : profiles.map((p) => ({ ...p })),
    profilesAt: iso(now() - 60_000),
    online: true,
    uplink: o.uplink ?? 'lte',
    canDownload: o.supported !== false,
    inFlight: ops.find((x) => x.state === 'sent' || x.state === 'running') ?? null,
  });
  const refuse = (reason: string, status = 409) => { throw new EsimApiError(reason, status, { reason }); };

  return {
    async device(id) {
      if (id !== deviceId) refuse('device_not_found', 404);
      return view();
    },
    async operations() {
      return [...ops].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((x) => ({ ...x }));
    },
    async start(id, input: EsimStartInput) {
      if (id !== deviceId) refuse('device_not_found', 404);
      if (o.supported === false) refuse('esim_unsupported');
      if (view().inFlight) refuse('operation_in_flight');
      const target = input.iccid ? profiles.find((p) => p.iccid === input.iccid) : undefined;
      let smdpHost: string | null = null;
      if (input.kind === 'download') {
        const code = readActivationCode(input.activationCode ?? '');
        if (!code) refuse('invalid_activation_code', 400);
        if (code!.confirmationRequired && !input.confirmationCode) refuse('confirmation_code_required', 400);
        if (profiles.length >= (o.slots ?? 4)) refuse('no_free_slot');
        smdpHost = code!.host;
      } else if (input.kind !== 'refresh') {
        if (!target) refuse('profile_not_found', 404);
        if (input.kind === 'enable' && target!.state === 'enabled') refuse('already_enabled');
        if (input.kind === 'disable' && esimMayBeOnlyUplink(o.uplink ?? 'lte') && !input.confirmSecondUplink) refuse('only_uplink');
        if (input.kind === 'delete' && target!.state === 'enabled') refuse('profile_enabled');
      }
      if (input.kind !== 'refresh' && input.kind !== 'nickname') {
        if (!input.confirm) refuse('confirm_required', 400);
        if (input.iccid && input.confirmText !== esimConfirmText(input.iccid)) refuse('confirm_text_mismatch', 400);
      }
      n += 1;
      const op: EsimOperation = {
        operationId: `op-${n}`, deviceId, kind: input.kind, state: input.kind === 'refresh' || input.kind === 'nickname' ? 'succeeded' : 'running',
        iccid: input.iccid ?? null, nickname: input.nickname ?? null, enableAfter: !!input.enable, smdpHost, codeFingerprint: smdpHost ? 'a1b2c3d4e5f6' : null,
        reason: null, detail: null, requestedBy: 'demo', createdAt: iso(now()), acceptedAt: iso(now()), deadlineAt: iso(now() + 600_000),
        finishedAt: input.kind === 'refresh' || input.kind === 'nickname' ? iso(now()) : null,
      };
      if (input.kind === 'nickname' && target) target.nickname = input.nickname || undefined;
      ops.push(op);
      return { ...op };
    },
    step() {
      const op = ops.find((x) => x.state === 'running');
      if (!op) return;
      const end = (state: EsimOperation['state'], reason: string | null = null) => { op.state = state; op.reason = reason; op.finishedAt = iso(now()); };
      if (op.kind === 'download') {
        if (op.smdpHost?.includes('fail')) { end('failed', 'download_failed'); return; }
        downloads += 1;
        const iccid = `89900300000000000${String(downloads).padStart(2, '0')}`;
        profiles.push({ iccid, operator: 'Demo Mobile', state: 'disabled', class: 'operational' });
        op.iccid = iccid;
        if (op.enableAfter) profiles = profiles.map((p) => ({ ...p, state: p.iccid === iccid ? 'enabled' : 'disabled' }));
        end('succeeded');
      } else if (op.kind === 'enable') {
        const target = profiles.find((p) => p.iccid === op.iccid);
        if (target?.operator.includes('NoSignal')) { end('reverted', 'reverted'); return; }
        profiles = profiles.map((p) => ({ ...p, state: p.iccid === op.iccid ? 'enabled' : 'disabled' }));
        end('succeeded');
      } else if (op.kind === 'disable') {
        profiles = profiles.map((p) => (p.iccid === op.iccid ? { ...p, state: 'disabled' } : p));
        end('succeeded');
      } else if (op.kind === 'delete') {
        profiles = profiles.filter((p) => p.iccid !== op.iccid);
        end('succeeded');
      }
    },
  };
}
