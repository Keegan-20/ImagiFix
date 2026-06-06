/**
 * Rotate and flip. Each action is a pure state change plus a history record;
 * the renderer handles the actual canvas maths from that state.
 */
import { normalizeAngle } from '../canvas/geometry.js';
import { ensureImage } from './guards.js';

export function initTransform({ store, history, dom }) {
  const rotate = (delta) => {
    if (!ensureImage(store)) return;
    store.setState({ rotation: normalizeAngle(store.getState().rotation + delta) });
    history.record();
  };

  const flip = (axis) => {
    if (!ensureImage(store)) return;
    const s = store.getState();
    store.setState(axis === 'h' ? { flipH: !s.flipH } : { flipV: !s.flipV });
    history.record();
  };

  dom.rotateLeftBtn.addEventListener('click', () => rotate(-90));
  dom.rotateRightBtn.addEventListener('click', () => rotate(90));
  dom.flipHBtn.addEventListener('click', () => flip('h'));
  dom.flipVBtn.addEventListener('click', () => flip('v'));

  // Reflected toggle state for assistive tech / styling.
  store.subscribe((s) => {
    dom.flipHBtn.setAttribute('aria-pressed', String(s.flipH));
    dom.flipVBtn.setAttribute('aria-pressed', String(s.flipV));
  });

  return {
    rotateLeft: () => rotate(-90),
    rotateRight: () => rotate(90),
    flipH: () => flip('h'),
    flipV: () => flip('v'),
  };
}
