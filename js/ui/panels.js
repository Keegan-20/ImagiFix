/**
 * Side-panel arbiter.
 *
 * The Adjustments column and the Add Text column are the two side panels beside
 * the canvas, and only one shows at a time, so one module owns both rather than
 * each toggling classes behind the other's back. Two booleans are the model:
 *
 *   toolbarOpen — what the user last asked of the Filters button
 *   textOpen    — whether the text panel is up
 *
 * `sync()` derives every class from them. Adjustments yields while the text
 * panel is up and comes back on its own when it closes, because opening text
 * never touches `toolbarOpen` — no snapshot to save and restore.
 */
import { MOBILE_BREAKPOINT } from '../config/constants.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { ensureImage } from '../features/guards.js';

export function createPanels({ store, dom }) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  // Desktop docks Adjustments open by default; mobile keeps the sheet down.
  let toolbarOpen = !mql.matches;
  let textOpen = false;

  const sync = () => {
    const mobile = mql.matches;
    const showToolbar = toolbarOpen && !textOpen;

    // Mobile animates a bottom sheet via .is-open; desktop simply drops the
    // column out of the flex row so the canvas reclaims the width.
    dom.toolbar.classList.toggle('is-open', mobile && showToolbar);
    dom.toolbar.classList.toggle('is-hidden', !mobile && !showToolbar);
    dom.toolbarToggle.setAttribute('aria-expanded', String(showToolbar));

    dom.textPanel.classList.toggle('is-open', textOpen);
    dom.textButton.setAttribute('aria-expanded', String(textOpen));
  };

  /* ---- text panel ---- */

  const openText = () => {
    if (textOpen || !ensureImage(store)) return;
    textOpen = true;
    sync();
    dom.textContent.focus();
    dom.textContent.select();
    bus.emit(EVENTS.TEXT_PANEL, { open: true });
  };

  /**
   * @param {{ restoreFocus?: boolean, commit?: boolean }} [opts]
   *   restoreFocus returns focus to the trigger — right for Esc/close, wrong
   *   when the user clicked elsewhere. commit=false discards the in-progress
   *   overlay; anything that isn't an explicit escape keeps it.
   */
  const closeText = ({ restoreFocus = false, commit = true } = {}) => {
    if (!textOpen) return;
    const hadFocus = dom.textPanel.contains(document.activeElement);
    textOpen = false;
    sync();
    if (restoreFocus || hadFocus) dom.textButton.focus();
    bus.emit(EVENTS.TEXT_PANEL, { open: false, commit });
  };

  const toggleText = () => (textOpen ? closeText({ restoreFocus: true }) : openText());

  /* ---- adjustments column ---- */

  const toggleToolbar = () => {
    // Asking for Adjustments is asking for the text panel to get out of the
    // way — it settles what's on the image rather than discarding it.
    if (textOpen) {
      toolbarOpen = true;
      closeText();
    } else {
      toolbarOpen = !toolbarOpen;
    }
    sync();
  };

  /* ---- wiring ---- */

  dom.textButton.addEventListener('click', (e) => {
    e.stopPropagation(); // don't let the outside-click handler undo the toggle
    toggleText();
  });
  dom.textCloseButton.addEventListener('click', () => closeText({ restoreFocus: true }));
  dom.toolbarToggle.addEventListener('click', toggleToolbar);

  // Esc from inside the panel. The global shortcut handler deliberately ignores
  // unmodified keys while typing, so the text field needs its own escape hatch.
  dom.textPanel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeText({ restoreFocus: true, commit: false });
    }
  });

  // Click-away, mobile only: there the panel floats over the canvas, so a tap
  // outside means "put it away". On desktop it owns a column of its own and
  // dismissing it on every stray click would fight the user mid-edit.
  document.addEventListener('pointerdown', (e) => {
    if (!textOpen || !mql.matches) return;
    if (e.target.closest('#textPanel') || e.target.closest('#textButton')) return;
    closeText();
  });

  // Crossing the breakpoint re-derives the default dock state for that layout.
  mql.addEventListener('change', (e) => {
    toolbarOpen = !e.matches;
    sync();
  });

  // Losing the image should never leave a panel hanging over an empty canvas.
  store.subscribe((s, prev) => {
    if (prev.image && !s.image) closeText({ commit: false });
  });

  sync();

  return { openText, closeText, toggleText, toggleToolbar, isTextOpen: () => textOpen };
}
