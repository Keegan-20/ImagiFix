/**
 * Cross-cutting UI wiring that isn't owned by a single feature: enabling
 * controls once an image exists, undo/redo button state, the global reset,
 * and the text-panel open/close behaviour.
 */
import { $$ } from './dom.js';
import { createResetPatch } from '../core/state.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { ensureImage } from '../features/guards.js';

export function initControls({ store, history, dom }) {
  // Controls that only make sense with an image loaded.
  const gated = [
    dom.saveButton, dom.resetButton, dom.cropButton,
    dom.rotateLeftBtn, dom.rotateRightBtn, dom.flipHBtn, dom.flipVBtn,
    dom.textButton, dom.addTextButton,
  ];

  const setEnabled = (enabled) => {
    gated.forEach((el) => { el.disabled = !enabled; });
    $$('.range', dom.toolbar).forEach((el) => { el.disabled = !enabled; });
  };
  setEnabled(false);

  // Flip the gate the moment an image appears (or is cleared).
  store.subscribe((s, prev) => {
    if (!!s.image !== !!prev.image) setEnabled(!!s.image);
  });

  // Undo/redo availability is announced by the history module.
  const syncHistoryButtons = ({ canUndo, canRedo }) => {
    dom.undoButton.disabled = !canUndo;
    dom.redoButton.disabled = !canRedo;
  };
  bus.on(EVENTS.HISTORY_CHANGED, syncHistoryButtons);
  syncHistoryButtons({ canUndo: false, canRedo: false });

  dom.undoButton.addEventListener('click', () => history.undo());
  dom.redoButton.addEventListener('click', () => history.redo());

  // Global reset: revert every edit but keep the image.
  dom.resetButton.addEventListener('click', () => {
    if (!ensureImage(store)) return;
    store.setState(createResetPatch());
    history.record();
    bus.emit(EVENTS.TOAST, { type: 'info', message: 'Adjustments reset.' });
  });

  // Text panel open/close.
  dom.textButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!ensureImage(store)) return;
    dom.textPanel.classList.toggle('is-open');
  });
  dom.textCloseButton.addEventListener('click', () => {
    dom.textPanel.classList.remove('is-open');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#textPanel') && !e.target.closest('#textButton')) {
      dom.textPanel.classList.remove('is-open');
    }
  });
}
