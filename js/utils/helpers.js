/**
 * Framework-free utility belt. Pure, dependency-free, individually testable.
 */

/** Clamp a number to the inclusive [min, max] range. */
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Convert degrees to radians. */
export const toRadians = (deg) => (deg * Math.PI) / 180;

/**
 * Trailing debounce: run `fn` only after `wait` ms of quiet.
 * @template {(...args:any[])=>void} F
 * @param {F} fn
 * @param {number} wait
 * @returns {F}
 */
export function debounce(fn, wait = 150) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Leading+trailing throttle: at most one call per `wait` ms.
 * @template {(...args:any[])=>void} F
 * @param {F} fn
 * @param {number} wait
 * @returns {F}
 */
export function throttle(fn, wait = 100) {
  let last = 0;
  let timer;
  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * Coalesce bursts of calls into a single invocation per animation frame.
 * Ideal for paint-bound work driven by rapid input events.
 * @template {(...args:any[])=>void} F
 * @param {F} fn
 * @returns {F & { cancel: () => void }}
 */
export function rafThrottle(fn) {
  let frame = null;
  let lastArgs;
  const wrapped = function (...args) {
    lastArgs = args;
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      fn.apply(this, lastArgs);
    });
  };
  wrapped.cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  return wrapped;
}

/**
 * Trigger a browser download for a Blob without leaking the object URL.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
