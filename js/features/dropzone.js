/**
 * Empty-state + drag-and-drop upload.
 *
 * Shows the onboarding overlay while the canvas is empty and fades it out once
 * an image loads. Accepts a click anywhere in the zone, and a file dropped
 * anywhere over the canvas area (which also supports replacing the current
 * image). Decoding/validation is delegated to imageIO's `loadImageFile`.
 */
import { loadImageFile } from './imageIO.js';
import { bus, EVENTS } from '../core/eventBus.js';

export function initDropzone(ctx) {
  const { store, dom } = ctx;
  const { emptyState, dropzone, canvasArea, fileInput } = dom;

  // Toggle the overlay whenever the image is added or cleared.
  const sync = (hasImage) => emptyState.classList.toggle('is-hidden', hasImage);
  sync(!!store.getState().image);
  store.subscribe((s, prev) => {
    if (!!s.image !== !!prev.image) sync(!!s.image);
  });

  // Click anywhere in the zone to browse — but let the CTA <label> open the
  // picker natively instead of double-firing it.
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('label[for="fileInput"]')) return;
    fileInput.click();
  });

  // Drag & drop. `depth` ignores dragenter/leave bubbling from child nodes so
  // the highlight doesn't flicker as the cursor crosses inner elements.
  let depth = 0;
  const setDragging = (on) => canvasArea.classList.toggle('is-dragover', on);

  canvasArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth += 1;
    setDragging(true);
  });
  canvasArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  canvasArea.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) setDragging(false);
  });
  canvasArea.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    setDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Please drop an image file.' });
      return;
    }
    loadImageFile(file, ctx);
  });
}
