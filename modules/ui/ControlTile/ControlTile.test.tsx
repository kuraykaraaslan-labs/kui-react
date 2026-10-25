import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlButton, ControlSetpoint, ControlSlider, ControlSwitch, ControlTile } from './index';
import { asBoolean, snapToStep, toRange, validateSetpoint } from './control-logic';

describe('control-logic', () => {
  it('asBoolean reads common spellings and rejects the rest', () => {
    expect(asBoolean('On')).toBe(true);
    expect(asBoolean(0)).toBe(false);
    expect(asBoolean(2)).toBeNull();
    expect(asBoolean('maybe')).toBeNull();
  });
  it('toRange fixes an inverted range and a bad step', () => {
    expect(toRange({ min: 10, max: 5, step: -1 })).toEqual({ min: 10, max: 11, step: 1 });
  });
  it('validateSetpoint refuses empty, NaN and out-of-range', () => {
    const r = toRange({ min: 0, max: 10 });
    expect(validateSetpoint('', r)).toEqual({ ok: false, reason: 'empty' });
    expect(validateSetpoint('x', r)).toEqual({ ok: false, reason: 'nan' });
    expect(validateSetpoint('11', r)).toEqual({ ok: false, reason: 'range' });
    expect(validateSetpoint('5', r)).toEqual({ ok: true, value: 5 });
  });
  it('snapToStep removes float noise and clamps', () => {
    const r = toRange({ min: 0, max: 1, step: 0.1 });
    expect(snapToStep(0.30000000004, r)).toBe(0.3);
    expect(snapToStep(5, r)).toBe(1);
  });
});

describe('ControlSwitch', () => {
  it('commits the toggled value and shows the status line', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<ControlSwitch title="Heater" value={false} onCommit={onCommit} />);
    await userEvent.setup().click(screen.getByRole('switch'));
    expect(onCommit).toHaveBeenCalledWith(true);
    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
  });
  it('rolls back and shows the failure on a rejected commit', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('Device offline'));
    render(<ControlSwitch title="Heater" value={false} onCommit={onCommit} />);
    await userEvent.setup().click(screen.getByRole('switch'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Device offline');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });
  it('read-only blocks the control and says why', () => {
    render(<ControlSwitch title="Heater" value readOnly onCommit={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByText(/do not have permission/)).toBeInTheDocument();
  });
});

describe('ControlSetpoint', () => {
  it('shows a field error and sends nothing for an out-of-range entry', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ControlSetpoint title="Target" value={20} min={5} max={30} onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Target' });
    await user.clear(input);
    await user.type(input, '99{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('between 5 and 30');
    expect(onCommit).not.toHaveBeenCalled();
  });
  it('commits a valid number on Enter', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ControlSetpoint title="Target" value={20} min={5} max={30} onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Target' });
    await user.clear(input);
    await user.type(input, '22{Enter}');
    expect(onCommit).toHaveBeenCalledWith(22);
  });
});

describe('ControlButton', () => {
  it('is an ordinary button without `pressed`, and a toggle announced by aria-pressed with it', () => {
    const { rerender } = render(<ControlButton label="Fan" onCommit={async () => {}} />);
    expect(screen.getByRole('button', { name: 'Fan' })).not.toHaveAttribute('aria-pressed');
    rerender(<ControlButton label="Fan" pressed={false} onCommit={async () => {}} />);
    expect(screen.getByRole('button', { name: 'Fan' })).toHaveAttribute('aria-pressed', 'false');
    rerender(<ControlButton label="Fan" pressed onCommit={async () => {}} />);
    expect(screen.getByRole('button', { name: 'Fan', pressed: true })).toHaveAttribute('data-pressed', 'true');
    rerender(<ControlButton label="Fan" layout="icon" pressed onCommit={async () => {}} />);
    expect(screen.getByRole('button', { name: 'Fan' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fires immediately without a confirmation policy', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<ControlButton label="Reboot" onCommit={onCommit} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reboot' }));
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });
  it('typed confirmation needs the exact text and passes it on', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ControlButton label="Wipe" confirm="typed" confirmText="wipe-dev" onCommit={onCommit} />);
    await user.click(screen.getByRole('button', { name: 'Wipe' }));
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByRole('textbox'), 'wipe-dev');
    await user.click(confirm);
    expect(onCommit).toHaveBeenCalledWith({ confirmed: true, typed: 'wipe-dev' });
  });
});

