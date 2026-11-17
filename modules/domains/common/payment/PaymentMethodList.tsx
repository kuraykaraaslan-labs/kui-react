'use client';
import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuildingColumns, faCreditCard, faFileSignature, faPlus, faStar } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { EmptyState } from '@/modules/ui/EmptyState';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableRowAction } from '@/modules/ui/Table/types';
import type { CardBrand } from './cardBrand';
import { CardBrandBadge, cardBrandName } from './CardBrandBadge';

/** How a saved method charges: a card token, a direct-debit mandate, a provider agreement, a SEPA mandate or a bank token. */
export type PaymentMethodKind = 'card' | 'mandate' | 'agreement' | 'sepa' | 'bank_token';

/**
 * `active`: usable. `expiring`: a card whose expiry falls before the next renewal. `requires_reauth`: the provider wants
 * the subscriber back (3-D Secure, a lapsed mandate) before it can be charged again. `revoked`: no longer usable.
 */
export type PaymentMethodStatus = 'active' | 'expiring' | 'requires_reauth' | 'revoked';

export type SavedPaymentMethod = {
  methodId: string;
  kind: PaymentMethodKind;
  status: PaymentMethodStatus;
  /** Cards: the scheme, for the brand chip. */
  brand?: CardBrand | null;
  /** The last four digits of a card or an account (IBAN, bank account). */
  last4?: string | null;
  /** `MM` and `YY` (or `YYYY`); a method without an expiry leaves them out. */
  expiryMonth?: string | null;
  expiryYear?: string | null;
  /** What the method is called when it has no number to show ("PayPal billing agreement", "Razorpay e-mandate"). */
  label?: string | null;
  holderName?: string | null;
  /** The gateway that holds it ("iyzico", "Stripe"), shown under the method. */
  provider?: string | null;
  isDefault?: boolean;
};

export type PaymentMethodListMessages = {
  title: string;
  method: string;
  expires: string;
  status: string;
  isDefault: string;
  noExpiry: string;
  kind: string;
  /** Row labels by kind, used when a method has no number of its own. */
  kindCard: string;
  kindMandate: string;
  kindAgreement: string;
  kindSepa: string;
  kindBankToken: string;
  statusActive: string;
  statusExpiring: string;
  statusRequiresReauth: string;
  statusRevoked: string;
  /** The masked number: `{last4}`. */
  endingIn: string;
  add: string;
  /** The row's action menu: `{method}`. */
  rowActions: string;
  makeDefault: string;
  remove: string;
  removeTitle: string;
  /** `{method}`: the row's name ("Visa •••• 4242"). */
  removeMessage: string;
  /** The last method of a subscription that is in use: renewals fall back to payment requests. */
  removeLastMessage: string;
  /** Why the default cannot be removed while other methods exist. */
  removeDefaultReason: string;
  cancel: string;
  emptyTitle: string;
  emptyDescription: string;
  loading: string;
};

export const PAYMENT_METHOD_LIST_MESSAGES: PaymentMethodListMessages = {
  title: 'Payment methods',
  method: 'Method',
  expires: 'Expires',
  status: 'Status',
  isDefault: 'Default',
  noExpiry: '—',
  kind: 'Type',
  kindCard: 'Card',
  kindMandate: 'Direct debit mandate',
  kindAgreement: 'Billing agreement',
  kindSepa: 'SEPA Direct Debit',
  kindBankToken: 'Bank account',
  statusActive: 'Active',
  statusExpiring: 'Expiring',
  statusRequiresReauth: 'Needs re-authorisation',
  statusRevoked: 'Revoked',
  endingIn: '•••• {last4}',
  add: 'Add payment method',
  rowActions: 'Actions for {method}',
  makeDefault: 'Make default',
  remove: 'Remove',
  removeTitle: 'Remove payment method',
  removeMessage: '{method} is removed. It will not be charged again.',
  removeLastMessage:
    '{method} is your last payment method. Renewals will no longer be charged automatically: you will get a payment request for each one instead.',
  removeDefaultReason: 'Make another method the default first.',
  cancel: 'Cancel',
  emptyTitle: 'No saved payment methods',
  emptyDescription: 'Add a payment method to renew automatically.',
  loading: 'Loading payment methods…',
};

