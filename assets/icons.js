/**
 * Inline SVG icon registry — the dependency-free replacement for the
 * FontAwesome and Boxicons CDNs the project used to load.
 *
 * Every icon is a 24×24 stroke icon using `currentColor`, so colour and hover
 * states are driven entirely by CSS. `dom.renderIcons()` injects these into
 * any element carrying `data-icon="<name>"`.
 */

const svg = (paths, { fill = 'none' } = {}) =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="${fill}" ` +
  `stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
  `stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const ICONS = Object.freeze({
  download: svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-2"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h2"/>'),
  sliders: svg(
    '<line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/>' +
    '<circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
  ),
  crop: svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>'),
  rotateLeft: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  rotateRight: svg('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
  flipHorizontal: svg(
    '<line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3 3"/>' +
    '<path d="M8 8 4 12l4 4Z" fill="currentColor"/>' +
    '<path d="m16 8 4 4-4 4Z" fill="currentColor"/>',
  ),
  flipVertical: svg(
    '<line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="3 3"/>' +
    '<path d="M8 8l4-4 4 4Z" fill="currentColor"/>' +
    '<path d="M8 16l4 4 4-4Z" fill="currentColor"/>',
  ),
  text: svg('<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>'),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  image: svg(
    '<rect x="3" y="3" width="18" height="18" rx="2.5"/>' +
    '<circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-4.5-4.5L5 21"/>',
  ),
  sparkles: svg(
    '<path d="M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5z" ' +
    'fill="currentColor" stroke="none"/>' +
    '<path d="M18.5 13.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" ' +
    'fill="currentColor" stroke="none"/>',
  ),
  upload: svg(
    '<path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>' +
    '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/>',
  ),
  folder: svg(
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  ),
});
