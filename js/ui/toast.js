/**
 * Non-blocking status messages (info / error / loading), replacing the old
 * fixed error <div> and blocking save `prompt()` for feedback. Driven entirely
 * by EVENTS.TOAST so any module can speak to the user without a DOM reference.
 *
 * The toast element is an aria-live region, so messages are announced to
 * screen readers automatically.
 */
import { bus, EVENTS } from '../core/eventBus.js';

const AUTO_HIDE_MS = 3200;

export function initToast(dom) {
  let timer;
  const hide = () => dom.toast.classList.remove('toast--visible');

  bus.on(EVENTS.TOAST, ({ type = 'info', message = '' } = {}) => {
    clearTimeout(timer);
    if (type === 'dismiss') { hide(); return; }

    dom.toast.textContent = message;
    dom.toast.dataset.type = type;
    dom.toast.classList.add('toast--visible');

    // Loading stays until explicitly dismissed; everything else auto-hides.
    if (type !== 'loading') timer = setTimeout(hide, AUTO_HIDE_MS);
  });
}
