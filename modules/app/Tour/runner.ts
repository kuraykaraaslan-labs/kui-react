// The step controller behind <Tour>. Driver.js only draws (the overlay, the cut-out around the target, the popover's
// position); this class decides which step shows, waits for its page and its element, fills the popover with TEXT
// (Driver.js writes its own strings with innerHTML, so it is handed empty ones), and owns the keyboard.
import type { Config, Driver, DriveStep, PopoverDOM, Side } from 'driver.js';
import type { TourCloseReason, TourLabels, TourStep } from './types';

export type DriverFactory = (config: Config) => Driver;

export type TourRunnerOptions = {
  steps: TourStep[];
  /**
   * Where the popover and the overlay live for a step. Default: the open modal dialog (`aria-modal="true"`) the step's target
   * is in, else the topmost one, so the dialog's focus trap and aria-modal scope include the tour; a dialog that moves its
   * content with a transform (which would shift Driver.js's fixed positions) and a native <dialog> (Driver.js handles it)
   * are left alone. Return null to leave them where Driver.js put them.
   */
  container?: (target: Element | null) => Element | null;
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

const shown = (v: string | null | undefined) => Boolean(v) && v !== 'none' && v !== 'normal' && v !== 'auto';

/** An element that makes `position: fixed` children relative to itself (a transform, a filter, containment…), or one of its ancestors does. */
export function shiftsFixedChildren(el: Element, doc: Document = document): boolean {
  const view = doc.defaultView;
  if (!view) return false;
  for (let n: Element | null = el; n && n !== doc.documentElement; n = n.parentElement) {
    const cs = view.getComputedStyle(n);
    if ([cs.transform, cs.translate, cs.scale, cs.rotate, cs.filter, cs.perspective, cs.getPropertyValue('backdrop-filter')].some(shown)) return true;
    if (/paint|layout|strict|content/.test(cs.contain ?? '') || /transform|filter|perspective/.test(cs.willChange ?? '')) return true;
  }
  return false;
}

/** The default host of a step's popover and overlay (see TourRunnerOptions.container). */
/** A modal dialog: `aria-modal="true"`, or a `role="dialog"` that does not say it is non-modal (Radix sets no aria-modal). */
const MODAL = '[aria-modal="true"], [role="dialog"]:not([aria-modal="false"])';

export function modalHostFor(target: Element | null, doc: Document = document): Element | null {
  if (target?.closest('dialog[open]')) return null;
  const own = target?.closest(MODAL);
  const open = own
    ? [own]
    : Array.from(doc.querySelectorAll(MODAL))
        .filter((el) => !el.closest('.driver-popover') && !el.closest('[inert], [aria-hidden="true"]') && el.getClientRects().length > 0)
        .reverse();
  for (const el of open) if (!shiftsFixedChildren(el, doc)) return el;
  return null;
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
  private popover: HTMLElement | null = null;
  private target: Element | null = null;

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
    this.doc.body.classList.remove('kui-tour-interactive');
    this.driver?.destroy();
    this.driver = undefined;
  }

  private clearStep() {
    for (const fn of this.stepCleanup.splice(0)) fn();
  }

  /**
   * Escape always stops the tour. The arrows move it only when the keyboard is on the tour's popover or on nothing at all:
   * a focused field, list or canvas keeps its own arrow keys (an editor nudges the selected item; the tour must not move too).
   */
  private onKey = (e: KeyboardEvent) => {
    if (this.closed) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.finish('dismissed');
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && this.arrowsAreOurs(e.target)) {
      const forward = (e.key === 'ArrowRight') !== (this.opts.dir === 'rtl');
      e.preventDefault();
      void (forward ? this.next() : this.previous());
    }
  };

  /**
   * A step inside an open modal dialog (an editor in a Radix dialog): the popover and the overlay go into it, so the dialog's
   * focus trap lets the keyboard reach the popover. A later step outside any modal brings the overlay back to the page.
   */
  private placeLayers() {
    const host = this.opts.container ? this.opts.container(this.target) : modalHostFor(this.target, this.doc);
    const overlay = (this.driver?.getState?.('__overlaySvg') ?? null) as Element | null;
    if (overlay) {
      if (host) {
        if (overlay.parentElement !== host) host.appendChild(overlay);
        this.overlayMoved = true;
      } else if (this.overlayMoved) {
        this.doc.body.appendChild(overlay); // back to the page (also when the dialog it was in has gone)
        this.overlayMoved = false;
      }
    }
    if (host && this.popover && this.popover.parentElement !== host) host.appendChild(this.popover);
  }

  private overlayMoved = false;

  private arrowsAreOurs(target: EventTarget | null): boolean {
    if (isTyping(target)) return false;
    const node = target as Node | null;
    if (!node || node === this.doc || node === this.doc.body || node === this.doc.documentElement) return true;
    return Boolean(this.popover?.contains(node));
  }

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
    this.target = element;
    this.doc.body.classList.toggle('kui-tour-interactive', Boolean(step.interactive));
    driver.highlight(drive);
    this.placeLayers(); // the overlay may only exist once the first highlight made it

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
    this.popover = wrapper;
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

    this.placeLayers();

    // Keyboard and screen-reader users land on the step: focus its primary action.
    const focus = () => dom.nextButton.focus({ preventScroll: true });
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focus);
    else focus();
  }
}