export type PaymentMethodListProps = {
  methods: SavedPaymentMethod[];
  loading?: boolean;
  /** A load failure, shown in the table. */
  error?: string | null;
  /** Called at once (no confirmation: nothing is lost). Hidden on the default and on unusable methods. */
  onMakeDefault?: (method: SavedPaymentMethod) => void | Promise<void>;
  /** Called after the ConfirmDialog; a rejected promise keeps the dialog open with the error. */
  onRemove?: (method: SavedPaymentMethod) => void | Promise<void>;
  /** Renders the "Add payment method" header button. */
  onAdd?: () => void;
  /** Extra header controls beside (or instead of) the add button. */
  headerActions?: React.ReactNode;
  /**
   * The methods pay a live subscription: the default cannot be removed while others exist (make another the default
   * first), and removing the last one says renewals fall back to payment requests.
   */
  inUse?: boolean;
  /** Read-only (an operator looking at a customer's methods): no row actions, no add button. */
  readOnly?: boolean;
  /** The table's heading; `null` hides it. Default `messages.title`. */
  title?: React.ReactNode | null;
  messages?: Partial<PaymentMethodListMessages>;
  className?: string;
};

type Row = SavedPaymentMethod & Record<string, unknown>;

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

const STATUS_BADGE: Record<PaymentMethodStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  expiring: 'warning',
  requires_reauth: 'error',
  revoked: 'neutral',
};
const STATUS_RANK: Record<PaymentMethodStatus, number> = { active: 0, expiring: 1, requires_reauth: 2, revoked: 3 };
const KIND_ICON = { mandate: faFileSignature, agreement: faFileSignature, sepa: faBuildingColumns, bank_token: faBuildingColumns, card: faCreditCard } as const;

const usable = (s: PaymentMethodStatus) => s === 'active' || s === 'expiring';

function kindLabel(kind: PaymentMethodKind, m: PaymentMethodListMessages): string {
  switch (kind) {
    case 'card': return m.kindCard;
    case 'mandate': return m.kindMandate;
    case 'agreement': return m.kindAgreement;
    case 'sepa': return m.kindSepa;
    case 'bank_token': return m.kindBankToken;
  }
}

function statusLabel(status: PaymentMethodStatus, m: PaymentMethodListMessages): string {
  switch (status) {
    case 'active': return m.statusActive;
    case 'expiring': return m.statusExpiring;
    case 'requires_reauth': return m.statusRequiresReauth;
    case 'revoked': return m.statusRevoked;
  }
}

/** The row's name in one line ("Visa •••• 4242", "SEPA Direct Debit •••• 3000", "PayPal billing agreement"). */
export function paymentMethodName(method: SavedPaymentMethod, messages?: Partial<PaymentMethodListMessages>): string {
  const m = { ...PAYMENT_METHOD_LIST_MESSAGES, ...messages };
  const head =
    method.kind === 'card' && method.brand && method.brand !== 'UNKNOWN'
      ? cardBrandName(method.brand)
      : method.label || kindLabel(method.kind, m);
  return method.last4 ? `${head} ${fill(m.endingIn, { last4: method.last4 })}` : head;
}

function expiryOf(method: SavedPaymentMethod): { text: string; sort: number } | null {
  if (!method.expiryMonth || !method.expiryYear) return null;
  const yy = method.expiryYear.length === 4 ? method.expiryYear.slice(2) : method.expiryYear;
  const year = method.expiryYear.length === 4 ? Number(method.expiryYear) : 2000 + Number(method.expiryYear);
  return { text: `${method.expiryMonth}/${yy}`, sort: year * 100 + Number(method.expiryMonth) };
}

