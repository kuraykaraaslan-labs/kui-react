import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDemoEsimAdapter } from './demo-esim';
import { EsimDeviceAction } from './EsimDeviceAction';
import { EsimOperationBadge, esimStateWord } from './EsimOperationBadge';
import { EsimPanel } from './EsimPanel';
import { ESIM_MESSAGES, esimMessagesFrom, flattenEsimMessages } from './messages';
import { esimConfirmText, esimMayBeOnlyUplink, readActivationCode } from './types';

const CAN = { manage: true };
const M = ESIM_MESSAGES;

async function openRowAction(rowText: string, action: string) {
  const row = (await screen.findAllByText(rowText))[0].closest('tr') as HTMLElement;
  await userEvent.click(within(row).getByRole('button', { name: /actions|more/i }));
  await userEvent.click(await screen.findByRole('menuitem', { name: action }));
}

describe('eSIM views (NB iot_esim 01)', () => {
  it('reads an activation code far enough to show its server, and refuses what is not one', () => {
    expect(readActivationCode('LPA:1$smdp.example.com$ABC-123')).toEqual({ host: 'smdp.example.com', confirmationRequired: false });
    expect(readActivationCode(' 1$SMDP.Example.com:8443$X$1.2.3$1 ')).toEqual({ host: 'smdp.example.com', confirmationRequired: true });
    expect(readActivationCode('LPA:2$smdp.example.com$X')).toBeNull();
    expect(readActivationCode('LPA:1$not a host$X')).toBeNull();
    expect(readActivationCode('hello')).toBeNull();
  });

  it('asks for the last six digits of an ICCID and treats anything but Ethernet or Wi-Fi as a possible only uplink', () => {
    expect(esimConfirmText('8990011234567890123')).toBe('890123');
    expect(esimMayBeOnlyUplink('lte')).toBe(true);
    expect(esimMayBeOnlyUplink(null)).toBe(true);
    expect(esimMayBeOnlyUplink('ethernet')).toBe(false);
  });

  it('says Switching and Switched for a switch, and builds every text from a host dictionary', () => {
    expect(esimStateWord('enable', 'running')).toBe('switching');
    expect(esimStateWord('enable', 'succeeded')).toBe('switched');
    expect(esimStateWord('delete', 'succeeded')).toBe('succeeded');
    render(<EsimOperationBadge kind="enable" state="reverted" messages={M} />);
    expect(screen.getByText(M.state.reverted).getAttribute('title')).toBe(M.stateHint.reverted);
    const m = esimMessagesFrom((k) => `T:${k}`);
    expect(m.add.code).toBe('T:add.code');
    expect(Object.keys(flattenEsimMessages()).length).toBeGreaterThan(100);
  });

  it('draws no device button for a router without eSIM, and opens the panel from the button otherwise', async () => {
    const { container } = render(<EsimDeviceAction adapter={createDemoEsimAdapter({ supported: false })} deviceId="d-1" can={CAN} />);
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('[data-esim-action]')).toBeNull();

    render(<EsimDeviceAction adapter={createDemoEsimAdapter()} deviceId="d-1" can={CAN} />);
    await userEvent.click(await screen.findByRole('button', { name: M.action.open }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('Main line')).toBeTruthy();
    expect(within(drawer).getByText('89049032000001000000123456789012')).toBeTruthy();
  });

  it('switches only after the ICCID digits are typed, and shows the switch as running', async () => {
    const adapter = createDemoEsimAdapter();
    render(<EsimPanel adapter={adapter} deviceId="d-1" can={CAN} pollMs={0} />);
    await openRowAction('Vodafone', M.profiles.enable);
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: M.confirm.enableLabel });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(within(dialog).getByRole('textbox'), '210987');
    await userEvent.click(confirm);
    expect(await screen.findAllByText(M.state.switching)).toBeTruthy();
  });

  it('asks to confirm a second uplink before turning off the profile in use on a mobile-only router', async () => {
    render(<EsimPanel adapter={createDemoEsimAdapter({ uplink: 'lte' })} deviceId="d-1" can={CAN} pollMs={0} />);
    await openRowAction('Main line', M.profiles.disable);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(M.confirm.secondUplink)).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox'), '890123');
    const confirm = within(dialog).getByRole('button', { name: M.confirm.disableLabel }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await userEvent.click(within(dialog).getByRole('checkbox'));
    expect(confirm.disabled).toBe(false);
  });

  it('never offers deleting the profile in use', async () => {
    render(<EsimPanel adapter={createDemoEsimAdapter()} deviceId="d-1" can={CAN} pollMs={0} />);
    const row = (await screen.findByText('Main line')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: /actions|more/i }));
    const item = await screen.findByRole('menuitem', { name: new RegExp(M.profiles.delete) });
    expect(item.getAttribute('aria-disabled') === 'true' || (item as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds a profile from an activation code, forgets the code and lists the download', async () => {
    const adapter = createDemoEsimAdapter();
    render(<EsimPanel adapter={adapter} deviceId="d-1" can={CAN} inDrawer pollMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: M.profiles.add }));
    const code = screen.getByLabelText(new RegExp(M.add.code)) as HTMLInputElement;
    expect(code.type).toBe('password');
    await userEvent.type(code, 'LPA:1$smdp.operator.example$MATCH-1');
    expect(screen.getByText('Profile server: smdp.operator.example')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: M.add.submit }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: M.confirm.downloadLabel }));
    expect(await screen.findByText(M.add.started)).toBeTruthy();
    expect(screen.queryByDisplayValue(/MATCH-1/)).toBeNull();
    act(() => adapter.step());
    await waitFor(async () => expect((await adapter.operations('d-1', {}))[0].state).toBe('succeeded'));
  });

  it('is read only without the manage ability', async () => {
    render(<EsimPanel adapter={createDemoEsimAdapter()} deviceId="d-1" pollMs={0} />);
    expect(await screen.findByText(M.common.viewOnly)).toBeTruthy();
    expect(screen.queryByRole('button', { name: M.profiles.add })).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp(M.profiles.refresh) })).toBeTruthy();
  });
});
