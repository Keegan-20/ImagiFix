/**
 * Cross-cutting UI wiring that isn't owned by a single feature: enabling
 * controls once an image exists, undo/redo button state and the global reset.
 * Side panels (Adjustments / text) are arbitrated in ui/panels.js.
 */
import { $$ } from './dom.js';
import { createResetPatch } from '../core/state.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { ensureImage } from '../features/guards.js';

export function initControls({ store, history, dom }) {
  // Controls that only make sense with an image loaded.
  const gated = [
    dom.resetButton, dom.cropButton,
    dom.rotateLeftBtn, dom.rotateRightBtn, dom.flipHBtn, dom.flipVBtn,
    dom.textButton, dom.addTextButton,
  ];

  const setEnabled = (enabled) => {
    gated.forEach((el) => { el.disabled = !enabled; });
    $$('.range', dom.toolbar).forEach((el) => { el.disabled = !enabled; });
  };
  setEnabled(false);

  // Save is gated harder: it also locks while a canvas tool is mid-operation
  // (crop selection pending, text waiting for placement) so an uncommitted
  // edit can't be half-exported.
  const syncSave = (s) => {
    dom.saveButton.disabled = !s.image || s.activeTool !== null;
  };
  syncSave(store.getState());

  // Flip the gates the moment an image appears/clears or a tool arms/exits.
  store.subscribe((s, prev) => {
    if (!!s.image !== !!prev.image) setEnabled(!!s.image);
    if (!!s.image !== !!prev.image || s.activeTool !== prev.activeTool) syncSave(s);
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
}
