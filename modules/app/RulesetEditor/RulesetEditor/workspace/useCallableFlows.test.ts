import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCallableFlows } from './useCallableFlows';

describe('useCallableFlows', () => {
  it('offers every flow but the open one and those the host marked not callable', () => {
    const { result } = renderHook(() => useCallableFlows({
      hereId: 'main',
      flows: [{ id: 'main', name: 'Main', callable: true }, { id: 'a', name: 'A', callable: true }, { id: 'b', name: 'B', callable: false }, { id: 'c', name: '', callable: true }],
    }));
    expect(result.current).toEqual([{ value: 'a', label: 'A' }, { value: 'c', label: 'c' }]);
  });

  it('treats an unset callable as callable: every flow has a Flow input', () => {
    const { result } = renderHook(() => useCallableFlows({ hereId: 'main', flows: [{ id: 'main', name: 'Main' }, { id: 'a', name: 'A' }, { id: 'b', name: 'B', callable: false }, { id: 'k', name: 'K' }] }));
    expect(result.current).toEqual([{ value: 'a', label: 'A' }, { value: 'k', label: 'K' }]);
  });

  it('offers all the flows of a flow that is not saved yet', () => {
    const { result } = renderHook(() => useCallableFlows({ hereId: null, flows: [{ id: 'a', name: 'A' }] }));
    expect(result.current).toEqual([{ value: 'a', label: 'A' }]);
  });
});
