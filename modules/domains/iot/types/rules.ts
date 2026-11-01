/**
 * The shapes of the Rules card (docs/concepts/iot-rules of the platform): the rule a customer writes as sentences, the scope it is
 * written against (devices, their values, their commands, all by name), a place's Manual / Auto mode and the "Test now" answer. The
 * platform's server is the authority on the definition (`RuleDefinitionSchema`); these types only describe what it sends and takes.
 * No id is ever shown: ids travel for the save, names are what a person reads.
 */
export type RulePlace = { type: 'asset' | 'device'; id: string };

/** One device, or every device of a device type, of the place's scope. */
export type RuleDeviceRef = { device: string } | { deviceType: string };
export type RuleDeviceOrHome = RuleDeviceRef | { home: true };

export type RuleSeverity = 'critical' | 'major' | 'minor' | 'warning' | 'info';
export type RuleValue = string | number | boolean;

export type RuleTrigger = { id: string } & (
  | { kind: 'value'; target: RuleDeviceRef; key: string; change: 'any' | 'above' | 'below' | 'equals' | 'not_equals' | 'between' | 'outside'; value?: RuleValue; value2?: number; forSec?: number }
  | { kind: 'status'; target: RuleDeviceRef; to: 'online' | 'offline' | 'inactive' }
  | { kind: 'alarm'; target: RuleDeviceOrHome; event: 'raised' | 'cleared'; minSeverity?: RuleSeverity; alarmType?: string }
  | { kind: 'time'; at: string; days?: number[] }
  | { kind: 'every'; minutes: number }
  | { kind: 'sun'; event: 'sunrise' | 'sunset'; offsetMin?: number; days?: number[] }
  | { kind: 'manual' }
);

export type RuleCondition =
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }
  | { not: RuleCondition }
  | { kind: 'value'; target: RuleDeviceRef; key: string; op: '>' | '>=' | '<' | '<=' | '==' | '!=' | 'between'; value: RuleValue; value2?: number }
  | { kind: 'status'; target: RuleDeviceRef; is: 'online' | 'offline' }
  | { kind: 'alarm'; target: RuleDeviceOrHome; active: boolean; minSeverity?: RuleSeverity }
  | { kind: 'time'; after?: string; before?: string; days?: number[] }
  | { kind: 'sun'; is: 'day' | 'night' }
  | { kind: 'expr'; expr: string };

export type RuleRecipient = { kind: 'user'; userId: string } | { kind: 'role'; role: 'OWNER' | 'ADMIN' | 'USER' } | { kind: 'team'; teamId: string };

export type RuleAction = { id: string } & (
  | { kind: 'command'; target: RuleDeviceRef; command: string; params?: Record<string, unknown> }
  | { kind: 'setting'; target: RuleDeviceRef; key: string; value: RuleValue }
  | { kind: 'notify'; recipients: RuleRecipient[]; channels?: string[]; text: string }
  | { kind: 'alarm'; op: 'raise' | 'clear'; target: RuleDeviceOrHome; alarmType: string; severity?: RuleSeverity }
  | { kind: 'wait'; sec: number }
  | { kind: 'wait_until'; condition: RuleCondition; timeoutSec: number; onTimeout: 'continue' | 'stop' }
  | { kind: 'choose'; branches: Array<{ if: RuleCondition; then: RuleAction[] }>; else?: RuleAction[] }
  | { kind: 'rule'; op: 'enable' | 'disable' | 'run'; rule: string }
);

export type RuleDefinition = {
  v: 1;
  when: RuleTrigger[];
  onlyIf?: RuleCondition;
  then: RuleAction[];
  options: { overlap: 'ignore' | 'queue' | 'parallel' | 'restart'; max?: number; runInManual?: boolean };
};

/** A rule as the card lists it. `run` is what the card shows beside the name: when it last ran and what it did. */
export type RuleItem = {
  ruleId: string;
  home: RulePlace;
  name: string;
  enabled: boolean;
  definition: RuleDefinition;
  status: 'ok' | 'needs_attention';
  statusReason: string | null;
  updatedAt: number;
  /** Set by the host from the rule's runs: the last one in words and when it was. */
  lastRun?: { at: number; text: string; ok: boolean } | null;
  /** The next time a schedule row starts it, epoch ms. */
  nextAt?: number | null;
  /** A hold ("and stays so for N min") counting down: when it ends. */
  waitingUntil?: number | null;
  /** The engine paused it on its own (a loop or flood guard). */
  pausedByGuard?: boolean;
  /** Its place is in Manual, so the rule is out of service until Auto. */
  stoppedByManual?: boolean;
};

export type RuleScopeValue = { key: string; label: string; sample: string | number | boolean | null };
export type RuleScopeDevice = { deviceId: string; name: string; profileId: string; values: RuleScopeValue[] };
export type RuleScopeCommand = {
  method: string;
  label: string;
  tier: 'basic' | 'privileged' | 'critical';
  highImpact: boolean;
  /** The card's own buttons may send it (basic, not high-impact). */
  cardCanSend: boolean;
  paramsSchema: Record<string, unknown>;
};
export type RuleScopeType = { profileId: string; name: string; deviceCount: number; commands: RuleScopeCommand[] };
export type RuleScope = {
  place: { type: 'asset' | 'device'; id: string; name: string; hasLocation: boolean };
  devices: RuleScopeDevice[];
  deviceTypes: RuleScopeType[];
  roles: Array<'OWNER' | 'ADMIN' | 'USER'>;
};

/** A place's mode (04 §4.2): what it is set to, what applies (an asset above may make it Manual), and who set it and until when. */
export type RuleMode = {
  mode: 'manual' | 'auto';
  effective: 'manual' | 'auto';
  /** The place above that makes this one Manual, with its name. */
  setOn?: { type: 'asset' | 'device'; id: string; name?: string };
  until?: number;
  setBy?: string;
  setByName?: string;
  setAt?: number;
  reason?: string;
};

export type RuleTestResult = {
  triggers: Array<{ id: string; holds: boolean | null; why: string }>;
  conditions: { ok: boolean; why: string } | null;
  actions: string[];
  mode: { effective: 'manual' | 'auto'; stops: boolean };
  wouldRun: boolean;
  summary: string;
};

/** A problem the server found in a save, with the path of the row it belongs to (`['then', 0, 'command']`). */
export type RuleProblem = { path: Array<string | number>; code: string; message: string };
