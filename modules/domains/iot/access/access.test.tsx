import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAccessApi, type IotAdapter, type IotAssetsApi, type IotCapabilities, type IotDevicesApi } from '../api/adapter';
import { IOT_MESSAGES, mergeIotMessages } from '../messages';
import type { IotAccessGrant, IotAccessSubject, IotEffectiveAccess } from '../types/access';
import type { AssetNode } from '../types/asset';
import type { DeviceRecord } from '../types/device';
import { TargetAccessPanel } from './TargetAccessPanel';
import { SubjectAccessPanel, scopeText } from './SubjectAccessPanel';
import { IotAccessView } from './IotAccessView';

const T0 = new Date('2026-11-01T09:00:00Z');
const ADA: IotAccessSubject = { type: 'USER', id: 'u-ada', label: 'Ada Lovelace', hint: 'ada@example.com' };
const HALL: IotAccessSubject = { type: 'GROUP', id: 'g-hall', label: 'Hall 2 operators', hint: 'Group' };

const g = (over: Partial<IotAccessGrant>): IotAccessGrant => ({
  grantId: 'gr1', subjectType: 'USER', subjectId: 'u-ada', subjectLabel: 'Ada Lovelace', targetType: 'ASSET', targetId: 'bldg-a',
  targetName: 'Building A', createdBy: 'u-admin', createdAt: T0, ...over,
});
const TARGET_GRANTS = [
  g({ grantId: 'gr1' }),
  g({ grantId: 'gr2', subjectType: 'GROUP', subjectId: 'g-hall', subjectLabel: 'Hall 2 operators' }),
];
const SUBJECT_GRANTS = [
  g({ grantId: 'gr1' }),
  g({ grantId: 'gr3', targetType: 'DEVICE', targetId: 'd1', targetName: 'Pump 4' }),
  g({ grantId: 'gr4', targetType: 'DEVICE', targetId: 'd-old', targetName: null }),
];
const scope = (n: number) => ({ all: false, count: n, ids: Array.from({ length: n }, (_, i) => `x${i}`) });
const LIMITED: IotEffectiveAccess = { member: true, assets: scope(4), devices: scope(1), grants: { assets: 1, devices: 2 } };
const EVERYTHING: IotEffectiveAccess = { member: true, assets: { all: true, count: null, ids: [] }, devices: { all: true, count: null, ids: [] }, grants: { assets: 1, devices: 0 } };

type Mocked<T> = { [K in keyof T]-?: ReturnType<typeof vi.fn> } & T;

function accessApi(over: Partial<IotAccessApi> = {}, rows: IotAccessGrant[] = TARGET_GRANTS): Mocked<IotAccessApi> {
  return {
    listGrants: vi.fn(async (q: { page: number; pageSize: number }) => ({ items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length })),
    createGrant: vi.fn(async (input) => g({ grantId: 'gr-new', ...input })),
    deleteGrant: vi.fn(async () => undefined),
    effective: vi.fn(async () => LIMITED),
    searchSubjects: vi.fn(async (text: string) => [ADA, HALL].filter((s) => s.label.toLowerCase().includes(text.toLowerCase()))),
    ...over,
  } as never;
}

const TREE: AssetNode[] = [{
  assetId: 'plant', parentId: null, code: 'PLANT', name: 'Istanbul plant', kind: 'SITE', childCount: 1, deviceCount: 0,
  children: [{ assetId: 'bldg-a', parentId: 'plant', code: 'BLDG-A', name: 'Building A', kind: 'BUILDING', childCount: 0, deviceCount: 0, children: [] }],
}];
const DEVICES = [
  { deviceId: 'd1', name: 'Pump 4', label: 'Hall 2', serial: null, status: 'ACTIVE' },
  { deviceId: 'd2', name: 'Edge gateway 1', label: null, serial: 'RT-7', status: 'ACTIVE' },
] as unknown as DeviceRecord[];
const assetsApi = (tree: () => Promise<{ nodes: AssetNode[]; truncated: boolean }> = async () => ({ nodes: TREE, truncated: false })) => ({ tree: vi.fn(tree) } as unknown as IotAssetsApi);
const devicesApi = () => ({
  list: vi.fn(async (q: { search?: string }) => {
    const rows = DEVICES.filter((d) => !q.search || d.name.toLowerCase().includes(q.search.toLowerCase()));
    return { items: rows, total: rows.length };
  }),
} as unknown as IotDevicesApi);

