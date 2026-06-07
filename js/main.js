/**
 * Application bootstrap.
 *
 * Wiring only: build the store, renderer and history; hand every feature the
 * same shared context; connect keyboard shortcuts to the actions features
 * expose. State flows one way — features dispatch to the store, the store
 * notifies subscribers, the renderer repaints (rAF-coalesced).
 */
import { createStore } from './core/store.js';
import { createInitialState } from './core/state.js';
import { bus, EVENTS } from './core/eventBus.js';
import { createRenderer } from './canvas/renderer.js';
import { createDom, renderIcons } from './ui/dom.js';
import { initToast } from './ui/toast.js';
import { initControls } from './ui/controls.js';
import { initResponsive } from './ui/responsive.js';
import { initShortcuts } from './ui/shortcuts.js';
import { initRangeFills } from './ui/range.js';
import { createHistory } from './features/history.js';
import { initImageIO } from './features/imageIO.js';
import { initTransform } from './features/transform.js';
import { initFiltersPanel } from './features/filtersPanel.js';
import { initText } from './features/text.js';
import { initCrop } from './features/crop.js';
import { initDropzone } from './features/dropzone.js';
import { initPWA } from './pwa/pwa.js';

function boot() {
  const dom = createDom();
  renderIcons();

  const store = createStore(createInitialState());
  const renderer = createRenderer(dom.canvas, store.getState);
  const history = createHistory(store);

  // The single reactive edge: any state change schedules a repaint.
  store.subscribe(renderer.scheduleRender);

  const ctx = { store, history, dom };

  initToast(dom);
  initImageIO(ctx);
  const transform = initTransform(ctx);
  initFiltersPanel(ctx);
  initText(ctx);
  const crop = initCrop(ctx);
  initControls(ctx);
  initResponsive(ctx);
  initDropzone(ctx);
  initRangeFills(); // paint slider fills (after all .range inputs exist)

  // Esc: back out of the active tool / close the text panel.
  const cancel = () => {
    const { activeTool } = store.getState();
    if (activeTool === 'crop') crop.cancel();
    else if (activeTool === 'text') store.setState({ activeTool: null });
    dom.textPanel.classList.remove('is-open');
  };

  initShortcuts({
    undo: () => history.undo(),
    redo: () => history.redo(),
    save: () => bus.emit(EVENTS.REQUEST_SAVE),
    rotateR: transform.rotateRight,
    rotateL: transform.rotateLeft,
    flipH: transform.flipH,
    flipV: transform.flipV,
    cancel,
  });

  initPWA(dom);

  renderer.render(); // first paint clears the canvas; the HTML empty state shows over it
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
