/**
 * The render pipeline — the only place that paints the editor canvas.
 *
 * `paint()` is a pure draw from a state snapshot, reused by both the live
 * canvas and the exporter (so export can never drift from what's on screen —
 * the original code duplicated this logic, which is how the save bug crept in).
 *
 * `createRenderer()` adds the live concerns: a clear stage when empty (the
 * HTML empty-state overlay handles onboarding), the crop selection overlay,
 * and rAF-coalesced repaints.
 */
import { CANVAS } from '../config/constants.js';
import { buildFilterString } from './filters.js';
import { getDrawSize } from './geometry.js';
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
  const { image, filters, rotation, flipH, flipV, text } = state;

  ctx.clearRect(0, 0, width, height);
  if (!image) return;

  const { width: drawW, height: drawH } = getDrawSize(
    image.width, image.height, rotation, width, height,
  );

  ctx.save();
  ctx.filter = buildFilterString(filters);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(toRadians(rotation));
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Text overlay sits on top, unaffected by image filters, in canvas space.
  if (text?.content) {
    ctx.save();
    ctx.filter = 'none';
    ctx.fillStyle = text.color;
    ctx.font = `${text.size}px Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(text.content, text.x, text.y);
    ctx.restore();
  }
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

  function drawCropOverlay(rect) {
    // Dim everything, then punch a clear window over the selection.
    ctx.save();
    ctx.fillStyle = 'rgba(30, 27, 75, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    // Re-draw the selected slice at full clarity inside the window.
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    paint(ctx, getState(), canvas.width, canvas.height);
    ctx.restore();
    // Marching-ants border.
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
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
  }

  /** rAF-coalesced repaint — safe to call on every input event. */
  const scheduleRender = rafThrottle(render);

  return { render, scheduleRender, ctx };
}
