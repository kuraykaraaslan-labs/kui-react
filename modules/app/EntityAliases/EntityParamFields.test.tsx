import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityParamFields } from './EntityParamFields';
import { DEMO_ENTITIES, demoAccess } from './demo-access';
import { validateEntityParam, type EntityParamErrors } from './entity-params';
import type { EntityAliasesAccess, EntityParam, ParamPeer } from './types';

const SITE: ParamPeer = { kind: 'entity', key: 'site', label: 'Site', entityType: 'iot_asset', choose: { type: 'viewer' } };
const START: EntityParam = { kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'viewer' } };

function Harness({
  access = demoAccess(),
  initial = START,
  advanced = false,
  errors,
  onParam,
}: {
  access?: EntityAliasesAccess;
  initial?: EntityParam;
  advanced?: boolean;
  errors?: EntityParamErrors;
  onParam?: (p: EntityParam) => void;
}) {
  const [param, setParam] = useState<EntityParam>(initial);
  return (
    <EntityParamFields
      value={param}
      onChange={(p) => { setParam(p); onParam?.(p); }}
      params={[param, SITE, { key: 'limit', label: 'Limit' }]}
      access={access}
      advanced={advanced}
      errors={errors}
    />
  );
}

const select = (label: RegExp) => screen.getByLabelText(label) as HTMLSelectElement;
const optionLabels = (el: HTMLSelectElement) => within(el).getAllByRole('option').map((o) => o.textContent);

