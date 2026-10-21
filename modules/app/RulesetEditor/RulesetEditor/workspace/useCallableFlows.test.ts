import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { LinkFlow } from '../../graph/links';
import type { RuleNode } from '../../types';
import { useCallableFlows } from './useCallableFlows';

const node = (nodeId: string, type: string): RuleNode => ({ nodeId, type, label: nodeId, x: 0, y: 0 });
const flow = (id: string, types: string[]): LinkFlow => ({ id, name: `Name of ${id}`, nodes: types.map((t, i) => node('n' + i, t)) });

describe('useCallableFlows', () => {
  it('offers the callable flows the host marked, never the open one', () => {
    const { result } = renderHook(() => useCallableFlows({
      hereId: 'main',
      flows: [{ id: 'main', name: 'Main', callable: true }, { id: 'a', name: 'A', callable: true }, { id: 'b', name: 'B', callable: false }, { id: 'c', name: '', callable: true }],
    }));
    expect(result.current).toEqual([{ value: 'a', label: 'A' }, { value: 'c', label: 'c' }]);
  });

  it('offers flows of unknown state when the host cannot load them', () => {
    const { result } = renderHook(() => useCallableFlows({ hereId: null, flows: [{ id: 'a', name: 'A' }] }));
    expect(result.current).toEqual([{ value: 'a', label: 'A' }]);
  });

  it('loads the unknown flows once and keeps those with a Flow input block', async () => {
    const loadFlows = vi.fn(async (ids: string[]) => ids.map((id) => flow(id, id === 'a' ? ['trigger.flow_input', 'action.log'] : ['action.log'])));
    const flows = [{ id: 'main', name: 'Main' }, { id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'k', name: 'K', callable: true }];
    const { result, rerender } = renderHook(() => useCallableFlows({ hereId: 'main', flows, loadFlows }));
    expect(result.current).toEqual([{ value: 'k', label: 'K' }]);
    await waitFor(() => expect(result.current.map((c) => c.value)).toEqual(['a', 'k']));
    rerender();
    expect(loadFlows).toHaveBeenCalledTimes(1);
    expect(loadFlows).toHaveBeenCalledWith(['a', 'b']);
  });

  it('does not load when it is not enabled, and offers none of the unknown flows then', async () => {
    const loadFlows = vi.fn(async () => [] as LinkFlow[]);
    const { result } = renderHook(() => useCallableFlows({ hereId: null, flows: [{ id: 'a', name: 'A' }], loadFlows, enabled: false }));
    await Promise.resolve();
    expect(loadFlows).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });
});
