/**
 * The render pipeline — the only place that paints the editor canvas.
 *
 * `paint()` is a pure draw from a state snapshot, reused by both the live
 * canvas and the exporter (so export can never drift from what's on screen —
 * the original code duplicated this logic, which is how the save bug crept in).
 * It is resolution-independent: state coordinates (text position/size, blur
 * radius) live in the on-screen reference space (CANVAS), and are re-mapped
 * when painting at any other size — e.g. a full-resolution export.
 *
 * `createRenderer()` adds the live concerns: a clear stage when empty (the
 * HTML empty-state overlay handles onboarding), the crop selection overlay
 * (dimmed surround, rule-of-thirds grid, resize handles), the text selection
 * box, and rAF-coalesced repaints.
 */
import { CANVAS } from '../config/constants.js';
import { buildFilterString } from './filters.js';
import { getDrawSize, getImageBox } from './geometry.js';
import { toRadians, rafThrottle } from '../utils/helpers.js';

/**
 * Draw the image (with transforms + filters) and the text overlay onto any
 * 2D context. Pure: depends only on its arguments.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state
 * @param {number} width   target width
 * @param {number} height  target height
 */
export function paint(ctx, state, width, height) {
  const { image, filters, rotation, flipH, flipV, texts } = state;

  ctx.clearRect(0, 0, width, height);
  if (!image) return;

  const { width: drawW, height: drawH, scale } = getDrawSize(
    image.width, image.height, rotation, width, height,
  );

  // Ratio between this target and the on-screen reference canvas — keeps
  // px-denominated state (text, blur) visually identical at any resolution.
  // On the live canvas the ratio is exactly 1 and everything maps 1:1.
  const ref = getImageBox(image.width, image.height, rotation, CANVAS.width, CANVAS.height);
  const k = scale / ref.scale;

  ctx.save();
  ctx.filter = buildFilterString(filters, k);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(toRadians(rotation));
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Text overlays sit on top, unaffected by image filters, painted in array
  // order. Their stored positions are in reference-canvas space, anchored to
  // the image box.
  if (texts?.length) {
    const tgt = getImageBox(image.width, image.height, rotation, width, height);
    ctx.save();
    ctx.filter = 'none';
    ctx.textBaseline = 'top';
    for (const text of texts) {
      if (!text.content) continue;
      ctx.fillStyle = text.color;
      ctx.font = textFont(text.size * k);
      ctx.fillText(text.content, (text.x - ref.x) * k + tgt.x, (text.y - ref.y) * k + tgt.y);
    }
    ctx.restore();
  }
}

/** The overlay's font, shared by paint() and the hit-test so they agree. */
const textFont = (size) => `${size}px Arial, sans-serif`;

/**
 * Where one text overlay lands on a target canvas, and how big it is.
 *
 * Text position/size are stored in the reference-canvas space anchored to the
 * image box; this resolves them against a concrete canvas so the tool can
 * hit-test, drag and outline exactly the glyphs that get painted.
 *
 * @param {object} text  the overlay to measure (one entry of `state.texts`)
 * @returns {{x:number, y:number, width:number, height:number, k:number,
 *   box:{x:number,y:number,width:number,height:number}}|null} null when there's
 *   nothing to draw.
 */
export function getTextRect(ctx, state, width, height, text) {
  const { image, rotation } = state;
  if (!image || !text?.content) return null;

  const ref = getImageBox(image.width, image.height, rotation, CANVAS.width, CANVAS.height);
  const box = getImageBox(image.width, image.height, rotation, width, height);
  const k = box.scale / ref.scale;
  const size = text.size * k;

  ctx.save();
  ctx.font = textFont(size);
  const measured = ctx.measureText(text.content).width;
  ctx.restore();

  return {
    x: (text.x - ref.x) * k + box.x,
    y: (text.y - ref.y) * k + box.y,
    width: measured,
    // textBaseline is 'top', so the glyphs occupy roughly one em below y.
    // Cap height varies by font; 1.15em is a forgiving grab target.
    height: size * 1.15,
    k,
    box,
  };
}

/**
 * Inverse of the above: a point on a target canvas → reference-space text
 * coordinates, which is what each overlay's `x`/`y` stores.
 */