describe('EntityParamFields', () => {
  it('asks no path or key: an entity type, how it is chosen, one or many, the filter bar, a default searched by name', async () => {
    render(<Harness />);
    expect(await screen.findByRole('option', { name: 'Device' })).toBeInTheDocument();
    expect(select(/How is it chosen/)).toHaveValue('viewer');
    expect(screen.getByText('Viewers pick in the filter bar by typing a name.')).toBeInTheDocument();
    expect(select(/One or many/)).toHaveValue('one');
    expect(select(/In the filter bar/)).toHaveValue('edit');
    expect(screen.getAllByLabelText(/Default entity/)[0]).toBeInTheDocument();
    expect(screen.getByLabelText('With no value, take the first')).toBeInTheDocument();
    expect(screen.queryByText(/endpoint|search key|value key/i)).toBeNull();
  });

  it('offers every choice in plain words, the relation one only with a relation source', async () => {
    const { unmount } = render(<Harness />);
    await waitFor(() => expect(optionLabels(select(/How is it chosen/))).toEqual([
      'The viewer picks', 'The page or a link sets it', 'Fixed: one entity', 'Fixed: a list', 'All of the type', 'By name',
      'By subtype or profile', 'Related to another parameter or entity',
    ]));
    unmount();
    render(<Harness access={demoAccess({ relationProviders: async () => [] })} />);
    expect(await screen.findByRole('option', { name: 'Device' })).toBeInTheDocument();
    expect(optionLabels(select(/How is it chosen/))).not.toContain('Related to another parameter or entity');
  });

  it('a fixed entity is searched by name and stored by id; it is one and has no picker in the bar', async () => {
    const onParam = vi.fn();
    render(<Harness onParam={onParam} />);
    fireEvent.change(select(/How is it chosen/), { target: { value: 'single' } });
    expect(screen.queryByLabelText(/One or many/)).toBeNull();
    expect(optionLabels(select(/In the filter bar/))).toEqual(['Shown, not changeable', 'Hidden']);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search entities…'), 'Tank');
    await user.click(within(await screen.findByRole('option', { name: /Tank A/ })).getByRole('button'));
    expect(onParam).toHaveBeenLastCalledWith({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'single', id: 'd3' }, viewer: 'hidden' });
  });

  it('a page choice follows a link or another parameter of one entity, and has no filter-bar mode', async () => {
    const onParam = vi.fn();
    render(<Harness onParam={onParam} initial={{ ...START, entityType: 'iot_asset' }} />);
    fireEvent.change(select(/How is it chosen/), { target: { value: 'page' } });
    expect(screen.queryByLabelText(/In the filter bar/)).toBeNull();
    expect(optionLabels(select(/Taken from/))).toEqual(['A link, a page or a button', 'Site', 'Limit']);
    fireEvent.change(select(/Taken from/), { target: { value: 'site' } });
    // following a parameter is its only way to a value: it takes the first of its set (the followed entity)
    expect(onParam).toHaveBeenLastCalledWith({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_asset', choose: { type: 'page', param: 'site' }, defaultFrom: 'firstOption' });
    expect(screen.queryByLabelText(/Default entity/)).toBeNull();
    expect(screen.queryByLabelText('With no value, take the first')).toBeNull();
    fireEvent.change(select(/Taken from/), { target: { value: '' } });
    expect(onParam).toHaveBeenLastCalledWith({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_asset', choose: { type: 'page' } });
  });

  it('a relation starts from another parameter; its details are under Advanced only', async () => {
    const onParam = vi.fn();
    const { rerender } = render(<Harness onParam={onParam} />);
    await waitFor(() => expect(optionLabels(select(/How is it chosen/))).toContain('Related to another parameter or entity'));
    fireEvent.change(select(/How is it chosen/), { target: { value: 'related' } });
    expect(select(/Related to/)).toHaveValue('site');
    expect(optionLabels(select(/Related to/))).toEqual(['Site', 'A fixed entity']);
    expect(screen.queryByLabelText(/Direction/)).toBeNull();
    expect(screen.queryByLabelText(/Relation type/)).toBeNull();
    rerender(<Harness onParam={onParam} advanced initial={{ ...START, choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1 } }} />);
    expect(screen.getByLabelText(/Direction/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Relation type/)).toBeInTheDocument();
  });

  it('relation filters may mix entity types: the entity type select gives way to a hint', async () => {
    const onParam = vi.fn();
    render(<Harness onParam={onParam} advanced initial={{ ...START, choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 2, relationType: 'Contains' } }} />);
    fireEvent.click(await screen.findByRole('switch', { name: /Match relation filters instead/ }));
    expect(onParam).toHaveBeenLastCalledWith({
      kind: 'entity', key: 'pump', label: 'Pump', choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 2, filters: [] },
    });
    expect(screen.getByText('The relation filters decide which entity types it holds.')).toBeInTheDocument();
  });

  it('shows the errors of the validator under their fields, in plain words', async () => {
    const param: EntityParam = { ...START, choose: { type: 'page', param: 'pump' } };
    render(<Harness initial={param} errors={validateEntityParam(param, [param])} />);
    expect(await screen.findByText('A parameter cannot take its entity from itself.')).toBeInTheDocument();
  });

  it('a default is searched inside the set: by name, only the entities the prefix holds', async () => {
    // the host's search finds every device; the form keeps those of the set
    const access = demoAccess({ searchEntities: async (type) => DEMO_ENTITIES.filter((e) => e.type === type) });
    render(<Harness access={access} initial={{ ...START, choose: { type: 'name', namePrefix: 'Pump' } }} />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search entities…'), 'x');
    expect(await screen.findByRole('option', { name: /Pump 1/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Tank A/ })).toBeNull();
  });

  it('offers no default for a relation: its set is a walk only the server knows', async () => {
    render(<Harness initial={{ ...START, choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1 } }} />);
    expect(await screen.findByRole('option', { name: 'Device' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Default entity/)).toBeNull();
    expect(screen.getByLabelText('With no value, take the first')).toBeInTheDocument();
  });

  it('with preview, shows the entities a set by name matches', async () => {
    render(
      <EntityParamFields value={{ ...START, choose: { type: 'name', namePrefix: 'Pump' } }} onChange={() => {}} params={[SITE]} access={demoAccess()} preview />,
    );
    expect(await screen.findByText('2 entities matched')).toBeInTheDocument();
    expect(screen.getByText(/Pump 1, Pump 2/)).toBeInTheDocument();
  });

  it('many entities drop the default and "take the first"', async () => {
    const onParam = vi.fn();
    render(<Harness onParam={onParam} initial={{ ...START, default: 'd1', defaultFrom: 'firstOption' }} />);
    fireEvent.change(select(/One or many/), { target: { value: 'many' } });
    expect(onParam).toHaveBeenLastCalledWith({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'viewer' }, multiple: true });
    expect(screen.queryByLabelText(/Default entity/)).toBeNull();
  });
});
