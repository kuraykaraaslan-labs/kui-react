import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  CertificateDetailCard, CertificateStatusBadge, CertificateTable, RecoveryRequestCard, RecoveryRequestTable, RevokeCertificateDialog,
  certificateDaysLeft, renewOffered,
} from '.';
import type { DeviceCertificate, RecoveryRequest } from '.';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const DAY = 86_400_000;
const cert = (over: Partial<DeviceCertificate> = {}): DeviceCertificate => ({
  certificateId: 'c1', deviceSerial: 'RT-000123', subjectCn: 'RT-000123', issuerCaId: 'ca-1', issuerName: 'Roltek Device Issuing CA G1',
  serialNumberHex: '7f3a91', fingerprintSha256: 'ab'.repeat(32), keyAlg: 'EC-P256', notBefore: new Date(NOW - 300 * DAY).toISOString(),
  notAfter: new Date(NOW + 65 * DAY).toISOString(), status: 'ACTIVE', revokedAt: null, revocationReason: null, issuedVia: 'BOOTSTRAP',
  serverKeygen: false, supersedesCertificateId: null, firstSeenAt: new Date(NOW - 299 * DAY).toISOString(), renewRequestedAt: null, ...over,
});
const recovery = (over: Partial<RecoveryRequest> = {}): RecoveryRequest => ({
  recoveryId: 'r1', deviceSerial: 'RT-000123', deviceId: 'd1', currentCertificateId: 'c1', keygen: false, keyId: 'cd'.repeat(32), status: 'PENDING',
  otherKeyAttempts: 0, requestedAt: new Date(NOW - 3_600_000).toISOString(), lastAttemptAt: new Date(NOW - 600_000).toISOString(),
  expiresAt: new Date(NOW + 6 * DAY).toISOString(), decidedAt: null, revocationReason: null, issuedCertificateId: null, usedAt: null, ...over,
});

describe('device certificate components (NB iot_pki 03 §3.5)', () => {
  it('the badge shows the state, and the days left once fewer than 30 remain', () => {
    const { rerender } = render(<CertificateStatusBadge certificate={cert()} now={NOW} />);
    expect(screen.getByText('Active')).toBeTruthy();
    rerender(<CertificateStatusBadge certificate={cert({ notAfter: new Date(NOW + 12.5 * DAY).toISOString() })} now={NOW} />);
    expect(screen.getByText('Active · 12 days left')).toBeTruthy();
    rerender(<CertificateStatusBadge certificate={cert({ status: 'REVOKED' })} now={NOW} />);
    expect(screen.getByText('Revoked')).toBeTruthy();
    rerender(<CertificateStatusBadge certificate={cert({ notAfter: new Date(NOW - DAY).toISOString() })} now={NOW} />);
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('Renew is offered below 30 days or for a platform-generated key, never on a certificate that is not active', () => {
    expect(certificateDaysLeft(cert(), NOW)).toBe(65);
    expect(renewOffered(cert(), NOW)).toBe(false);
    expect(renewOffered(cert({ notAfter: new Date(NOW + 29 * DAY).toISOString() }), NOW)).toBe(true);
    expect(renewOffered(cert({ serverKeygen: true }), NOW)).toBe(true);
    expect(renewOffered(cert({ serverKeygen: true, status: 'SUPERSEDED' }), NOW)).toBe(false);
  });

  it('the detail card asks before renewing and shows a refusal in the dialog', async () => {
    const onRenew = vi.fn().mockRejectedValueOnce(new Error('The device is offline.')).mockResolvedValueOnce(undefined);
    render(<CertificateDetailCard certificate={cert({ notAfter: new Date(NOW + 20 * DAY).toISOString() })} now={NOW} onRenew={onRenew} />);
    expect(screen.getByText('Roltek Device Issuing CA G1')).toBeTruthy();
    expect(screen.getByText(/expires in 20 days/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Renew certificate' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask to renew' }));
    expect(await within(dialog).findByText('The device is offline.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask to renew' }));
    await waitFor(() => expect(onRenew).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('no Renew while plenty of time is left; a platform-generated key is called out', () => {
    render(<CertificateDetailCard certificate={cert({ serverKeygen: false })} now={NOW} onRenew={vi.fn()} onRevoke={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Renew certificate' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeTruthy();
  });

  it('revoking takes a reason from the select and the serial typed again', async () => {
    const onConfirm = vi.fn();
    render(<RevokeCertificateDialog open certificate={cert()} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Revoke certificate' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'cessationOfOperation' } });
    fireEvent.change(within(dialog).getByLabelText(/Type the serial RT-000123/), { target: { value: 'RT-000123' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('cessationOfOperation');
    expect(within(dialog).queryByRole('option', { name: 'Superseded' })).toBeNull();
  });

  it('a pending recovery is approved with the chosen reason or rejected; attempts with another key are a warning', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<RecoveryRequestCard recovery={recovery({ otherKeyAttempts: 2 })} now={NOW} onDecide={onDecide} />);
    expect(screen.getByText(/tried 2 times with another key/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Revoke the current certificate as'), { target: { value: 'superseded' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith({ decision: 'APPROVE', revocationReason: 'superseded' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(onDecide).toHaveBeenLastCalledWith({ decision: 'REJECT' }));
  });

  it('a decided or expired request has no buttons', () => {
    const { rerender } = render(<RecoveryRequestCard recovery={recovery({ status: 'REJECTED', decidedAt: new Date(NOW).toISOString() })} now={NOW} onDecide={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    rerender(<RecoveryRequestCard recovery={recovery({ expiresAt: new Date(NOW - 1).toISOString() })} now={NOW} onDecide={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('the tables list their rows and open one', () => {
    const onOpen = vi.fn();
    render(<CertificateTable rows={[cert(), cert({ certificateId: 'c2', deviceSerial: 'RT-000999', status: 'REVOKED' })]} now={NOW} onOpen={onOpen} />);
    expect(screen.getByText('RT-000999')).toBeTruthy();
    fireEvent.click(screen.getByText('RT-000123'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ certificateId: 'c1' }));
    render(<RecoveryRequestTable rows={[recovery({ otherKeyAttempts: 3 })]} now={NOW} />);
    expect(screen.getByText('Waiting for approval')).toBeTruthy();
    expect(screen.getByText('3').className).toContain('text-warning-fg');
  });
});
