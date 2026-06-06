/**
 * Responsive behaviour the CSS can't express on its own: the mobile toolbar
 * toggle and tidying open panels when crossing the breakpoint. Layout itself
 * lives in CSS media queries — this only manages the `is-open` state.
 */
import { MOBILE_BREAKPOINT } from '../config/constants.js';

export function initResponsive({ dom }) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  dom.toolbarToggle.addEventListener('click', () => {
    dom.toolbar.classList.toggle('is-open');
    dom.textPanel.classList.remove('is-open');
  });

  // Returning to desktop width: drop the mobile-only open state.
  mql.addEventListener('change', (e) => {
    if (!e.matches) dom.toolbar.classList.remove('is-open');
  });
}
