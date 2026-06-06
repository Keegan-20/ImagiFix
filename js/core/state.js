/**
 * The canonical shape of editor state and a factory for a clean slate.
 * Centralising it keeps the store, history snapshots and reset logic in sync.
 */
import { FILTER_DEFAULTS, TEXT_DEFAULTS } from '../config/constants.js';

/**
 * @returns a fresh editor state. `image` stays null until something loads.
 */
export function createInitialState() {
  return {
    /** @type {ImageBitmap|HTMLImageElement|null} current working image */
    image: null,
    /** filter id → numeric value */
    filters: { ...FILTER_DEFAULTS },
    /** rotation in degrees, normalised multiple of 90 */
    rotation: 0,
    flipH: false,
    flipV: false,
    /** text overlay descriptor */
    text: { ...TEXT_DEFAULTS },
    /** which interactive tool owns canvas pointer input: null | 'crop' | 'text' */
    activeTool: null,
    /** transient crop selection rectangle (canvas coords) — never persisted */
    crop: { rect: null },
  };
}

/**
 * Reset everything that an image edit touches, keeping the image itself.
 * Returned as a patch for store.setState.
 */
export function createResetPatch() {
  return {
    filters: { ...FILTER_DEFAULTS },
    rotation: 0,
    flipH: false,
    flipV: false,
    text: { ...TEXT_DEFAULTS },
    activeTool: null,
    crop: { rect: null },
  };
}
