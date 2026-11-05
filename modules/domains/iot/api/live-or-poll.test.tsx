import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { IotAdapterProvider, useLiveOrPoll } from './IotAdapterProvider';
import type { IotLive, IotLiveSubscription } from './live';

/* NB 41-ui-fixes/23 1.10: a subscription the source refuses is polled and reads as polling, though the connection is live. */

function source() {
  const subs: IotLiveSubscription[] = [];
  const live: IotLive = {
    state: 'live',
    subscribe: (s) => { subs.push(s as IotLiveSubscription); return () => { subs.splice(subs.indexOf(s as IotLiveSubscription), 1); }; },
    onState: () => () => undefined,
  };
  return { live, subs };
}

function View({ poll, k }: { poll: () => void; k: string }) {
  const state = useLiveOrPoll({ key: k, poll, intervalMs: 20, subscribe: (live) => live.subscribe({ kind: 'rpc', params: { deviceId: k }, onLive: () => undefined }) });
  return <p>{state}</p>;
}

afterEach(() => { vi.useRealTimers(); });

describe('useLiveOrPoll', () => {
  it('polls a refused subscription until it delivers again; another key starts afresh', async () => {
    vi.useFakeTimers();
    const { live, subs } = source();
    const poll = vi.fn();
    const { rerender } = render(<IotAdapterProvider adapter={{}} live={live}><View poll={poll} k="a" /></IotAdapterProvider>);
    expect(screen.getByText('live')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(50); });
    expect(poll).not.toHaveBeenCalled();
    act(() => subs[0]!.onError?.('limit'));
    expect(screen.getByText('polling')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(50); });
    expect(poll).toHaveBeenCalled();
    act(() => subs[0]!.onSnapshot?.({}));
    expect(screen.getByText('live')).toBeInTheDocument();
    act(() => subs[0]!.onError?.('forbidden'));
    rerender(<IotAdapterProvider adapter={{}} live={live}><View poll={poll} k="b" /></IotAdapterProvider>);
    expect(screen.getByText('live')).toBeInTheDocument();
  });
});

describe('useLiveOrPoll after a refusal (41-ui-fixes/23 C6)', () => {
  it('is live again when the source takes the subscription again (no snapshot), and a key subscribed again starts live', () => {
    const { live, subs } = source();
    const poll = vi.fn();
    const ui = (k: string) => <IotAdapterProvider adapter={{}} live={live}><View poll={poll} k={k} /></IotAdapterProvider>;
    const { rerender } = render(ui('a'));
    act(() => subs[0]!.onError?.('unavailable'));
    expect(screen.getByText('polling')).toBeInTheDocument();
    act(() => subs[0]!.onSubscribed?.());
    expect(screen.getByText('live')).toBeInTheDocument();
    act(() => subs[0]!.onError?.('forbidden'));
    rerender(ui('b'));
    rerender(ui('a'));
    expect(screen.getByText('live')).toBeInTheDocument();
  });
});
