import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoraGatewayForm, LoraGatewayPanel, LoraStationSetup } from '.';

/** NB iot_lorawan LWP-1…LWP-4: client-certificate gateways and the Station files in one zip. */
const gw = { gatewayId: 'g1', name: 'Roof', eui: 'AA555A0000000001', protocol: 'BASICS_STATION' as const, status: 'ACTIVE' as const, region: 'EU868', lastSeenAt: null };
const setup = { lnsUrl: 'wss://lns.example.com', routerInfoUrl: 'wss://lns.example.com/router-info', trustAvailable: true, clientCertAvailable: true };
const CSR = '-----BEGIN CERTIFICATE REQUEST-----\nMIIC\n-----END CERTIFICATE REQUEST-----';
const certFiles = [{ name: 'tc.uri', content: 'u' }, { name: 'tc.trust', content: 't' }, { name: 'tc.crt', content: 'c' }, { name: 'tc.key', content: 'k' }];

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });

describe('client-certificate gateways', () => {
  it('the form offers a client certificate only when the host can admit one', () => {
    const { rerender } = render(<LoraGatewayForm onSubmit={() => undefined} />);
    expect(screen.queryByLabelText('Sign-in', { exact: false })).toBeNull();
    rerender(<LoraGatewayForm onSubmit={() => undefined} clientCertAvailable />);
    expect(screen.getByLabelText('Sign-in', { exact: false })).toBeTruthy();
  });

  it('a generated key and a CSR are handed on as the certificate spec; a CSR that is not a whole request is refused', () => {
    const onSubmit = vi.fn();
    render(<LoraGatewayForm onSubmit={onSubmit} clientCertAvailable />);
    fill('Name', 'Roof');
    fill('Gateway EUI', 'aa-55-5a-00-00-00-00-01');
    fill('Sign-in', 'CLIENT_CERT');
    fireEvent.click(screen.getByRole('button', { name: 'Add gateway' }));
    expect(onSubmit).toHaveBeenLastCalledWith({ name: 'Roof', eui: 'AA555A0000000001', region: 'EU868', authType: 'CLIENT_CERT', certificate: { generateKey: true } });
    fill('Key', 'csr');
    fill('Certificate request (PEM)', 'nope');
    fireEvent.click(screen.getByRole('button', { name: 'Add gateway' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/BEGIN CERTIFICATE REQUEST to END/)).toBeTruthy();
    fill('Certificate request (PEM)', CSR);
    fireEvent.click(screen.getByRole('button', { name: 'Add gateway' }));
    expect(onSubmit).toHaveBeenLastCalledWith({ name: 'Roof', eui: 'AA555A0000000001', region: 'EU868', authType: 'CLIENT_CERT', certificate: { csrPem: CSR } });
  });

  it('the setup card shows the certificate files once, says whose key it is, and offers them in one zip', () => {
    const onDownload = vi.fn();
    const onDownloadAll = vi.fn();
    const { rerender } = render(<LoraStationSetup gateway={{ ...gw, authType: 'CLIENT_CERT' }} setup={setup} issuedCert={{ keyIncluded: true, files: certFiles }} onDownload={onDownload} onDownloadAll={onDownloadAll} />);
    expect(screen.getByText(/Set the gateway certificate \(tc\.crt\)/)).toBeTruthy();
    expect(screen.getByText(/private key \(tc\.key\) is shown only now/)).toBeTruthy();
    expect(screen.queryByText(/Bearer/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Download all (.zip)' }));
    expect(onDownloadAll).toHaveBeenCalledWith(certFiles);
    fireEvent.click(screen.getByRole('button', { name: 'Download tc.crt' }));
    expect(onDownload).toHaveBeenCalledWith({ name: 'tc.crt', content: 'c' });
    rerender(<LoraStationSetup gateway={{ ...gw, authType: 'CLIENT_CERT' }} setup={setup} issuedCert={{ keyIncluded: false, files: certFiles.slice(0, 3) }} />);
    expect(screen.getByText(/never left the gateway/)).toBeTruthy();
    rerender(<LoraStationSetup gateway={{ ...gw, authType: 'CLIENT_CERT' }} setup={setup} />);
    expect(screen.getByText(/Issue a new certificate/)).toBeTruthy();
  });

  it('a token gateway gets the zip too; the panel names the re-issue of a certificate gateway', () => {
    const onDownloadAll = vi.fn();
    const files = [{ name: 'tc.uri', content: 'u' }, { name: 'tc.key', content: 'k' }];
    render(<LoraStationSetup gateway={gw} setup={setup} issued={{ token: 'lns_x', files }} onDownloadAll={onDownloadAll} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download all (.zip)' }));
    expect(onDownloadAll).toHaveBeenCalledWith(files);
    render(<LoraGatewayPanel gateway={{ ...gw, authType: 'CLIENT_CERT' }} setup={setup} frames={[]} onRotate={() => undefined} />);
    expect(screen.getByRole('button', { name: 'New certificate' })).toBeTruthy();
  });
});
