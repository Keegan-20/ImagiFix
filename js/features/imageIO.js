/**
 * Image input & output.
 *
 * Loading: decode with `createImageBitmap` (off the main thread, no object-URL
 * to leak) and fall back to an <img>+objectURL path — with a proper revoke —
 * for older browsers. Exporting: re-run the pure `paint()` pipeline onto an
 * offscreen canvas so the saved file always matches what's on screen.
 */
import { paint } from '../canvas/renderer.js';
import { CANVAS, MAX_IMAGE_DIMENSION } from '../config/constants.js';
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
 * @param {object} state
 * @param {string} filename
 */
export async function exportImage(state, filename) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  paint(canvas.getContext('2d'), state, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    bus.emit(EVENTS.TOAST, { type: 'error', message: 'Export failed.' });
    return;
  }
  downloadBlob(blob, filename.endsWith('.png') ? filename : `${filename}.png`);
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

  const save = () => {
    if (!store.getState().image) {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Select an image first.' });
      return;
    }
    const name = prompt('Save image as:', 'imagifix-edit.png');
    if (name === null) return; // user cancelled
    exportImage(store.getState(), name.trim() || 'imagifix-edit.png');
  };

  dom.saveButton.addEventListener('click', save);
  bus.on(EVENTS.REQUEST_SAVE, save); // keyboard shortcut entry point
}