function wrap(ui: React.ReactNode, adapter: IotAdapter, caps: Partial<IotCapabilities> = { canManageAccess: true }) {
  return render(<IotAdapterProvider adapter={adapter} capabilities={caps} locale="en-GB">{ui}</IotAdapterProvider>);
}

/** Types into a ComboBox and picks the option named `name` (the search waits for the pause). */
async function pick(user: ReturnType<typeof userEvent.setup>, field: string, text: string, name: RegExp) {
  const input = screen.getByRole('searchbox', { name: field });
  await user.click(input);
  await user.type(input, text);
  const option = await screen.findByRole('option', { name }, { timeout: 2000 });
  await user.click(within(option).getByRole('button'));
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('TargetAccessPanel', () => {
  it('lists who was given the target, with Member / Group badges and the date, and says who sees it anyway', async () => {
    const api = accessApi();
    wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, { access: api });
    const table = await screen.findByRole('table', { name: 'Members and groups who can see Building A' });
    expect(api.listGrants).toHaveBeenCalledWith({ targetType: 'ASSET', targetId: 'bldg-a', page: 1, pageSize: 10 }, expect.anything());
    expect(within(table).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(table).getByText('Member')).toBeInTheDocument();
    expect(within(table).getByText('Hall 2 operators')).toBeInTheDocument();
    expect(within(table).getByText('Group')).toBeInTheDocument();
    expect(within(table).getAllByText(/2026/)).toHaveLength(2);
    expect(screen.getByText(/members of the Full IoT view group, see it without being given access/)).toBeInTheDocument();
    expect(screen.getByText(/includes everything below it/)).toBeInTheDocument();
  });

  it('a device says that a grant of the asset it is on opens it too, not "everything below it"', async () => {
    wrap(<TargetAccessPanel targetType="DEVICE" targetId="d1" targetName="Pump 4" />, { access: accessApi() });
    await screen.findByRole('table');
    expect(screen.getByText(/the site or asset this device is placed on/)).toBeInTheDocument();
    expect(screen.queryByText(/includes everything below it/)).toBeNull();
  });

  it('Give access: picks a member or group through the search, then creates the grant for this target', async () => {
    const user = userEvent.setup();
    const api = accessApi();
    wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, { access: api });
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Give access' }));
    const dialog = await screen.findByRole('dialog', { name: 'Give access to Building A' });
    const give = within(dialog).getByRole('button', { name: 'Give access' });
    expect(give).toBeDisabled();
    await pick(user, 'Member or group', 'hall', /Hall 2 operators/);
    expect(api.searchSubjects).toHaveBeenCalledWith('hall', expect.anything());
    await user.click(give);
    await waitFor(() => expect(api.createGrant).toHaveBeenCalledWith({ subjectType: 'GROUP', subjectId: 'g-hall', targetType: 'ASSET', targetId: 'bldg-a' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.listGrants).toHaveBeenCalledTimes(2); // read again after the grant
  });

  it('a refused grant keeps the dialog open with the host\'s reason', async () => {
    const user = userEvent.setup();
    const api = accessApi({ createGrant: vi.fn(async () => { throw new IotApiError('conflict', 'This member already has this access.'); }) });
    wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, { access: api });
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Give access' }));
    const dialog = await screen.findByRole('dialog');
    await pick(user, 'Member or group', 'ada', /Ada Lovelace/);
    await user.click(within(dialog).getByRole('button', { name: 'Give access' }));
    expect(await within(dialog).findByText('This member already has this access.')).toBeInTheDocument();
  });

  it('Remove asks first, names who and what, then deletes the grant and reads the list again', async () => {
    const user = userEvent.setup();
    const api = accessApi();
    wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, { access: api });
    await user.click(await screen.findByRole('button', { name: 'Remove access of Hall 2 operators to Building A' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this access?' });
    expect(within(dialog).getByText(/Hall 2 operators will no longer see Building A/)).toBeInTheDocument();
    expect(api.deleteGrant).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.deleteGrant).toHaveBeenCalledWith('gr2'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.listGrants).toHaveBeenCalledTimes(2);
  });

  it('a refused remove stays in the dialog with the reason', async () => {
    const user = userEvent.setup();
    const api = accessApi({ deleteGrant: vi.fn(async () => { throw new IotApiError('forbidden', 'You may not change access.'); }) });
    wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, { access: api });
    await user.click(await screen.findByRole('button', { name: 'Remove access of Ada Lovelace to Building A' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await within(dialog).findByText('You may not change access.')).toBeInTheDocument();
  });

  it('without canManageAccess the list is read-only: no Give access, no Remove', async () => {
    wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, { access: accessApi() }, {});
    await screen.findByRole('table');
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Give access' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove access/ })).toBeNull();
  });

  it('says so when nobody was given the target', async () => {
    wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, { access: accessApi({}, []) });
    expect(await screen.findByText('No member or group has been given access to this yet.')).toBeInTheDocument();
  });

  it('a read error offers Retry', async () => {
    const user = userEvent.setup();
    const api = accessApi({ listGrants: vi.fn().mockRejectedValueOnce(new IotApiError('unavailable', 'The server did not answer.')).mockResolvedValue({ items: TARGET_GRANTS, total: 2 }) });
    wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, { access: api });
    expect(await screen.findByText('The server did not answer.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Hall 2 operators')).toBeInTheDocument();
  });

  it('draws nothing without the access API', () => {
    const { container } = wrap(<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />, {});
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SubjectAccessPanel', () => {
  it('shows a member\'s preview and their grants with Site or asset / Device badges, "Removed" for a gone target', async () => {
    const api = accessApi({}, SUBJECT_GRANTS);
    wrap(<SubjectAccessPanel subject={ADA} />, { access: api, assets: assetsApi(), devices: devicesApi() });
    const table = await screen.findByRole('table', { name: 'Sites, assets and devices Ada Lovelace can see' });
    expect(api.listGrants).toHaveBeenCalledWith({ subjectType: 'USER', subjectId: 'u-ada', page: 1, pageSize: 10 }, expect.anything());
    expect(within(table).getByText('Building A')).toBeInTheDocument();
    expect(within(table).getByText('Site or asset')).toBeInTheDocument();
    expect(within(table).getByText('Pump 4')).toBeInTheDocument();
    expect(within(table).getAllByText('Device')).toHaveLength(2);
    expect(within(table).getByText('Removed')).toBeInTheDocument();
    expect(await screen.findByTestId('iot-access-assets')).toHaveTextContent('4 sites and assets');
    expect(screen.getByTestId('iot-access-devices')).toHaveTextContent('1 device');
    expect(screen.getAllByText('Through access given to them or to their groups')).toHaveLength(2);
    expect(api.effective).toHaveBeenCalledWith('u-ada', expect.anything());
  });

  it('a member whose role sees everything: "Every …" through their role, and their grants change nothing', async () => {
    wrap(<SubjectAccessPanel subject={ADA} />, { access: accessApi({ effective: vi.fn(async () => EVERYTHING) }, SUBJECT_GRANTS) });
    expect(await screen.findByTestId('iot-access-assets')).toHaveTextContent('Every site and asset');
    expect(screen.getByTestId('iot-access-devices')).toHaveTextContent('Every device');
    expect(screen.getAllByText('Through their role or the Full IoT view group')).toHaveLength(2);
    expect(screen.getByText(/changes nothing for them/)).toBeInTheDocument();
  });

  it('a former member is told their grants give them nothing', async () => {
    wrap(<SubjectAccessPanel subject={ADA} />, { access: accessApi({ effective: vi.fn(async () => ({ ...LIMITED, member: false })) }, SUBJECT_GRANTS) });
    expect(await screen.findByText(/Ada Lovelace is not a member of this workspace/)).toBeInTheDocument();
  });

  it('a group has no preview: its members see what it is given', async () => {
    const api = accessApi({}, SUBJECT_GRANTS);
    wrap(<SubjectAccessPanel subject={HALL} />, { access: api });
    await screen.findByRole('table');
    expect(screen.getByText(/Every member of Hall 2 operators sees what is given to the group/)).toBeInTheDocument();
    expect(screen.queryByTestId('iot-effective-access')).toBeNull();
    expect(api.effective).not.toHaveBeenCalled();
  });

  it('Add a site or asset: picks a node in the asset tree, creates an ASSET grant and reads the preview again', async () => {
    const user = userEvent.setup();
    const api = accessApi({}, SUBJECT_GRANTS);
    wrap(<SubjectAccessPanel subject={ADA} />, { access: api, assets: assetsApi(), devices: devicesApi() });
    await screen.findByTestId('iot-access-assets');
    await user.click(screen.getByRole('button', { name: 'Add a site or asset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Give Ada Lovelace a site or asset' });
    const add = within(dialog).getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    await user.click(await within(dialog).findByText('Istanbul plant'));
    await user.click(add);
    await waitFor(() => expect(api.createGrant).toHaveBeenCalledWith({ subjectType: 'USER', subjectId: 'u-ada', targetType: 'ASSET', targetId: 'plant' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(api.effective).toHaveBeenCalledTimes(2));
    expect(api.listGrants).toHaveBeenCalledTimes(2);
  });

  it('a tree that cannot be read says so in the dialog', async () => {
    const user = userEvent.setup();
    wrap(<SubjectAccessPanel subject={ADA} />, { access: accessApi({}, SUBJECT_GRANTS), assets: assetsApi(async () => { throw new IotApiError('unavailable', 'The tree is down.'); }) });
    await user.click(await screen.findByRole('button', { name: 'Add a site or asset' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('The tree is down.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('Add a device: searches the devices, picks one, creates a DEVICE grant', async () => {
    const user = userEvent.setup();
    const api = accessApi({}, SUBJECT_GRANTS);
    const devices = devicesApi();
    wrap(<SubjectAccessPanel subject={HALL} />, { access: api, assets: assetsApi(), devices });
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Add a device' }));
    const dialog = await screen.findByRole('dialog', { name: 'Give Hall 2 operators a device' });
    await pick(user, 'Device', 'edge', /Edge gateway 1/);
    expect(devices.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: 'edge' }, expect.anything());
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(api.createGrant).toHaveBeenCalledWith({ subjectType: 'GROUP', subjectId: 'g-hall', targetType: 'DEVICE', targetId: 'd2' }));
  });

  it('Remove asks first, then deletes and refreshes the preview; a grant gone meanwhile is said, not an error', async () => {
    const user = userEvent.setup();
    const api = accessApi({ deleteGrant: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new IotApiError('not_found', 'Grant not found.')) }, SUBJECT_GRANTS);
    const notify = vi.fn();
    render(
      <IotAdapterProvider adapter={{ access: api }} capabilities={{ canManageAccess: true }} notify={notify} locale="en-GB">
        <SubjectAccessPanel subject={ADA} />
      </IotAdapterProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Remove access of Ada Lovelace to Pump 4' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this access?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.deleteGrant).toHaveBeenCalledWith('gr3'));
    await waitFor(() => expect(api.effective).toHaveBeenCalledTimes(2));
    expect(notify).toHaveBeenCalledWith({ tone: 'success', message: 'Access removed' });

    await user.click(screen.getByRole('button', { name: 'Remove access of Ada Lovelace to Removed' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'info', message: 'This access was already removed.' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('without canManageAccess: no Add, no Remove', async () => {
    wrap(<SubjectAccessPanel subject={ADA} />, { access: accessApi({}, SUBJECT_GRANTS), assets: assetsApi(), devices: devicesApi() }, {});
    expect(await screen.findByText('Building A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a site or asset' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a device' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove access/ })).toBeNull();
  });

  it('a preview that cannot be read says so with Retry', async () => {
    const user = userEvent.setup();
    const api = accessApi({ effective: vi.fn().mockRejectedValueOnce(new IotApiError('unavailable', 'No preview now.')).mockResolvedValue(LIMITED) }, SUBJECT_GRANTS);
    wrap(<SubjectAccessPanel subject={ADA} />, { access: api });
    const card = await screen.findByTestId('iot-effective-access');
    expect(await within(card).findByText('No preview now.')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('iot-access-assets')).toHaveTextContent('4 sites and assets');
  });

  it('says so when the subject has no grants', async () => {
    wrap(<SubjectAccessPanel subject={HALL} />, { access: accessApi({}, []) });
    expect(await screen.findByText('Hall 2 operators has not been given any site, asset or device.')).toBeInTheDocument();
  });
});

describe('scopeText', () => {
  const m = mergeIotMessages();
  it('words "every" and the counts, singular and plural, and counts the ids when the host gave no count', () => {
    expect(scopeText({ all: true, count: null, ids: [] }, 'assets', m, 'en')).toBe('Every site and asset');
    expect(scopeText({ all: true, count: null, ids: [] }, 'devices', m, 'en')).toBe('Every device');
    expect(scopeText({ all: false, count: 1, ids: ['a'] }, 'assets', m, 'en')).toBe('1 site or asset');
    expect(scopeText({ all: false, count: 12, ids: [] }, 'devices', m, 'en')).toBe('12 devices');
    expect(scopeText({ all: false, count: null, ids: ['a', 'b'] }, 'devices', m, 'en')).toBe('2 devices');
    expect(scopeText({ all: false, count: 0, ids: [] }, 'assets', m, 'en')).toBe('0 sites and assets');
  });
});

describe('IotAccessView', () => {
  it('explains the page until a member or group is picked, then shows what they can see', async () => {
    const user = userEvent.setup();
    const api = accessApi({}, SUBJECT_GRANTS);
    const onSubjectChange = vi.fn();
    wrap(<IotAccessView onSubjectChange={onSubjectChange} />, { access: api });
    expect(screen.getByText(IOT_MESSAGES.access.viewEmpty)).toBeInTheDocument();
    await pick(user, 'Member or group', 'ada', /Ada Lovelace/);
    expect(onSubjectChange).toHaveBeenCalledWith(ADA);
    expect(await screen.findByRole('heading', { name: 'What Ada Lovelace can see' })).toBeInTheDocument();
    expect(await screen.findByTestId('iot-access-assets')).toHaveTextContent('4 sites and assets');
    expect(screen.queryByText(IOT_MESSAGES.access.viewEmpty)).toBeNull();
  });

  it('a failed subject search says so under the field', async () => {
    const user = userEvent.setup();
    wrap(<IotAccessView />, { access: accessApi({ searchSubjects: vi.fn(async () => { throw new IotApiError('unavailable', 'down'); }) }) });
    const input = screen.getByRole('searchbox', { name: 'Member or group' });
    await user.click(input);
    await user.type(input, 'a');
    expect(await screen.findByText('Could not search members and groups.', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('takes a host translation of its texts', () => {
    wrap(<IotAccessView messages={{ access: { viewEmptyTitle: 'Choose someone first' } }} />, { access: accessApi() });
    expect(screen.getByText('Choose someone first')).toBeInTheDocument();
  });
});
