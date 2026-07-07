/**
 * Crop tool — full-resolution and non-destructive.
 *
 * The selection lives in canvas space (confined to the visible picture, never
 * the letterbox) and is mapped back through the renderer's transform to the
 * *source image*, so the crop cuts original pixels at original resolution —
 * the old implementation cropped the 980×600 display composite, silently
 * destroying resolution and capturing empty letterbox margins.
 *
 * Interactions: entering the tool selects the whole image; drag the eight
 * handles to resize, drag inside to move, drag outside to draw a fresh
 * selection, arrow keys nudge (Shift = ×10). Aspect presets, a live output
 * size readout and Apply/Cancel live in the floating crop bar; Enter applies,
 * Esc cancels. Pointer Events unify mouse + touch into one code path.
 *
 * Applying replaces the image with the cropped bitmap and keeps every other
 * edit (filters, rotation, flips, text) intact — what you framed is exactly
 * what you keep, still under your current adjustments.
 */
import {
  getCanvasPoint, getImageBox, canvasRectToImageRect, normalizeRect,
} from '../canvas/geometry.js';
import { getHandlePoints } from '../canvas/renderer.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { clamp } from '../utils/helpers.js';
import { ensureImage } from './guards.js';

const MIN_SIZE = 24;    // minimum selection edge (canvas px)
const HANDLE_HIT = 14;  // handle grab radius (screen px, rescaled per event)

const CURSORS = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  inside: 'move',
};

const NUDGE = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

