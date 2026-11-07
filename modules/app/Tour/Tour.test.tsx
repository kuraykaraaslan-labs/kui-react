import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Config, Driver, DriveStep, PopoverDOM } from 'driver.js';
import { TourRunner, waitForElement, type DriverFactory } from './runner';
import { DEFAULT_TOUR_LABELS, type TourStep } from './types';

/** A stand-in for Driver.js: records what the runner asks for and renders the popover hook into real elements. */
function fakeDriver() {
  const calls: { config?: Config; highlights: DriveStep[]; doms: PopoverDOM[]; destroyed: number } = { highlights: [], doms: [], destroyed: 0 };
  const make = (): PopoverDOM => {
    const el = (tag: string) => document.createElement(tag);
    return {
      wrapper: el('div'), arrow: el('div'), title: el('header'), description: el('div'), footer: el('footer'), progress: el('span'),
      previousButton: el('button') as HTMLButtonElement, nextButton: el('button') as HTMLButtonElement,
      closeButton: el('button') as HTMLButtonElement, footerButtons: el('span'),
    };
  };
  const factory: DriverFactory = (config) => {
    calls.config = config;
    return {
      highlight: (step: DriveStep) => {
        calls.highlights.push(step);
        const dom = make();
        step.popover?.onPopoverRender?.(dom, {} as never);
        calls.doms.push(dom);
      },
      destroy: () => {
        calls.destroyed++;
      },
    } as unknown as Driver;
  };
  return { calls, load: async () => factory };
}

const steps: TourStep[] = [
  { id: 'one', target: '[data-tour="one"]', title: 'First', text: 'Open <b>this</b>.' },
  { id: 'two', target: '[data-tour="two"]', text: 'Then this.', advanceOn: 'click', placement: 'left' },
  { id: 'three', text: 'All done.' },
];

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeRunner(over: Partial<ConstructorParameters<typeof TourRunner>[1]> = {}) {
  const fake = fakeDriver();
  const onClose = vi.fn();
  const runner = new TourRunner(fake.load, { steps, labels: DEFAULT_TOUR_LABELS, dir: 'ltr', ariaLabel: 'Tour', onClose, ...over });
  return { fake, onClose, runner };
}

beforeEach(() => {
  document.body.innerHTML = '<button data-tour="one">One</button><button data-tour="two">Two</button><input id="field" />';
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('TourRunner', () => {
  it('highlights the target and fills the popover with text, never HTML', async () => {
    const { fake, runner } = makeRunner();
    await runner.start();
    const [first] = fake.calls.highlights;
    expect(first.element).toBe(document.querySelector('[data-tour="one"]'));
    // Driver.js writes these with innerHTML: they must reach it empty
    expect(first.popover).toMatchObject({ title: '', description: '', nextBtnText: '', prevBtnText: '', progressText: '' });
    const dom = fake.calls.doms[0];
    expect(dom.title.textContent).toBe('First');
    expect(dom.description.textContent).toBe('Open <b>this</b>.');
    expect(dom.description.querySelector('b')).toBeNull();
    expect(dom.progress.textContent).toBe('1 of 3');
    expect(dom.nextButton.textContent).toBe('Next');
    expect(dom.wrapper.getAttribute('role')).toBe('dialog');
    expect(dom.wrapper.getAttribute('aria-describedby')).toBe(dom.description.id);
    expect(first.popover?.disableButtons).toEqual(['previous']);
    expect(fake.calls.config).toMatchObject({ allowKeyboardControl: false, overlayClickBehavior: 'none', popoverClass: 'kui-tour' });
  });

  it('walks forward and back, says Done on the last step and closes as completed', async () => {
    const { fake, onClose, runner } = makeRunner();
    await runner.start();
    await runner.next();
    await runner.previous();
    expect(runner.activeIndex).toBe(0);
    await runner.next();
    await runner.next();
    expect(fake.calls.highlights.at(-1)?.element).toBeUndefined(); // a step without a target is centred
    expect(fake.calls.doms.at(-1)?.nextButton.textContent).toBe('Done');
    await runner.next();
    expect(onClose).toHaveBeenCalledWith('completed', 2);
    expect(fake.calls.destroyed).toBe(1);
  });

  it('moves on when the highlighted element is clicked (advanceOn: click)', async () => {
    const { runner } = makeRunner();
    await runner.start(1);
    (document.querySelector('[data-tour="two"]') as HTMLButtonElement).click();
    await flush();
    expect(runner.activeIndex).toBe(2);
  });

  it('Escape dismisses; arrows move, but not while typing in a field', async () => {
    const { onClose, runner } = makeRunner();
    await runner.start();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();
    expect(runner.activeIndex).toBe(1);
    document.getElementById('field')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await flush();
    expect(runner.activeIndex).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledWith('dismissed', 1);
  });

  it('leaves the arrows to a focused element of the page (an editor nudging a symbol), but takes them on its popover', async () => {
    const { fake, runner } = makeRunner();
    await runner.start();
    const pageButton = document.querySelector('[data-tour="two"]') as HTMLButtonElement;
    pageButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();
    expect(runner.activeIndex).toBe(0);
    const wrapper = fake.calls.doms[0].wrapper;
    document.body.appendChild(wrapper);
    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();
    expect(runner.activeIndex).toBe(1);
    pageButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(runner.activeIndex).toBe(1);
  });

  it('mirrors placement and arrow keys in RTL', async () => {
    const { fake, runner } = makeRunner({ dir: 'rtl' });
    await runner.start(1);
    expect(fake.calls.highlights[0].popover?.side).toBe('right');
    expect(fake.calls.doms[0].wrapper.getAttribute('dir')).toBe('rtl');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await flush();
    expect(runner.activeIndex).toBe(2);
  });

  it('awaits beforeStep (a page change) and then waits for the target to appear', async () => {
    document.body.innerHTML = '';
    const beforeStep = vi.fn(async () => {
      setTimeout(() => {
        document.body.insertAdjacentHTML('beforeend', '<div data-tour="one">late</div>');
      }, 10);
    });
    const { fake, runner } = makeRunner({ beforeStep });
    await runner.start();
    expect(beforeStep).toHaveBeenCalledWith(steps[0], 0);
    expect(fake.calls.highlights[0].element).toBe(document.querySelector('[data-tour="one"]'));
  });

  it('centres a step whose target never appears', async () => {
    document.body.innerHTML = '';
    const { fake, runner } = makeRunner({ steps: [{ id: 'x', target: '[data-tour="missing"]', text: 't', waitFor: 20 }] });
    await runner.start();
    expect(fake.calls.highlights[0].element).toBeUndefined();
    expect(fake.calls.highlights[0].popover?.side).toBeUndefined();
  });

  it('dispose stops without reporting a close', async () => {
    const { fake, onClose, runner } = makeRunner();
    await runner.start();
    runner.dispose();
    expect(onClose).not.toHaveBeenCalled();
    expect(fake.calls.destroyed).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('waitForElement', () => {
  it('returns null for a malformed selector instead of throwing', async () => {
    expect(await waitForElement('[data-tour=', 0)).toBeNull();
  });
});

describe('<Tour>', () => {
  it('renders nothing of its own', async () => {
    const { Tour } = await import('./index');
    const { container } = render(<Tour steps={steps} open={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
