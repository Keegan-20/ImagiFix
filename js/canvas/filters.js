/**
 * Translates the numeric filter state into a CSS `filter` string that the
 * Canvas 2D context understands. Driven entirely by the FILTERS catalogue,
 * so adding a filter in config/constants.js is all it takes.
 */
import { FILTERS } from '../config/constants.js';

/**
 * @param {Record<string, number>} filters  e.g. { brightness: 120, blur: 4, ... }
 * @returns {string} e.g. "brightness(120%) saturate(100%) ... blur(4px) ..."
 */
export function buildFilterString(filters) {
  return FILTERS
    .map(({ id, cssFn, unit }) => `${cssFn}(${filters[id]}${unit})`)
    .join(' ');
}