describe('layouts and parts', () => {
  it('ControlButton: a round icon button is named by its label; a pill puts the icon after the text', () => {
    const { rerender } = render(<ControlButton label="Power" layout="icon" icon={<span data-testid="ic" />} onCommit={vi.fn()} />);
    const round = screen.getByRole('button', { name: 'Power' });
    expect(round.className).toContain('rounded-full');
    expect(round).toContainElement(screen.getByTestId('ic'));
    rerender(<ControlButton label="Go" layout="fab" iconPosition="end" icon={<span data-testid="ic" />} onCommit={vi.fn()} />);
    const pill = screen.getByRole('button', { name: 'Go' });
    expect(pill.lastElementChild).toBe(screen.getByTestId('ic').parentElement ?? screen.getByTestId('ic'));
  });
  it('ControlSwitch: renderLayout receives the parts; the state element describes the switch', () => {
    render(
      <ControlSwitch value onCommit={vi.fn()} label="Pump" colors={{ thumbOn: '#ff0000' }}
        renderLayout={(p) => <div>{p.control}<span id={p.stateId}>{p.state}:{p.stateText}</span></div>} />,
    );
    expect(screen.getByText('on:On')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAccessibleDescription('on:On');
  });
  it('ControlSlider: vertical, tick labels, sizes and renderLayout parts', () => {
    render(
      <ControlSlider value={50} min={0} max={100} tickMarks={3} tickLabels orientation="vertical" thickness={8} thumbSize={20}
        ariaLabel="Speed" onCommit={vi.fn()}
        renderLayout={(p) => <div>{p.slider}<span>{p.minText}|{p.valueText}|{p.maxText}</span></div>} />,
    );
    const input = screen.getByRole('slider', { name: 'Speed' });
    expect(input).toHaveAttribute('aria-orientation', 'vertical');
    expect(input.style.width).toBe('8px');
    expect(input.style.getPropertyValue('--kui-slider-thumb-size')).toBe('20px');
    expect(screen.getByText('0|50|100')).toBeInTheDocument();
    expect(screen.getAllByText('50')).toHaveLength(1);
  });
  it('ControlSlider: no value reads "—", not the minimum the thumb rests on', () => {
    render(
      <ControlSlider value={null} min={10} max={100} ariaLabel="Speed" onCommit={vi.fn()}
        renderLayout={(p) => <div>{p.slider}<span>{p.minText}|{p.valueText}|{p.maxText}</span></div>} />,
    );
    expect(screen.getByText('10|—|100')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Speed' })).toHaveAttribute('aria-valuetext', '—');
  });
  it('ControlSetpoint: the dial steps and renders its value through renderValue', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <ControlSetpoint value={20} min={0} max={40} step={2} layout="dial" ariaLabel="Target" buttonTextColor="#00ff00"
        renderValue={(text) => <b>{text}!</b>} onCommit={onCommit} />,
    );
    expect(container.querySelectorAll('svg circle')).toHaveLength(2);
    expect(screen.getByText('20!')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Target' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Increase' }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(22));
  });
  it('ControlSetpoint: presses in a row show at once and are written as one value once they settle', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<ControlSetpoint value={20} min={0} max={40} step={2} layout="stepper" ariaLabel="Target" settleMs={200} onCommit={onCommit} />);
    const user = userEvent.setup();
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Increase' }));
    expect(screen.getByRole('group', { name: 'Target' })).toHaveTextContent('26');
    expect(onCommit).not.toHaveBeenCalled();
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    expect(onCommit).toHaveBeenCalledWith(26);
  });
  it('ControlSetpoint: settleMs 0 writes every press', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<ControlSetpoint value={20} min={0} max={40} step={2} layout="stepper" ariaLabel="Target" settleMs={0} onCommit={onCommit} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Decrease' }));
    expect(onCommit).toHaveBeenCalledWith(18);
  });
  it('ControlTile: a host failure text leads and keeps the reason; unframed can put the control at the bottom', () => {
    const { container, rerender } = render(<ControlTile state="failed" error="Offline" messages={{ failed: 'Could not switch' }}>x</ControlTile>);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not switch (Offline)');
    rerender(<ControlTile state="failed" error="Offline">x</ControlTile>);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Offline$/);
    rerender(<ControlTile state="idle" framed={false} bodyAlign="end">x</ControlTile>);
    expect(container.querySelector('.justify-end')).not.toBeNull();
  });
});
