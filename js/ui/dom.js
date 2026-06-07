/**
 * DOM access layer: thin query helpers, a cached element registry, and the
 * icon injector. Nothing else in the app calls `document.querySelector` — they
 * read from the `dom` object, so the markup contract lives in exactly one place.
 */
import { ICONS } from '../../assets/icons.js';

/** querySelector shorthand. */
export const $ = (sel, root = document) => root.querySelector(sel);
/** querySelectorAll → real array. */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Replace `[data-icon="name"]` placeholders with their inline SVG.
 * @param {ParentNode} root
 */
export function renderIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => {
    const name = el.dataset.icon;
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

/**
 * Resolve and cache every element the app needs. Call once after the DOM is
 * ready. Throws early if the markup contract is broken — fail loud, not weird.
 */
export function createDom() {
  const byId = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`[dom] missing required element #${id}`);
    return el;
  };

  return {
    // header
    fileInput: byId('fileInput'),
    saveButton: byId('saveButton'),
    undoButton: byId('undoButton'),
    redoButton: byId('redoButton'),
    // sidebar tools
    toolbarToggle: byId('toolbarToggle'),
    cropButton: byId('cropButton'),
    rotateLeftBtn: byId('rotateLeftButton'),
    rotateRightBtn: byId('rotateRightButton'),
    flipHBtn: byId('flipHButton'),
    flipVBtn: byId('flipVButton'),
    textButton: byId('textButton'),
    // text panel
    textPanel: byId('textPanel'),
    textContent: byId('textContent'),
    textColor: byId('textColor'),
    textSize: byId('textSize'),
    textSizeValue: byId('textSizeValue'),
    addTextButton: byId('addTextButton'),
    textCloseButton: byId('textCloseButton'),
    // toolbar
    toolbar: byId('toolbar'),
    filterControls: byId('filterControls'),
    resetButton: byId('resetButton'),
    // canvas
    canvas: byId('canvas'),
    canvasArea: byId('canvasArea'),
    toast: byId('toast'),
    // empty state / drag-and-drop
    emptyState: byId('emptyState'),
    dropzone: byId('dropzone'),
    // install prompt
    installPopup: byId('installPopup'),
    installButton: byId('installButton'),
    dismissButton: byId('dismissButton'),
  };
}
