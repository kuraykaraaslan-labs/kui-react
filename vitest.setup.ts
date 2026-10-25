import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { ConfirmHost, cancelAllConfirms } from '@/modules/ui/ConfirmDialog';

// Every test gets the one ConfirmHost an app mounts at its root, so `confirmDialog()` can be answered by clicking. It is
// mounted outside RTL's container (a test's own cleanup() leaves it) and every open question is cancelled afterwards.
let host: { root: Root; el: HTMLElement } | undefined;
beforeEach(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(createElement(ConfirmHost)));
  host = { root, el };
});
afterEach(() => {
  act(() => { cancelAllConfirms(); host?.root.unmount(); });
  host?.el.remove();
  host = undefined;
});
