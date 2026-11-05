/*
 * The eSIM views' data (NB iot_esim 00-01, D468-D475): a router's eSIM chip and profiles as it reports them, and the operations the
 * platform ran on them. Activation codes never come back: the platform keeps the SM-DP+ host and a short fingerprint only.
 */

export const ESIM_OPERATION_KINDS = ['download', 'enable', 'disable', 'delete', 'nickname', 'refresh'] as const;
export type EsimOperationKind = (typeof ESIM_OPERATION_KINDS)[number];

export const ESIM_OPERATION_STATES = ['sent', 'running', 'succeeded', 'failed', 'reverted', 'unknown'] as const;
export type EsimOperationState = (typeof ESIM_OPERATION_STATES)[number];
export const ESIM_IN_FLIGHT: ReadonlySet<EsimOperationState> = new Set(['sent', 'running']);

export type EsimProfileState = 'enabled' | 'disabled';
export type EsimProfileClass = 'operational' | 'test' | 'provisioning';
export type EsimUplink = 'ethernet' | 'wifi' | 'lte' | 'other';

export interface EsimProfile {
  iccid: string;
  operator: string;
  nickname?: string;
  state: EsimProfileState;
  class?: EsimProfileClass;
}

export interface EsimChip {
  /** 32 digits; for the tenant's admins only. */
  eid?: string;
  modem?: string;
  apdu?: 'at' | 'mbim' | 'qmi';
  lpac?: string;
  slots?: number;
  reason?: 'no_euicc' | 'no_apdu' | 'not_in_matrix';
}

export interface EsimOperation {
  operationId: string;
  deviceId: string;
  kind: EsimOperationKind;
  state: EsimOperationState;
  iccid: string | null;
  nickname: string | null;
  enableAfter: boolean;
  smdpHost: string | null;
  codeFingerprint: string | null;
  reason: string | null;
  detail: string | null;
  requestedBy: string | null;
  createdAt: string;
  acceptedAt: string | null;
  deadlineAt: string;
  finishedAt: string | null;
}

export interface EsimDeviceView {
  deviceId: string;
  supported: boolean;
  reason: 'no_capability' | 'not_reported' | 'unsupported' | null;
  capability: EsimChip | null;
  profiles: EsimProfile[];
  profilesAt: string | null;
  online: boolean;
  uplink: EsimUplink | null;
  /** A download can be offered (the router resolves secret references). */
  canDownload: boolean;
  inFlight: EsimOperation | null;
}

/** What one request asks; the codes are write-only (sent once, never shown again). */
export interface EsimStartInput {
  kind: EsimOperationKind;
  iccid?: string;
  nickname?: string;
  activationCode?: string;
  confirmationCode?: string;
  enable?: boolean;
  confirm?: boolean;
  confirmText?: string;
  confirmSecondUplink?: boolean;
}

/** What the viewer may do (the host's answer; the API judges every request again). */
export interface EsimAbilities {
  /** Download, switch, turn off, delete, rename. Without it the views are read only (Refresh stays). */
  manage?: boolean;
}

/** The six last digits of an ICCID: what a person types to confirm an operation on that profile. */
export const esimConfirmText = (iccid: string): string => iccid.slice(-6);

/** The connection the enabled profile may be the only one of: anything but Ethernet or Wi-Fi now. */
export const esimMayBeOnlyUplink = (uplink: EsimUplink | null): boolean => uplink !== 'ethernet' && uplink !== 'wifi';

/**
 * Reads a pasted activation code far enough to show where it goes (`LPA:1$<host>$<matching id>[$<oid>[$1]]`): the SM-DP+ host and whether
 * a confirmation code is needed. Null when it is not one. The server checks it again; the matching id is never kept by a view.
 */
export function readActivationCode(raw: string): { host: string; confirmationRequired: boolean } | null {
  let s = raw.trim();
  if (!s || s.length > 259) return null;
  if (/^lpa:/i.test(s)) s = s.slice(4);
  const parts = s.split('$');
  if (parts.length < 3 || parts.length > 5 || parts[0] !== '1') return null;
  const [host, port, ...extra] = parts[1].split(':');
  if (extra.length || !/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(host)) return null;
  if (port !== undefined && !/^[1-9][0-9]{0,4}$/.test(port)) return null;
  if (!/^[A-Za-z0-9-]{0,255}$/.test(parts[2])) return null;
  if (parts[3] !== undefined && parts[3] !== '' && !/^[0-2](?:\.[0-9]+)+$/.test(parts[3])) return null;
  if (parts[4] !== undefined && parts[4] !== '1') return null;
  return { host: host.toLowerCase(), confirmationRequired: parts[4] === '1' };
}
