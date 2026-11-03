import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportWizard } from './ImportWizard';
import { createDemoImportAdapter } from './demo-import';
import { detectDelimiter, guessMapping, parseCsvPreview, templateCsv } from './csv';
import { IMPORT_WIZARD_MESSAGES as M, flattenImportWizardMessages, importWizardMessagesFrom } from './messages';

const csv = (text: string, name = 'devices.csv') => new File([text], name, { type: 'text/csv' });

async function upload(text: string, target = 'iot_devices') {
  await userEvent.selectOptions(await screen.findByLabelText(M.file.target), target);
  const input = document.getElementById('import-file') as HTMLInputElement;
  await userEvent.upload(input, csv(text));
  await waitFor(() => expect(screen.getByRole('button', { name: M.common.next }).hasAttribute('disabled')).toBe(false));
  await userEvent.click(screen.getByRole('button', { name: M.common.next }));
}

describe('ImportWizard csv helpers', () => {
  it('detects the delimiter outside quotes and reads quoted cells', () => {
    expect(detectDelimiter('a;b;"c,d"\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n')).toBe('\t');
    expect(parseCsvPreview('name,note\r\n"pump, north","said ""hi""\nthen"\r\nx,y', ',')).toEqual([['name', 'note'], ['pump, north', 'said "hi"\nthen'], ['x', 'y']]);
  });
  it('guesses the mapping from names and labels, takes prefixed columns as they are, and writes a safe template', () => {
    expect(guessMapping(['Device name', 'serial', 'attr:floor', 'other'], [{ name: 'name', label: 'Device name' }, { name: 'serial', label: 'Serial' }], ['attr:']))
      .toEqual({ 'Device name': 'name', serial: 'serial', 'attr:floor': 'attr:floor' });
    expect(templateCsv([{ name: 'name', example: '=SUM(A1)' }, { name: 'note', example: 'a,b' }])).toBe('name,note\r\n\'=SUM(A1),"a,b"\r\n');
  });
  it('builds every text from a host dictionary', () => {
    expect(Object.keys(flattenImportWizardMessages()).length).toBeGreaterThan(80);
    expect(importWizardMessagesFrom((k) => `T:${k}`).check.import).toBe('T:check.import');
  });
});

describe('ImportWizard', () => {
  it('maps, checks every row with the problems in words, imports through the ConfirmDialog, downloads once and undoes', async () => {
    const onDownload = vi.fn();
    const onChanged = vi.fn();
    render(<ImportWizard adapter={createDemoImportAdapter({ delayMs: 0, onDownload })} onChanged={onChanged} />);
    await upload('Device name,serial,attr:floor\npump-1,SN1,2\n,SN2,3\npump-1,SN3,1\npump-4,SN4,0\n');
    expect((screen.getByLabelText(/^Device name/) as HTMLSelectElement).value).toBe('Device name');
    expect(screen.getAllByText('attr:floor').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: M.columns.check }));
    expect(await screen.findByText('Device name is empty. Every row needs one.')).toBeTruthy();
    expect(screen.getByText('"pump-1" appears earlier in this file. Each one may appear once.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Import 2 rows' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    expect(within(confirm).getByText(/You can undo this import afterwards/)).toBeTruthy();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Import 2 rows' }));
    expect(await screen.findByText(M.result.done)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Download the credentials' }));
    expect(await screen.findByText(M.result.followUpDone)).toBeTruthy();
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Download the credentials' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: M.result.undo }));
    const undo = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(undo).getByRole('button', { name: M.result.undo }));
    expect(await screen.findByText(M.result.undone)).toBeTruthy();
    expect(onChanged.mock.calls.map((c) => c[0].status)).toEqual(['AWAITING_REVIEW', 'COMPLETED', 'UNDONE']);
  });

  it('does not check before every required field has a column, and offers no undo for a target that cannot', async () => {
    render(<ImportWizard adapter={createDemoImportAdapter({ delayMs: 0 })} />);
    await upload('mail,first\na@example.com,Ayşe\n', 'contact');
    expect(screen.getByText(/Pick a column for every required field: Email/)).toBeTruthy();
    expect(screen.getByRole('button', { name: M.columns.check }).hasAttribute('disabled')).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText(/^Email/), 'mail');
    await userEvent.click(screen.getByRole('button', { name: M.columns.check }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 1 rows' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    expect(within(confirm).getByText(/This import cannot be undone/)).toBeTruthy();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Import 1 rows' }));
    expect(await screen.findByText(M.result.done)).toBeTruthy();
    expect(screen.queryByRole('button', { name: M.result.undo })).toBeNull();
  });
});
