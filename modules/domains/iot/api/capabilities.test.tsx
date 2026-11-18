import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useState, useEffect } from 'react';
import { IotAdapterProvider, useIotCapabilities } from './IotAdapterProvider';

/* NB 2026-11-13: the alarm bell put `useIotCapabilities()` into a hook's dependencies and handed the result to a host that stores
   it; a new object per render looped ("Maximum update depth exceeded") on every admin page. */

describe('useIotCapabilities', () => {
  it('answers the same object while the provider holds the same answer', () => {
    const seen: unknown[] = [];
    function Probe() {
      const caps = useIotCapabilities();
      const [, setN] = useState(0);
      useEffect(() => { seen.push(caps); if (seen.length < 3) setN((n) => n + 1); }, [caps]);
      return null;
    }
    render(<IotAdapterProvider adapter={{}} capabilities={{ canReadAlarms: true }}><Probe /></IotAdapterProvider>);
    // a re-render with the same context runs the effect once, not once per render
    expect(seen).toHaveLength(1);
  });
});
