// The step controller behind <Tour>. Driver.js only draws (the overlay, the cut-out around the target, the popover's
// position); this class decides which step shows, waits for its page and its element, fills the popover with TEXT
// (Driver.js writes its own strings with innerHTML, so it is handed empty ones), and owns the keyboard.
import type { Config, Driver, DriveStep, PopoverDOM, Side } from 'driver.js';
import type { TourCloseReason, TourLabels, TourStep } from './types';

export type DriverFactory = (config: Config) => Driver;

export type TourRunnerOptions = {
  steps: TourStep[];
  labels: TourLabels;
  dir: 'ltr' | 'rtl';
  ariaLabel: string;
  beforeStep?: (step: TourStep, index: number) => void | Promise<void>;
  onStepChange?: (index: number, step: TourStep) => void;
  onClose: (reason: TourCloseReason, index: number) => void;
};

const DEFAULT_WAIT_MS = 3000;
const MIRROR: Partial<Record<Side, Side>> = { left: 'right', right: 'left' };

/** The element a selector names, once it is in the page and laid out; null after `timeoutMs`. */
export function waitForElement(selector: string, timeoutMs: number, doc: Document = document): Promise<Element | null> {
  const find = () => {
    try {
      return doc.querySelector(selector);
    } catch {
      return null; // a malformed selector never throws out of a tour
    }
  };
  const found = find();
  if (found || timeoutMs <= 0) return Promise.resolve(found);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = find();
      if (el) done(el);
    });
    const timer = setTimeout(() => done(null), timeoutMs);
    function done(el: Element | null) {
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    }
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true });
  });
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName)));
}

let idSeq = 0;

export class TourRunner {
  private driver: Driver | undefined;
  private index = -1;
  private token = 0;
  private closed = false;
  private stepCleanup: Array<() => void> = [];
  private readonly ids = { title: `kui-tour-title-${++idSeq}`, text: `kui-tour-text-${idSeq}` };
  private returnFocus: HTMLElement | null = null;

  constructor(
    private readonly loadDriver: () => Promise<DriverFactory>,
    private readonly opts: TourRunnerOptions,
    private readonly doc: Document = document,
  ) {}

  get activeIndex(): number {
    return this.index;
  }

  async start(at = 0): Promise<void> {
    this.returnFocus = this.doc.activeElement instanceof HTMLElement ? this.doc.activeElement : null;
    this.doc.addEventListener('keydown', this.onKey, true);
    await this.show(Math.min(Math.max(at, 0), this.opts.steps.length - 1));
  }

  next = async (): Promise<void> => {
    if (this.closed) return;
    if (this.index >= this.opts.steps.length - 1) this.finish('completed');
    else await this.show(this.index + 1);
  };

  previous = async (): Promise<void> => {
    if (this.closed || this.index <= 0) return;
    await this.show(this.index - 1);
  };

  /** Ends the tour and tells the host why. */
  finish(reason: TourCloseReason): void {
    if (this.closed) return;
    const at = this.index;
    this.teardown();
    this.returnFocus?.focus?.({ preventScroll: true });
    this.opts.onClose(reason, at);
  }

  /** Ends the tour without telling the host (the component unmounted or was closed by its host). */
  dispose(): void {
    if (!this.closed) this.teardown();
  }

  private teardown() {
    this.closed = true;
    this.token++;
    this.clearStep();
    this.doc.removeEventListener('keydown', this.onKey, true);
    this.driver?.destroy();
    this.driver = undefined;
  }

  private clearStep() {
    for (const fn of this.stepCleanup.splice(0)) fn();
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.closed) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.finish('dismissed');
    } else if (!isTyping(e.target) && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const forward = (e.key === 'ArrowRight') !== (this.opts.dir === 'rtl');
      e.preventDefault();
      void (forward ? this.next() : this.previous());
    }
  };

  private async ensureDriver(): Promise<Driver> {
    if (this.driver) return this.driver;
    const create = await this.loadDriver();
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.driver = create({
      animate: !reduceMotion,
      smoothScroll: !reduceMotion,
      allowClose: true,
      allowKeyboardControl: false, // the runner owns the keys (Escape, arrows, RTL)
      overlayClickBehavior: 'none',
      overlayColor: 'black',
      overlayOpacity: 0.5, // the kui Modal backdrop (bg-black/50)
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: 'kui-tour',
      popoverOffset: 12,
    });
    return this.driver;
  }

  private async show(i: number): Promise<void> {
    const token = ++this.token;
    const step = this.opts.steps[i];
    if (!step) return this.finish('completed');
    this.clearStep();
    await this.opts.beforeStep?.(step, i);
    if (token !== this.token || this.closed) return;
    const element = step.target ? await waitForElement(step.target, step.waitFor ?? DEFAULT_WAIT_MS, this.doc) : null;
    if (token !== this.token || this.closed) return;
    const driver = await this.ensureDriver();
    if (token !== this.token || this.closed) return;

    this.index = i;
    const placement = step.placement && step.placement !== 'center' && element ? step.placement : undefined;
    const side = placement && this.opts.dir === 'rtl' ? MIRROR[placement] ?? placement : placement;
    const drive: DriveStep = {
      element: element ?? undefined,
      popover: {
        // Empty on purpose: Driver.js writes these with innerHTML. The text goes in through onPopoverRender.
        title: '',
        description: '',
        nextBtnText: '',
        prevBtnText: '',
        doneBtnText: '',
        progressText: '',
        side,
        align: step.align,
        showButtons: ['next', 'previous', 'close'],
        disableButtons: i === 0 ? ['previous'] : [],
        onNextClick: () => void this.next(),
        onPrevClick: () => void this.previous(),
        onCloseClick: () => this.finish('dismissed'),
        onPopoverRender: (dom) => this.render(dom, step, i),
      },
    };
    driver.highlight(drive);

    if (element && step.advanceOn === 'click') {
      const onTargetClick = () => void this.next();
      element.addEventListener('click', onTargetClick, { once: true });
      this.stepCleanup.push(() => element.removeEventListener('click', onTargetClick));
    }
    this.opts.onStepChange?.(i, step);
  }

  private render(dom: PopoverDOM, step: TourStep, i: number) {
    const total = this.opts.steps.length;
    const { labels } = this.opts;
    const wrapper = dom.wrapper;
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-label', this.opts.ariaLabel);
    wrapper.setAttribute('dir', this.opts.dir);
    wrapper.setAttribute('data-step', step.id);

    dom.title.id = this.ids.title;
    dom.title.textContent = step.title ?? '';
    dom.title.style.display = step.title ? 'block' : 'none';
    dom.description.id = this.ids.text;
    dom.description.textContent = step.text;
    dom.description.style.display = 'block';
    if (step.title) wrapper.setAttribute('aria-labelledby', this.ids.title);
    wrapper.setAttribute('aria-describedby', this.ids.text);

    dom.progress.textContent = labels.progress.replace('{current}', String(i + 1)).replace('{total}', String(total));
    dom.progress.style.display = 'block';
    dom.previousButton.textContent = labels.previous;
    dom.nextButton.textContent = i === total - 1 ? labels.done : labels.next;
    dom.closeButton.textContent = '×';
    dom.closeButton.setAttribute('aria-label', labels.close);
    dom.closeButton.setAttribute('title', labels.close);
    if (i === 0) dom.previousButton.setAttribute('aria-disabled', 'true');

    // Keyboard and screen-reader users land on the step: focus its primary action.
    const focus = () => dom.nextButton.focus({ preventScroll: true });
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focus);
    else focus();
  }
}