/**
 * PaymentMethodList — a subscriber's saved payment methods in a DataTable: cards with their brand chip (the one of
 * `SavedCardSelector`), mandates, agreements, SEPA mandates and bank tokens, each with its last four digits, expiry,
 * status and the default marker. Sort and filter by status and type. Row actions "Make default" (at once) and "Remove"
 * (through the ConfirmDialog); "Add payment method" in the header. The host owns the data: it refreshes `methods` after
 * an action. Never shows or takes card numbers: the host's provider page adds a method.
 */
export function PaymentMethodList({
  methods,
  loading = false,
  error,
  onMakeDefault,
  onRemove,
  onAdd,
  headerActions,
  inUse = false,
  readOnly = false,
  title,
  messages,
  className,
}: PaymentMethodListProps) {
  const m = { ...PAYMENT_METHOD_LIST_MESSAGES, ...messages };
  const [removing, setRemoving] = useState<SavedPaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = methods as Row[];
  const live = methods.filter((x) => x.status !== 'revoked');
  const kinds = useMemo(() => Array.from(new Set(methods.map((x) => x.kind))), [methods]);

  async function makeDefault(method: SavedPaymentMethod) {
    if (!onMakeDefault) return;
    setActionError(null);
    try {
      await onMakeDefault(method);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }

  async function confirmRemove() {
    if (!removing || !onRemove) return;
    setBusy(true);
    setDialogError(undefined);
    try {
      await onRemove(removing);
      setRemoving(null);
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'method',
      header: m.method,
      sortable: true,
      sortValue: (r) => paymentMethodName(r, m).toLowerCase(),
      searchValue: (r) => [paymentMethodName(r, m), r.holderName, r.provider].filter(Boolean).join(' '),
      render: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          {r.kind === 'card' ? (
            <CardBrandBadge brand={r.brand ?? 'UNKNOWN'} />
          ) : (
            <span
              className="inline-flex h-[18px] w-8 shrink-0 items-center justify-center rounded bg-surface-sunken text-text-secondary"
              aria-hidden="true"
            >
              <FontAwesomeIcon icon={KIND_ICON[r.kind]} className="h-3 w-3" />
            </span>
          )}
          <div className="min-w-0">
            <p className={cn('truncate text-sm font-medium text-text-primary', r.last4 && 'font-mono')}>
              {r.last4 ? fill(m.endingIn, { last4: r.last4 }) : r.label || kindLabel(r.kind, m)}
            </p>
            {(r.holderName || r.provider || (r.last4 && r.kind !== 'card')) && (
              <p className="truncate text-xs text-text-secondary">
                {[r.last4 && r.kind !== 'card' ? r.label || kindLabel(r.kind, m) : null, r.holderName, r.provider]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'expires',
      header: m.expires,
      sortable: true,
      searchable: false,
      sortValue: (r) => expiryOf(r)?.sort ?? null,
      render: (r) => {
        const e = expiryOf(r);
        return e ? (
          <span className={cn('font-mono text-sm tabular-nums', r.status === 'expiring' ? 'text-warning' : 'text-text-primary')}>{e.text}</span>
        ) : (
          <span className="text-sm text-text-secondary">{m.noExpiry}</span>
        );
      },
    },
    {
      key: 'status',
      header: m.status,
      sortable: true,
      sortValue: (r) => STATUS_RANK[r.status],
      searchValue: (r) => statusLabel(r.status, m),
      render: (r) => (
        <Badge variant={STATUS_BADGE[r.status]} size="sm">{statusLabel(r.status, m)}</Badge>
      ),
    },
    {
      key: 'isDefault',
      header: m.isDefault,
      sortable: true,
      searchable: false,
      sortValue: (r) => (r.isDefault ? 0 : 1),
      render: (r) =>
        r.isDefault ? (
          <Badge variant="primary" size="sm" className="gap-1">
            <FontAwesomeIcon icon={faStar} className="h-2.5 w-2.5" aria-hidden="true" />
            {m.isDefault}
          </Badge>
        ) : null,
    },
  ];

  const filterFields: DataTableFilterField<Row>[] = [
    {
      id: 'status',
      label: m.status,
      type: 'select',
      options: (['active', 'expiring', 'requires_reauth', 'revoked'] as const).map((s) => ({ value: s, label: statusLabel(s, m) })),
    },
    ...(kinds.length > 1
      ? [{
          id: 'kind',
          label: m.kind,
          type: 'select' as const,
          options: kinds.map((k) => ({ value: k, label: kindLabel(k, m) })),
        }]
      : []),
  ];

  const rowActions: DataTableRowAction<Row>[] = readOnly
    ? []
    : [
        ...(onMakeDefault
          ? [{
              id: 'make-default',
              label: m.makeDefault,
              hidden: (r: Row) => !!r.isDefault || !usable(r.status),
              onClick: (r: Row) => void makeDefault(r),
            }]
          : []),
        ...(onRemove
          ? [{
              id: 'remove',
              label: m.remove,
              destructive: true,
              disabled: (r: Row) => inUse && !!r.isDefault && live.length > 1,
              disabledReason: (r: Row) => (inUse && r.isDefault && live.length > 1 ? m.removeDefaultReason : undefined),
              onClick: (r: Row) => { setDialogError(undefined); setRemoving(r); },
            }]
          : []),
      ];

  const header = (
    <>
      {headerActions}
      {!readOnly && onAdd && (
        <Button size="sm" variant="primary" iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" />} onClick={onAdd}>
          {m.add}
        </Button>
      )}
    </>
  );

  const removingIsLast = !!removing && inUse && live.length === 1 && live[0].methodId === removing.methodId;

  return (
    <div className={cn('space-y-3', className)}>
      {actionError && (
        <p role="alert" className="rounded-md border border-error bg-error-subtle px-3 py-2 text-sm text-error">
          {actionError}
        </p>
      )}
      <DataTable<Row>
        mode="paginated"
        title={title === undefined ? m.title : title ?? undefined}
        headerActions={headerActions || (!readOnly && onAdd) ? header : undefined}
        columns={columns}
        rows={rows}
        rowId={(r) => r.methodId}
        state={loading ? 'loading' : error ? 'error' : undefined}
        loadingMessage={m.loading}
        errorMessage={error ?? undefined}
        emptyMessage={
          <EmptyState
            icon={<FontAwesomeIcon icon={faCreditCard} className="h-6 w-6" aria-hidden="true" />}
            title={m.emptyTitle}
            description={readOnly ? undefined : m.emptyDescription}
            action={!readOnly && onAdd ? <Button size="sm" variant="outline" onClick={onAdd}>{m.add}</Button> : undefined}
          />
        }
        filterFields={filterFields}
        defaultSort={[{ key: 'isDefault', dir: 'asc' }]}
        rowActions={rowActions.length > 0 ? rowActions : undefined}
        rowActionsLabel={(r) => fill(m.rowActions, { method: paymentMethodName(r, m) })}
        rowClassName={(r) => (r.status === 'revoked' ? 'opacity-60' : undefined)}
      />
      {onRemove && !readOnly && (
        <ConfirmDialog
          open={removing !== null}
          tone="danger"
          title={m.removeTitle}
          message={removing ? fill(removingIsLast ? m.removeLastMessage : m.removeMessage, { method: paymentMethodName(removing, m) }) : undefined}
          confirmLabel={m.remove}
          cancelLabel={m.cancel}
          busy={busy}
          error={dialogError}
          onConfirm={() => void confirmRemove()}
          onCancel={() => { if (!busy) setRemoving(null); }}
        />
      )}
    </div>
  );
}
