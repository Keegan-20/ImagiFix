/**
 * Crop tool.
 *
 * Rather than re-deriving image-space coordinates through rotation/flip/fit
 * (the original code's fragile, bug-prone approach), we crop the *composited*
 * result: render current state to an offscreen canvas via the shared `paint()`
 * pipeline, copy out the selected rectangle, and adopt it as the new image.
 * Edits are baked in, so filters/transform reset cleanly afterwards.
 *
 * Pointer Events unify mouse + touch into one code path.
 */
import { CANVAS } from '../config/constants.js';
import { paint } from '../canvas/renderer.js';
import { getCanvasPoint, normalizeRect } from '../canvas/geometry.js';
import { createResetPatch } from '../core/state.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { clamp } from '../utils/helpers.js';
import { ensureImage } from './guards.js';

const MIN_CROP = 8; // ignore stray taps smaller than this (canvas px)

export function initCrop({ store, history, dom }) {
  const { canvas } = dom;
  let dragging = false;
  let start = null;

  const isArmed = () => store.getState().activeTool === 'crop';

  const enter = () => {
    store.setState({ activeTool: 'crop', crop: { rect: null } });
    canvas.classList.add('canvas--crop');
    dom.cropButton.setAttribute('aria-pressed', 'true');
    bus.emit(EVENTS.TOAST, { type: 'info', message: 'Drag to select, then click Crop again to apply.' });
  };

  const exit = () => {
    store.setState({ activeTool: null, crop: { rect: null } });
    canvas.classList.remove('canvas--crop');
    dom.cropButton.setAttribute('aria-pressed', 'false');
  };

  const apply = async () => {
    const state = store.getState();
    const rect = state.crop.rect;
    if (!rect || rect.width < MIN_CROP || rect.height < MIN_CROP) {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Selection too small.' });
      exit();
      return;
    }

    // 1. Composite current state (no overlay) onto a full-size offscreen canvas.
    const full = document.createElement('canvas');
    full.width = CANVAS.width;
    full.height = CANVAS.height;
    paint(full.getContext('2d'), state, full.width, full.height);

    // 2. Copy the selected region into a tightly-sized canvas.
    const out = document.createElement('canvas');
    out.width = Math.round(rect.width);
    out.height = Math.round(rect.height);
    out.getContext('2d').drawImage(
      full,
      rect.x, rect.y, rect.width, rect.height,
      0, 0, out.width, out.height,
    );

    // 3. Adopt it as the new image; edits are now baked in, so reset them.
    const image = 'createImageBitmap' in window ? await createImageBitmap(out) : out;
    store.setState({ image, ...createResetPatch() });
    canvas.classList.remove('canvas--crop');
    dom.cropButton.setAttribute('aria-pressed', 'false');
    history.record();
    bus.emit(EVENTS.TOAST, { type: 'dismiss' });
  };

  // --- Crop button: arm on first click, apply on second ---
  dom.cropButton.addEventListener('click', () => {
    if (!ensureImage(store)) return;
    if (isArmed()) apply();
    else enter();
  });

  // --- Drag to define the selection ---
  canvas.addEventListener('pointerdown', (e) => {
    if (!isArmed()) return;
    dragging = true;
    start = getCanvasPoint(canvas, e);
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const cur = getCanvasPoint(canvas, e);
    const rect = normalizeRect(
      clamp(start.x, 0, canvas.width), clamp(start.y, 0, canvas.height),
      clamp(cur.x, 0, canvas.width), clamp(cur.y, 0, canvas.height),
    );
    store.setState({ crop: { rect } });
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return { toggle: () => (isArmed() ? apply() : enter()), cancel: exit };
}
