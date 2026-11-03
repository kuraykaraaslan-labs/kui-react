/** The LoRaWAN rows the components draw (NB iot_lorawan's API shapes; no key, no token hash). */
export type LoraGatewayRow = {
  gatewayId: string;
  name: string;
  eui: string;
  protocol: 'BASICS_STATION' | 'ROLTEK_LINK';
  status: 'ACTIVE' | 'DISABLED' | 'PENDING';
  region: string;
  lastSeenAt: string | null;
  live?: { online: boolean; rttMs: number | null; connectedAt: number | null };
};

export type LoraJoinState = { state: string; reason?: string; at: number } | null;

export type LoraDeviceRow = {
  deviceId: string;
  name: string | null;
  devEui: string;
  joinEui: string;
  class: 'A' | 'C';
  macVersion: string;
  lastJoin: LoraJoinState;
  session?: { devAddr: string; fCntUp: number | null; fCntDown: number; lastUplinkAt: string | null; status: string } | null;
};

export type LoraFrameRow = {
  t: number;
  type: 'up' | 'cup' | 'join' | 'join_accept' | 'down' | 'dropped' | string;
  result: 'processed' | 'dropped' | 'retransmission' | 'sent' | string;
  reason?: string;
  deviceId?: string;
  devEui?: string;
  devAddr?: string;
  fCnt?: number;
  fPort?: number;
  dr?: number;
  freq?: number;
  gateways: Array<{ gatewayId: string; eui: string; rssi: number; snr: number }>;
  chosenGatewayId?: string;
  window?: string;
  decoded?: Record<string, unknown>;
  bytes?: number;
};

export type LoraSetup = { lnsUrl: string | null; routerInfoUrl: string | null; trustAvailable: boolean };

/** A Station token just issued (shown once) and the files that carry it. */
export type LoraIssuedToken = { token: string; files: Array<{ name: string; content: string }> | null };

export type LoraGatewayInput = { name: string; eui: string; region: 'EU868' };
export type LoraDeviceInput = { name: string; devEui: string; joinEui: string; appKey: string; macVersion: '1.0.2' | '1.0.3' | '1.0.4'; class: 'A' | 'C' };