export function initCrop({ store, history, dom }) {
  const { canvas } = dom;
  let ratio = null;  // locked aspect (width/height), null = free
  let drag = null;   // active pointer gesture, null when idle

  const isArmed = () => store.getState().activeTool === 'crop';

  // ---------------------------------------------------------------- geometry

  /** On-canvas bounding box of the visible picture (selection is confined here). */
  const imageBox = () => {
    const { image, rotation } = store.getState();
    return getImageBox(image.width, image.height, rotation, canvas.width, canvas.height);
  };

  /** Selection in source-image pixels — what Apply will actually cut. */
  const toSourceRect = (rect) => {
    const s = store.getState();
    return canvasRectToImageRect(rect, s.image.width, s.image.height, s, canvas.width, canvas.height);
  };

  const updateReadout = (rect) => {
    if (!rect || !store.getState().image) {
      dom.cropSizeReadout.textContent = '—';
      return;
    }
    const src = toSourceRect(rect);
    dom.cropSizeReadout.textContent = `${src.width} × ${src.height} px`;
  };

  const setRect = (rect) => {
    store.setState({ crop: { rect } });
    updateReadout(rect);
  };

  /** Largest rect of the given aspect (whole box when free), centred in `box`. */
  const fitRatioToBox = (box, aspect) => {
    if (!aspect) return { x: box.x, y: box.y, width: box.width, height: box.height };
    let width = box.width;
    let height = width / aspect;
    if (height > box.height) {
      height = box.height;
      width = height * aspect;
    }
    return {
      x: box.x + (box.width - width) / 2,
      y: box.y + (box.height - height) / 2,
      width,
      height,
    };
  };

  /** Re-shape the current selection to the locked ratio, keeping its centre/area. */
  const refitSelection = () => {
    if (!ratio) return; // switching back to Free keeps the selection as-is
    const box = imageBox();
    const rect = store.getState().crop.rect;
    if (!rect) {
      setRect(fitRatioToBox(box, ratio));
      return;
    }
    let width = Math.sqrt(rect.width * rect.height * ratio);
    let height = width / ratio;
    if (width > box.width) { width = box.width; height = width / ratio; }
    if (height > box.height) { height = box.height; width = height * ratio; }
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    setRect({
      x: clamp(cx - width / 2, box.x, box.x + box.width - width),
      y: clamp(cy - height / 2, box.y, box.y + box.height - height),
      width,
      height,
    });
  };

  // ------------------------------------------------------------ interactions

  /** Which part of the selection a canvas point lands on (handle > body). */
  const hitTest = (p, rect) => {
    // Constant *screen-px* grab radius, converted to canvas units.
    const tol = HANDLE_HIT * (canvas.width / canvas.getBoundingClientRect().width);
    for (const [id, [hx, hy]] of Object.entries(getHandlePoints(rect))) {
      if (Math.abs(p.x - hx) <= tol && Math.abs(p.y - hy) <= tol) return id;
    }
    const inside = p.x >= rect.x && p.x <= rect.x + rect.width
      && p.y >= rect.y && p.y <= rect.y + rect.height;
    return inside ? 'inside' : null;
  };

  /**
   * Rect spanned from a fixed anchor towards a point, honouring the locked
   * ratio and never leaving the image box. Shared by draw + corner-resize.
   */
  const rectFromAnchor = (anchor, p, box) => {
    const px = clamp(p.x, box.x, box.x + box.width);
    const py = clamp(p.y, box.y, box.y + box.height);
    if (!ratio) return normalizeRect(anchor.x, anchor.y, px, py);

    const sx = px >= anchor.x ? 1 : -1;
    const sy = py >= anchor.y ? 1 : -1;
    const availW = sx > 0 ? box.x + box.width - anchor.x : anchor.x - box.x;
    const availH = sy > 0 ? box.y + box.height - anchor.y : anchor.y - box.y;
    // Follow the dominant drag axis, bounded by the space the box allows.
    let width = Math.max(Math.abs(px - anchor.x), Math.abs(py - anchor.y) * ratio);
    width = Math.min(width, availW, availH * ratio);
    return normalizeRect(anchor.x, anchor.y, anchor.x + sx * width, anchor.y + sy * width / ratio);
  };

  const moveTo = (p, box) => {
    const { origin, start } = drag;
    setRect({
      ...origin,
      x: clamp(origin.x + (p.x - start.x), box.x, box.x + box.width - origin.width),
      y: clamp(origin.y + (p.y - start.y), box.y, box.y + box.height - origin.height),
    });
  };

  /** Edge-handle resize with a locked ratio: opposite edge anchored, centred on the cross axis. */
  const edgeRatioRect = (handle, r, origin, box) => {
    if (handle === 'n' || handle === 's') {
      let height = r.height;
      let width = height * ratio;
      const cx = origin.x + origin.width / 2;
      const maxW = 2 * Math.min(cx - box.x, box.x + box.width - cx);
      if (width > maxW) { width = maxW; height = width / ratio; }
      const y = handle === 'n' ? r.y + r.height - height : r.y;
      return { x: cx - width / 2, y, width, height };
    }
    let width = r.width;
    let height = width / ratio;
    const cy = origin.y + origin.height / 2;
    const maxH = 2 * Math.min(cy - box.y, box.y + box.height - cy);
    if (height > maxH) { height = maxH; width = height * ratio; }
    const x = handle === 'w' ? r.x + r.width - width : r.x;
    return { x, y: cy - height / 2, width, height };
  };

  const resizeTo = (p, box) => {
    const { handle, origin } = drag;

    // Corner + locked ratio behaves like drawing from the opposite corner.
    if (ratio && handle.length === 2) {
      const anchor = {
        x: handle.includes('w') ? origin.x + origin.width : origin.x,
        y: handle.includes('n') ? origin.y + origin.height : origin.y,
      };
      setRect(rectFromAnchor(anchor, p, box));
      return;
    }

    const px = clamp(p.x, box.x, box.x + box.width);
    const py = clamp(p.y, box.y, box.y + box.height);
    let x0 = origin.x;
    let y0 = origin.y;
    let x1 = origin.x + origin.width;
    let y1 = origin.y + origin.height;
    if (handle.includes('n')) y0 = Math.min(py, y1 - MIN_SIZE);
    if (handle.includes('s')) y1 = Math.max(py, y0 + MIN_SIZE);
    if (handle.includes('w')) x0 = Math.min(px, x1 - MIN_SIZE);
    if (handle.includes('e')) x1 = Math.max(px, x0 + MIN_SIZE);

    let rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    if (ratio) rect = edgeRatioRect(handle, rect, origin, box);
    setRect(rect);
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!isArmed() || e.button !== 0) return;
    const p = getCanvasPoint(canvas, e);
    const box = imageBox();
    const rect = store.getState().crop.rect;
    const hit = rect ? hitTest(p, rect) : null;

    if (hit === 'inside') {
      drag = { mode: 'move', start: p, origin: { ...rect } };
    } else if (hit) {
      drag = { mode: 'resize', handle: hit, origin: { ...rect } };
    } else {
      // Fresh marquee; remember the old selection so a stray tap restores it.
      drag = {
        mode: 'draw',
        prev: rect,
        anchor: {
          x: clamp(p.x, box.x, box.x + box.width),
          y: clamp(p.y, box.y, box.y + box.height),
        },
      };
    }
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isArmed()) return;
    const p = getCanvasPoint(canvas, e);

    if (!drag) {
      // Hover feedback only.
      const rect = store.getState().crop.rect;
      const hit = rect ? hitTest(p, rect) : null;
      canvas.style.cursor = hit ? CURSORS[hit] : 'crosshair';
      return;
    }

    const box = imageBox();
    if (drag.mode === 'move') moveTo(p, box);
    else if (drag.mode === 'resize') resizeTo(p, box);
    else setRect(rectFromAnchor(drag.anchor, p, box));
  });

  const endDrag = (e) => {
    if (!drag) return;
    canvas.releasePointerCapture?.(e.pointerId);
    if (drag.mode === 'draw') {
      const rect = store.getState().crop.rect;
      if (!rect || rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
        setRect(drag.prev ?? fitRatioToBox(imageBox(), ratio)); // stray tap
      }
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ------------------------------------------------------------- tool state

  const enter = () => {
    ratio = null;
    syncRatioButtons('free');
    store.setState({ activeTool: 'crop' });
    canvas.classList.add('canvas--crop');
    dom.cropButton.setAttribute('aria-pressed', 'true');
    dom.cropBar.hidden = false;
    setRect(fitRatioToBox(imageBox(), null));
    bus.emit(EVENTS.TOAST, {
      type: 'info',
      message: 'Adjust the selection, then press Apply (or Enter).',
    });
  };

  const cancel = () => {
    if (!isArmed()) return;
    store.setState({ activeTool: null, crop: { rect: null } });
  };

  // Single teardown path: whenever the tool deactivates — Apply, Cancel, Esc,
  // undo/redo or another tool taking over — tidy every bit of crop UI.
  store.subscribe((s, prev) => {
    if (prev.activeTool === 'crop' && s.activeTool !== 'crop') {
      canvas.classList.remove('canvas--crop');
      canvas.style.cursor = '';
      dom.cropButton.setAttribute('aria-pressed', 'false');
      dom.cropBar.hidden = true;
      drag = null;
    }
    // Rotating / flipping mid-crop invalidates the selection — restart it.
    if (s.activeTool === 'crop'
      && (s.rotation !== prev.rotation || s.flipH !== prev.flipH || s.flipV !== prev.flipV)) {
      drag = null;
      setRect(fitRatioToBox(imageBox(), ratio));
    }
  });

  const apply = async () => {
    const state = store.getState();
    const rect = state.crop.rect;
    if (!rect || rect.width < 2 || rect.height < 2) {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Draw a selection first.' });
      return;
    }

    const src = toSourceRect(rect);
    if (src.width < 1 || src.height < 1) {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Selection too small.' });
      return;
    }
    // Selecting the entire image is a no-op — just leave the tool.
    if (src.width === state.image.width && src.height === state.image.height) {
      cancel();
      return;
    }

    // Cut the region from the *source image* at full resolution.
    let image;
    if ('createImageBitmap' in window) {
      image = await createImageBitmap(state.image, src.x, src.y, src.width, src.height);
    } else {
      const out = document.createElement('canvas');
      out.width = src.width;
      out.height = src.height;
      out.getContext('2d').drawImage(
        state.image,
        src.x, src.y, src.width, src.height,
        0, 0, src.width, src.height,
      );
      image = out;
    }

    // Adopt the crop; filters, rotation, flips and text all carry over.
    store.setState({ image, activeTool: null, crop: { rect: null } });
    history.record();
    bus.emit(EVENTS.TOAST, { type: 'info', message: `Cropped to ${src.width} × ${src.height} px.` });
  };

  // ----------------------------------------------------------------- wiring

  // Sidebar button toggles the tool; the bar's Apply commits.
  dom.cropButton.addEventListener('click', () => {
    if (!ensureImage(store)) return;
    if (isArmed()) cancel();
    else enter();
  });

  dom.cropApplyButton.addEventListener('click', apply);
  dom.cropCancelButton.addEventListener('click', cancel);

  function syncRatioButtons(activeId) {
    dom.cropRatioButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.ratio === activeId));
    });
  }

  dom.cropRatioButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!isArmed()) return;
      const id = btn.dataset.ratio;
      if (id === 'free') {
        ratio = null;
      } else if (id === 'original') {
        const box = imageBox();
        ratio = box.width / box.height;
      } else {
        const [w, h] = id.split(':').map(Number);
        ratio = w / h;
      }
      syncRatioButtons(id);
      refitSelection();
    });
  });

  // Enter applies, arrows nudge the selection (Shift = ×10).
  window.addEventListener('keydown', (e) => {
    if (!isArmed()) return;
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      apply();
      return;
    }
    const nudge = NUDGE[e.key];
    const rect = store.getState().crop.rect;
    if (!nudge || !rect) return;
    e.preventDefault();
    const box = imageBox();
    const step = e.shiftKey ? 10 : 1;
    setRect({
      ...rect,
      x: clamp(rect.x + nudge[0] * step, box.x, box.x + box.width - rect.width),
      y: clamp(rect.y + nudge[1] * step, box.y, box.y + box.height - rect.height),
    });
  });

  return { toggle: () => (isArmed() ? apply() : enter()), cancel };
}
