/**
 * Pure geometry helpers — no DOM, no canvas state. These do all the
 * "where does it go" maths so the renderer and the crop tool stay readable.
 */
import { clamp, toRadians } from '../utils/helpers.js';

/**
 * Contain-fit a source rectangle inside a box, preserving aspect ratio and
 * centring it (letterboxed).
 *
 * @returns {{ width:number, height:number, x:number, y:number, scale:number }}
 */
export function fitContain(srcW, srcH, boxW, boxH) {
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return {
    width,
    height,
    x: (boxW - width) / 2,
    y: (boxH - height) / 2,
    scale,
  };
}

/**
 * Compute how the image should be drawn for the current rotation. For 90°/270°
 * the image's bounding box is rotated, so we contain-fit the *swapped*
 * dimensions but still draw at the natural aspect ratio. The renderer draws
 * this rect centred on the origin after translating to the canvas centre.
 *
 * @param {number} imgW
 * @param {number} imgH
 * @param {number} rotation  degrees, normalised multiple of 90
 * @param {number} canvasW
 * @param {number} canvasH
 * @returns {{ width:number, height:number, scale:number }}
 */
export function getDrawSize(imgW, imgH, rotation, canvasW, canvasH) {
  const quarterTurned = rotation % 180 !== 0;
  const boxW = quarterTurned ? canvasH : canvasW;
  const boxH = quarterTurned ? canvasW : canvasH;
  const { scale } = fitContain(imgW, imgH, boxW, boxH);
  return { width: imgW * scale, height: imgH * scale, scale };
}

/**
 * The axis-aligned bounding box the image occupies on the canvas after
 * rotation + contain-fit — i.e. the visible picture, letterbox excluded.
 * The crop tool confines its selection to this box.
 *
 * @returns {{ x:number, y:number, width:number, height:number, scale:number }}
 */
export function getImageBox(imgW, imgH, rotation, canvasW, canvasH) {
  const { width, height, scale } = getDrawSize(imgW, imgH, rotation, canvasW, canvasH);
  const quarterTurned = rotation % 180 !== 0;
  const boxW = quarterTurned ? height : width;
  const boxH = quarterTurned ? width : height;
  return {
    x: (canvasW - boxW) / 2,
    y: (canvasH - boxH) / 2,
    width: boxW,
    height: boxH,
    scale,
  };
}

/**
 * Map a canvas-space rectangle back to *source image* pixel coordinates by
 * inverting the renderer's transform (translate → rotate → flip → fit-scale).
 * This is what lets the crop tool cut from the original image at full
 * resolution instead of from the scaled-down composite.
 *
 * @param {{x:number,y:number,width:number,height:number}} rect  canvas coords
 * @param {number} imgW  source image width
 * @param {number} imgH  source image height
 * @param {{rotation:number, flipH:boolean, flipV:boolean}} transform
 * @param {number} canvasW
 * @param {number} canvasH
 * @returns {{ x:number, y:number, width:number, height:number }} integer
 *   source-space rect, clamped to the image bounds.
 */
export function canvasRectToImageRect(rect, imgW, imgH, transform, canvasW, canvasH) {
  const { rotation, flipH, flipV } = transform;
  const { scale } = getDrawSize(imgW, imgH, rotation, canvasW, canvasH);
  const rad = toRadians(-rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Inverse of: translate(centre) → rotate(θ) → scale(flip) → draw centred.
  const invert = (cx, cy) => {
    const dx = cx - canvasW / 2;
    const dy = cy - canvasH / 2;
    let rx = dx * cos - dy * sin;
    let ry = dx * sin + dy * cos;
    if (flipH) rx = -rx;
    if (flipV) ry = -ry;
    return { x: rx / scale + imgW / 2, y: ry / scale + imgH / 2 };
  };

  const a = invert(rect.x, rect.y);
  const b = invert(rect.x + rect.width, rect.y + rect.height);
  const x0 = Math.round(clamp(Math.min(a.x, b.x), 0, imgW));
  const y0 = Math.round(clamp(Math.min(a.y, b.y), 0, imgH));
  const x1 = Math.round(clamp(Math.max(a.x, b.x), 0, imgW));
  const y1 = Math.round(clamp(Math.max(a.y, b.y), 0, imgH));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Normalise any angle into the [0, 360) range. */
export function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

/**
 * Map a pointer/touch event to canvas backing-store coordinates, accounting
 * for the difference between the canvas's CSS size and its pixel resolution.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {PointerEvent|MouseEvent|Touch} point  anything with clientX/clientY
 * @returns {{ x:number, y:number }}
 */
export function getCanvasPoint(canvas, point) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

/**
 * Normalise two corner points into a top-left origin rectangle so a drag in
 * any direction yields a positive width/height.
 */
export function normalizeRect(x0, y0, x1, y1) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}
