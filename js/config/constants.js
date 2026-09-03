/**
 * Application-wide configuration.
 *
 * Everything here is static data: filter definitions, sensible defaults,
 * the keyboard map and a couple of magic numbers. Keeping it in one place
 * means features stay declarative — add a filter here and the panel, the
 * render pipeline and the reset logic all pick it up automatically.
 */

/**
 * Canvas backing-store size. The element is scaled down with CSS, but we
 * always draw at this resolution so exports stay crisp.
 */
export const CANVAS = Object.freeze({ width: 980, height: 600 });

/**
 * Filter catalogue — the single source of truth for the adjustment panel.
 *
 * @typedef  {Object} FilterDef
 * @property {string} id        matches the range input id / state key
 * @property {string} label     human label shown in the UI
 * @property {number} min       slider minimum
 * @property {number} max       slider maximum
 * @property {number} default   value applied on load / reset
 * @property {string} unit      CSS unit appended in the filter string ('%', 'px')
 * @property {string} cssFn     the CSS filter function name
 * @property {(v:number)=>string} [format] optional value formatter for the <output>
 */
export const FILTERS = Object.freeze([
  { id: 'brightness', label: 'Exposure',   min: 0, max: 200, default: 100, unit: '%',  cssFn: 'brightness' },
  { id: 'saturation', label: 'Saturation', min: 0, max: 200, default: 100, unit: '%',  cssFn: 'saturate'   },
  { id: 'contrast',   label: 'Contrast',   min: 0, max: 200, default: 100, unit: '%',  cssFn: 'contrast'   },
  { id: 'blur',       label: 'Blur',       min: 0, max: 25,  default: 0,   unit: 'px', cssFn: 'blur'       },
  { id: 'inversion',  label: 'Inversion',  min: 0, max: 100, default: 0,   unit: '%',  cssFn: 'invert'     },
  {
    id: 'opacity', label: 'Opacity', min: 0, max: 100, default: 100, unit: '%', cssFn: 'opacity',
    // Surfaced to the user as 0–1 even though the slider/state are 0–100.
    format: (v) => (v / 100).toFixed(2),
  },
]);

/** Default value for every filter, keyed by id: { brightness: 100, ... }. */
export const FILTER_DEFAULTS = Object.freeze(
  Object.fromEntries(FILTERS.map((f) => [f.id, f.default])),
);

/** Style an overlay starts with before the panel supplies its own values. */
export const TEXT_DEFAULTS = Object.freeze({
  content: '',
  color: '#000000',
  size: 24,
  x: 0,
  y: 0,
});

/** Offset each stacked overlay so a second one isn't hidden under the first. */
export const TEXT_CASCADE = 18;

/** Below this viewport width the app switches to its compact mobile layout. */
export const MOBILE_BREAKPOINT = 768;

/** Hard cap so a huge upload can't lock up the main thread on decode. */
export const MAX_IMAGE_DIMENSION = 8192;

/**
 * Keyboard shortcuts. `combo` is matched case-insensitively against a
 * normalised "ctrl+shift+key" string built in ui/shortcuts.js.
 */
export const SHORTCUTS = Object.freeze([
  { combo: 'ctrl+z',       action: 'undo',     description: 'Undo' },
  { combo: 'ctrl+y',       action: 'redo',     description: 'Redo' },
  { combo: 'ctrl+shift+z', action: 'redo',     description: 'Redo' },
  { combo: 'ctrl+s',       action: 'save',     description: 'Save image' },
  { combo: 'r',            action: 'rotateR',  description: 'Rotate right' },
  { combo: 'shift+r',      action: 'rotateL',  description: 'Rotate left' },
  { combo: 'h',            action: 'flipH',    description: 'Flip horizontal' },
  { combo: 'v',            action: 'flipV',    description: 'Flip vertical' },
  { combo: 'escape',       action: 'cancel',   description: 'Close panel / cancel crop' },
]);
