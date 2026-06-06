/**
 * Pure geometry helpers — no DOM, no canvas state. These do all the
 * "where does it go" maths so the renderer and the crop tool stay readable.
 */

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