export function toTextSpace(point, state, width, height) {
  const { image, rotation } = state;
  const ref = getImageBox(image.width, image.height, rotation, CANVAS.width, CANVAS.height);
  const box = getImageBox(image.width, image.height, rotation, width, height);
  const k = box.scale / ref.scale;
  return {
    x: (point.x - box.x) / k + ref.x,
    y: (point.y - box.y) / k + ref.y,
  };
}

/** The eight resize-handle centre points of a rectangle. */
export function getHandlePoints(rect) {
  const { x, y, width: w, height: h } = rect;
  return {
    nw: [x, y],          n: [x + w / 2, y],          ne: [x + w, y],
    w:  [x, y + h / 2],                              e:  [x + w, y + h / 2],
    sw: [x, y + h],      s: [x + w / 2, y + h],      se: [x + w, y + h],
  };
}

/**
 * Build a renderer bound to a canvas and a state getter.
 * @param {HTMLCanvasElement} canvas
 * @param {() => object} getState
 */
export function createRenderer(canvas, getState) {
  // Hardware-accelerated path: we no longer read pixels back per edit
  // (history snapshots state, not ImageData), so willReadFrequently is off.
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;

  /**
   * Size the canvas backing store to the image's on-screen aspect (capped at
   * the CANVAS stage bounds) so the stage hugs the picture — no white
   * letterbox bars around a cropped/rotated image, matching the
   * letterbox-free export. Falls back to the full stage when empty.
   */
  function fitCanvas() {
    const { image, rotation } = getState();
    let w = CANVAS.width;
    let h = CANVAS.height;
    if (image) {
      const quarterTurned = rotation % 180 !== 0;
      const iw = quarterTurned ? image.height : image.width;
      const ih = quarterTurned ? image.width : image.height;
      const scale = Math.min(CANVAS.width / iw, CANVAS.height / ih);
      w = Math.max(1, Math.round(iw * scale));
      h = Math.max(1, Math.round(ih * scale));
    }
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function drawCropOverlay(rect) {
    ctx.save();

    // Dim everything *outside* the selection: even-odd fill punches a window
    // through the scrim, leaving the selected pixels untouched underneath.
    ctx.fillStyle = 'rgba(15, 12, 41, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.fill('evenodd');

    // Rule-of-thirds composition grid (skipped when the box is tiny).
    if (rect.width > 48 && rect.height > 48) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= 2; i += 1) {
        const gx = rect.x + (rect.width * i) / 3;
        const gy = rect.y + (rect.height * i) / 3;
        ctx.moveTo(gx, rect.y);
        ctx.lineTo(gx, rect.y + rect.height);
        ctx.moveTo(rect.x, gy);
        ctx.lineTo(rect.x + rect.width, gy);
      }
      ctx.stroke();
    }

    // Selection border.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Resize handles — white squares with the brand accent ring.
    const HS = 12;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    for (const [hx, hy] of Object.values(getHandlePoints(rect))) {
      ctx.beginPath();
      ctx.rect(hx - HS / 2, hy - HS / 2, HS, HS);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Selection box around the live text overlay. Deliberately quieter than the
   * crop overlay — nothing is dimmed, because the point is to judge the text
   * against the picture, not to frame a region.
   */
  function drawTextOverlay(rect) {
    const PAD = 6;
    const x = rect.x - PAD;
    const y = rect.y - PAD;
    const w = rect.width + PAD * 2;
    const h = rect.height + PAD * 2;

    ctx.save();
    // Dark under-stroke first so the box stays visible on light artwork.
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(15, 12, 41, 0.35)';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(x, y, w, h);

    // Corner ticks — a grab affordance without implying resize handles.
    ctx.setLineDash([]);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2.5;
    const T = Math.min(10, w / 3, h / 3);
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [
      [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
    ]) {
      ctx.moveTo(cx + sx * T, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * T);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Paint the current state immediately. */
  function render() {
    const state = getState();
    if (!state.image) {
      // Empty stage — the HTML empty-state overlay sits on top of the canvas.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    paint(ctx, state, canvas.width, canvas.height);
    if (state.crop?.rect) drawCropOverlay(state.crop.rect);
    if (state.activeTool === 'text' && state.activeTextId) {
      const active = state.texts.find((t) => t.id === state.activeTextId);
      const rect = active && getTextRect(ctx, state, canvas.width, canvas.height, active);
      if (rect) drawTextOverlay(rect);
    }
  }

  /** rAF-coalesced repaint — safe to call on every input event. */
  const scheduleRender = rafThrottle(render);

  return { render, scheduleRender, fitCanvas, ctx };
}
