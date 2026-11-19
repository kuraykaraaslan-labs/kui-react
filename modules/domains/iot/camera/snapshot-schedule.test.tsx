import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SnapshotSchedule } from './SnapshotSchedule';

const NEXT = '2026-11-19T10:15:00Z';
const LAST = '2026-11-19T10:00:00Z';

describe('SnapshotSchedule', () => {
  it('starts off for a camera with no schedule; switching on offers 15 minutes; Save sends the interval, and nothing is sent before Save', () => {
    const onSave = vi.fn();
    render(<SnapshotSchedule intervalMin={null} canManage onSave={onSave} timeZone="UTC" locale="en" />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled(); // nothing changed
    fireEvent.click(screen.getByRole('switch', { name: /^Take a picture by itself/ }));
    const n = screen.getByLabelText('Every (minutes)') as HTMLInputElement;
    expect(n.value).toBe('15');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(n, { target: { value: '5' } });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(5);
  });

  it('refuses a value outside the bounds or not whole, in words, and keeps Save off', () => {
    const onSave = vi.fn();
    render(<SnapshotSchedule intervalMin={10} canManage onSave={onSave} min={1} max={1440} />);
    const n = screen.getByLabelText('Every (minutes)');
    for (const bad of ['0', '1441', '2.5', '']) {
      fireEvent.change(n, { target: { value: bad } });
      expect(screen.getByText('Enter a whole number of minutes from 1 to 1440.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    }
    expect(onSave).not.toHaveBeenCalled();
  });

  it('switching a schedule off saves null', () => {
    const onSave = vi.fn();
    render(<SnapshotSchedule intervalMin={10} canManage onSave={onSave} />);
    fireEvent.click(screen.getByRole('switch', { name: /^Take a picture by itself/ }));
    expect(screen.queryByLabelText('Every (minutes)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('a running schedule shows the next and the last picture', () => {
    render(<SnapshotSchedule intervalMin={15} nextAt={NEXT} lastAt={LAST} canManage onSave={() => undefined} timeZone="UTC" locale="en" />);
    expect(screen.getByText(/^Next picture about /)).toBeInTheDocument();
    expect(screen.getByText(/^Last scheduled picture: /)).toBeInTheDocument();
  });

  it('a paused schedule says why in the host\'s words, hides the next time, and is resumed by saving it unchanged ("Try again")', () => {
    const onSave = vi.fn();
    const { container } = render(
      <SnapshotSchedule intervalMin={15} nextAt={NEXT} pausedReason="camera_error" reasonLabel={(r) => (r === 'camera_error' ? 'The camera did not answer' : r)} canManage onSave={onSave} />,
    );
    expect(container.querySelector('[data-kind="paused"]')).toHaveTextContent('The camera did not answer');
    expect(screen.queryByText(/^Next picture about /)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onSave).toHaveBeenCalledWith(15);
  });

  it('a reader who may not change it sees the schedule in words only, with no control', () => {
    const { rerender } = render(<SnapshotSchedule intervalMin={30} canManage={false} onSave={() => undefined} />);
    expect(screen.getByText('A picture is taken every 30 minutes.')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<SnapshotSchedule intervalMin={null} canManage={false} onSave={() => undefined} />);
    expect(screen.getByText('Pictures are taken only when someone asks.')).toBeInTheDocument();
  });

  it('while saving every control is disabled, and a refusal is shown in the host\'s words', () => {
    render(<SnapshotSchedule intervalMin={15} canManage saving error="This camera cannot take a picture." onSave={() => undefined} />);
    expect(screen.getByRole('switch', { name: /^Take a picture by itself/ })).toBeDisabled();
    expect(screen.getByLabelText('Every (minutes)')).toBeDisabled();
    expect(screen.getByText('This camera cannot take a picture.')).toBeInTheDocument();
  });

  it('takes the host\'s translations', () => {
    render(<SnapshotSchedule intervalMin={null} canManage={false} onSave={() => undefined} messages={{ snapshotSchedule: { off: 'Yalnızca istendiğinde resim alınır.' } }} />);
    expect(screen.getByText('Yalnızca istendiğinde resim alınır.')).toBeInTheDocument();
  });
});
