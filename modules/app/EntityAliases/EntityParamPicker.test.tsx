import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityParamPicker } from './EntityParamPicker';
import { AliasEntitySelect } from './AliasEntitySelect';
import { DEMO_ENTITIES } from './demo-access';
import type { EntityRef } from './types';

const devices = DEMO_ENTITIES.filter((e) => e.type === 'iot_device');
const search = vi.fn(async (q: string) => devices.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())));
const byIds = vi.fn(async (ids: string[]) => devices.filter((e) => ids.includes(e.id)));

function Harness({ multiple = false, initial, onPick, current, required, readOnly }: {
  multiple?: boolean;
  initial?: string | string[];
  onPick?: (v: string | string[]) => void;
  current?: EntityRef | null;
  required?: boolean;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState<string | string[] | undefined>(initial);
  return (
    <EntityParamPicker
      label="Pump"
      multiple={multiple}
      value={value}
      loadOptions={search}
      resolve={byIds}
      current={current}
      onChange={(v) => { setValue(v); onPick?.(v); }}
      required={required}
      readOnly={readOnly}
    />
  );
}

const pickOption = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
  user.click(within(await screen.findByRole('option', { name })).getByRole('button'));

describe('EntityParamPicker', () => {
  it('is a search box: typing a name asks for the matching entities, a pick is stored by id', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Harness onPick={onPick} />);
    const box = screen.getByRole('searchbox');
    await user.type(box, 'tank');
    await waitFor(() => expect(search).toHaveBeenLastCalledWith('tank'));
    await pickOption(user, /Tank A/);
    expect(onPick).toHaveBeenLastCalledWith('d3');
    expect(box).toHaveValue('Tank A');
  });

  it("names a pick no search returned (a link's) through resolve", async () => {
    render(<Harness initial="d2" />);
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('Pump 2'));
    expect(byIds).toHaveBeenCalledWith(['d2']);
  });

  it('shows the entity in effect with no pick (the set\'s first) and never writes it', async () => {
    const onPick = vi.fn();
    render(<Harness current={devices[0]} onPick={onPick} required />);
    expect(screen.getByRole('searchbox')).toHaveValue('Pump 1');
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull();
  });

  it('an optional pick can be cleared; a required one cannot', async () => {
    const onPick = vi.fn();
    const { unmount } = render(<Harness initial="d1" onPick={onPick} />);
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('Pump 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onPick).toHaveBeenLastCalledWith('');
    unmount();
    render(<Harness initial="d1" required />);
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('Pump 1'));
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull();
  });

  it('many are chips, searched and added by name', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Harness multiple initial={['d1']} onPick={onPick} />);
    await waitFor(() => expect(screen.getByText('Pump 1')).toBeInTheDocument());
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search…'), 'tank');
    await waitFor(() => expect(search).toHaveBeenLastCalledWith('tank'));
    await user.click(await screen.findByRole('option', { name: /Tank A/ }));
    expect(onPick).toHaveBeenLastCalledWith(['d1', 'd3']);
  });

  it('read-only shows the entity in a disabled box and changes nothing', async () => {
    render(<Harness initial="d3" readOnly />);
    const box = screen.getByRole('searchbox');
    await waitFor(() => expect(box).toHaveValue('Tank A'));
    expect(box).toBeDisabled();
  });
});

describe('AliasEntitySelect, built of the same picker', () => {
  it('a pick in the popover is a search box and names the alias it is for', async () => {
    const onChange = vi.fn();
    const load = vi.fn(async (_key: string, q: string) => devices.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())));
    const user = userEvent.setup();
    render(<AliasEntitySelect items={[{ aliasKey: 'tank', aliasName: 'Tank', current: devices[0] }]} loadOptions={load} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Pump 1/ }));
    await user.type(screen.getByRole('searchbox'), 'tank');
    await waitFor(() => expect(load).toHaveBeenLastCalledWith('tank', 'tank'));
    await pickOption(user, /Tank A/);
    expect(onChange).toHaveBeenCalledWith('tank', 'd3');
  });
});
