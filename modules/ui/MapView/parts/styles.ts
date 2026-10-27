// Class lists that restyle Leaflet's own chrome (tooltips, popups, zoom buttons, attribution) with
// the design tokens, so a map reads like the rest of the kit in light and dark. Leaflet's stylesheet
// is unlayered, so these use Tailwind's important modifier (`!`).

/** A marker's detail tooltip (hover). */
export const TIP_CLASS = [
  'rounded-lg! border! border-border! bg-surface-raised! text-text-primary! px-3! py-2! shadow-lg!',
  'whitespace-normal! before:hidden!',
].join(' ');

/** A permanent marker label: a small chip next to the marker. */
export const LABEL_CLASS = [
  'rounded-md! border! border-border! bg-surface-raised/95! text-text-primary! px-1.5! py-0.5! shadow-sm!',
  'text-[11px]! font-semibold! leading-4! before:hidden!',
].join(' ');

/** A click-opened popup: the same card as the tooltip, with Leaflet's close button muted. */
export const POPUP_CLASS = [
  '[&_.leaflet-popup-content-wrapper]:rounded-lg! [&_.leaflet-popup-content-wrapper]:border [&_.leaflet-popup-content-wrapper]:border-border',
  '[&_.leaflet-popup-content-wrapper]:bg-surface-raised! [&_.leaflet-popup-content-wrapper]:text-text-primary! [&_.leaflet-popup-content-wrapper]:shadow-lg!',
  '[&_.leaflet-popup-content-wrapper]:p-0! [&_.leaflet-popup-content]:mx-3! [&_.leaflet-popup-content]:my-2.5! [&_.leaflet-popup-content]:text-[13px]!',
  '[&_.leaflet-popup-tip]:bg-surface-raised! [&_.leaflet-popup-tip]:shadow-none!',
  '[&_.leaflet-popup-close-button]:text-text-secondary! [&_.leaflet-popup-close-button:hover]:text-text-primary!',
].join(' ');

/** The map container: token background and font, small attribution, kit-styled zoom buttons. */
export const CANVAS_CLASS = [
  '[&_.leaflet-control-attribution]:rounded-tl-md! [&_.leaflet-control-attribution]:bg-surface-raised/75! [&_.leaflet-control-attribution]:px-1.5!',
  '[&_.leaflet-control-attribution]:text-[10px]! [&_.leaflet-control-attribution]:leading-4! [&_.leaflet-control-attribution]:text-text-secondary!',
  '[&_.leaflet-control-attribution_a]:text-text-secondary! [&_.leaflet-control-attribution_a:hover]:text-text-primary!',
  '[&_.leaflet-bar]:overflow-hidden [&_.leaflet-bar]:rounded-lg! [&_.leaflet-bar]:border! [&_.leaflet-bar]:border-border! [&_.leaflet-bar]:shadow-sm!',
  '[&_.leaflet-bar_a]:h-7! [&_.leaflet-bar_a]:w-7! [&_.leaflet-bar_a]:leading-7! [&_.leaflet-bar_a]:text-base!',
  '[&_.leaflet-bar_a]:border-border! [&_.leaflet-bar_a]:bg-surface-raised! [&_.leaflet-bar_a]:text-text-primary!',
  '[&_.leaflet-bar_a:hover]:bg-surface-overlay! [&_.leaflet-bar_a.leaflet-disabled]:text-text-disabled!',
  '[&_.leaflet-bar_a:focus-visible]:outline-none [&_.leaflet-bar_a:focus-visible]:ring-2 [&_.leaflet-bar_a:focus-visible]:ring-inset [&_.leaflet-bar_a:focus-visible]:ring-border-focus',
].join(' ');

/**
 * A light basemap's dark rendition (a tile source without a dark URL): inverted with the hues turned back, so water
 * stays blue and land dark, and softened so the markers keep the colour. Set on the tile layer's own container.
 */
export const DIM_TILES_CLASS = '[filter:invert(1)_hue-rotate(180deg)_brightness(0.95)_contrast(0.9)_saturate(0.6)]';
