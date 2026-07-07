/**
 * Image input & output.
 *
 * Loading: decode with `createImageBitmap` (off the main thread, no object-URL
 * to leak) and fall back to an <img>+objectURL path — with a proper revoke —
 * for older browsers. Exporting: re-run the pure `paint()` pipeline onto an
 * offscreen canvas so the saved file always matches what's on screen.
 */
import { paint } from '../canvas/renderer.js';
import { MAX_IMAGE_DIMENSION } from '../config/constants.js';
import { createResetPatch } from '../core/state.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { downloadBlob } from '../utils/helpers.js';

/** Decode a File/Blob into a drawable image, preferring createImageBitmap. */
async function decode(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file);
  }
  // Legacy fallback — load via object URL and revoke once decoded.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

/**
 * Load a user-selected file into the editor: decode, reset edits, start a
 * fresh history timeline.
 * @param {File} file
 * @param {{store:object, history:object}} ctx
 */
export async function loadImageFile(file, { store, history }) {
  bus.emit(EVENTS.TOAST, { type: 'loading', message: 'Loading image…' });
  try {
    const image = await decode(file);
    if (image.width > MAX_IMAGE_DIMENSION || image.height > MAX_IMAGE_DIMENSION) {
      throw new Error(`Image exceeds the ${MAX_IMAGE_DIMENSION}px limit.`);
    }
    store.setState({ image, ...createResetPatch() });
    history.reset();
    bus.emit(EVENTS.IMAGE_LOADED, image);
    bus.emit(EVENTS.TOAST, { type: 'dismiss' });
  } catch (err) {
    bus.emit(EVENTS.TOAST, {
      type: 'error',
      message: 'Could not load that image. It may be corrupt or too large.',
    });
    console.error('[imageIO] load failed:', err);
  }
}

/**
 * Render current state to an offscreen canvas and download it as PNG.
 *
 * The canvas is sized to the *image's* rotated dimensions — not the fixed
 * on-screen stage — so the file keeps the source's full resolution and has
 * no transparent letterbox bars. `paint()` re-maps text/blur so the result
 * still matches what's on screen, just at native size.
 *
 * @param {object} state
 * @param {string} filename
 */
export async function exportImage(state, filename) {
  const { image, rotation } = state;
  const quarterTurned = rotation % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(quarterTurned ? image.height : image.width));
  canvas.height = Math.max(1, Math.round(quarterTurned ? image.width : image.height));
  paint(canvas.getContext('2d'), state, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    bus.emit(EVENTS.TOAST, { type: 'error', message: 'Export failed.' });
    return false;
  }
  downloadBlob(blob, filename.endsWith('.png') ? filename : `${filename}.png`);
  return true;
}

/**
 * Wire the file picker and save button.
 * @param {{store:object, history:object, dom:object}} ctx
 */
export function initImageIO(ctx) {
  const { store, dom } = ctx;

  dom.fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file, ctx);
    e.target.value = ''; // allow re-selecting the same file
  });

  // --- Save popover: inline filename field instead of a blocking prompt() ---
  const isPanelOpen = () => dom.savePanel.classList.contains('is-open');

  // The disabled button blocks clicks, but Ctrl+S arrives via the event bus —
  // both paths funnel through here, so guard the state, not just the UI.
  const openPanel = () => {
    const { image, activeTool } = store.getState();
    if (!image) {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Select an image first.' });
      return;
    }
    if (activeTool === 'crop') {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Finish cropping first — Apply or Cancel the selection.' });
      return;
    }
    if (activeTool === 'text') {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Place the text first, or press Esc to cancel it.' });
      return;
    }
    dom.savePanel.classList.add('is-open');
    dom.saveNameInput.focus();
    dom.saveNameInput.select();
  };

  // Focus returns to the Save button on dismissal only. After a completed
  // save it moves away instead — otherwise a held/repeated Enter would
  // activate the focused button and loop open → download → open → download.
  const closePanel = (restoreFocus = true) => {
    if (!isPanelOpen()) return;
    dom.savePanel.classList.remove('is-open');
    if (restoreFocus) dom.saveButton.focus();
    else dom.saveNameInput.blur();
  };

  let exporting = false; // re-entry guard: held Enter / double-click = one file

  const confirmSave = async () => {
    if (exporting) return;
    if (!store.getState().image) { // e.g. Ctrl+Z cleared it while the panel was open
      closePanel();
      return;
    }
    // Drop characters that are illegal in filenames, and any typed ".png" —
    // the field already presents a fixed .png suffix.
    const base = dom.saveNameInput.value
      .replace(/[\\/:*?"<>|]/g, '')
      .trim()
      .replace(/\.png$/i, '')
      .trim() || 'imagifix-edit';
    dom.saveNameInput.value = base; // remembered for the next save
    closePanel(false);
    exporting = true;
    try {
      if (await exportImage(store.getState(), `${base}.png`)) {
        bus.emit(EVENTS.TOAST, { type: 'info', message: `Saved as ${base}.png` });
      }
    } finally {
      exporting = false;
    }
  };

  dom.saveButton.addEventListener('click', () => (isPanelOpen() ? closePanel() : openPanel()));
  bus.on(EVENTS.REQUEST_SAVE, openPanel); // keyboard shortcut entry point
  dom.saveConfirmButton.addEventListener('click', confirmSave);
  dom.saveCancelButton.addEventListener('click', closePanel);

  dom.savePanel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmSave();
    } else if (e.key === 'Escape') {
      closePanel();
    }
  });

  // Clicking anywhere else dismisses the popover.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#savePanel') && !e.target.closest('#saveButton')) closePanel();
  });
}
