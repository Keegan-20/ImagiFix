/**
 * Translates the numeric filter state into a CSS `filter` string that the
 * Canvas 2D context understands. Driven entirely by the FILTERS catalogue,
 * so adding a filter in config/constants.js is all it takes.
 */
import { FILTERS } from '../config/constants.js';

/**
 * @param {Record<string, number>} filters  e.g. { brightness: 120, blur: 4, ... }
 * @param {number} [pxScale]  multiplier for px-based filters (blur) so they
 *   keep the same *visual* strength when painting at a resolution other than
 *   the on-screen reference canvas (e.g. full-size export).
 * @returns {string} e.g. "brightness(120%) saturate(100%) ... blur(4px) ..."
 */
export function buildFilterString(filters, pxScale = 1) {
  return FILTERS
    .map(({ id, cssFn, unit }) => {
      const value = unit === 'px' ? filters[id] * pxScale : filters[id];
      return `${cssFn}(${value}${unit})`;
    })
    .join(' ');
}
