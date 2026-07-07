/**
 * Text overlay tool. The user types content / picks colour & size, hits
 * "Add Text", then clicks the canvas to drop it. Canvas pointer ownership is
 * arbitrated through `state.activeTool` so crop and text never fight over the
 * same click.
 */
import { getCanvasPoint, getImageBox } from '../canvas/geometry.js';
import { CANVAS } from '../config/constants.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { ensureImage } from './guards.js';

export function initText({ store, history, dom }) {
  const arm = () => {
    if (!ensureImage(store)) return;
    if (!dom.textContent.value.trim()) {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Type some text first.' });
      return;
    }
    store.setState({ activeTool: 'text', crop: { rect: null } });
    dom.canvas.classList.add('canvas--placing');
    bus.emit(EVENTS.TOAST, { type: 'info', message: 'Click on the image to place the text.' });
  };

  const place = (event) => {
    if (store.getState().activeTool !== 'text') return;
    const state = store.getState();
    const live = getCanvasPoint(dom.canvas, event);
    // The live canvas hugs the image, but text coordinates are stored in the
    // fixed CANVAS reference space that paint() maps from — convert before
    // storing so the glyphs land exactly where the user clicked.
    const liveBox = getImageBox(
      state.image.width, state.image.height, state.rotation,
      dom.canvas.width, dom.canvas.height,
    );
    const refBox = getImageBox(
      state.image.width, state.image.height, state.rotation,
      CANVAS.width, CANVAS.height,
    );
    const x = ((live.x - liveBox.x) / liveBox.scale) * refBox.scale + refBox.x;
    const y = ((live.y - liveBox.y) / liveBox.scale) * refBox.scale + refBox.y;
    store.setState({
      text: {
        content: dom.textContent.value.trim(),
        color: dom.textColor.value,
        size: Number(dom.textSize.value),
        x,
        y,
      },
      activeTool: null,
    });
    dom.canvas.classList.remove('canvas--placing');
    bus.emit(EVENTS.TOAST, { type: 'dismiss' });
    history.record();
  };

  dom.addTextButton.addEventListener('click', arm);
  dom.canvas.addEventListener('pointerdown', place);

  dom.textSize.addEventListener('input', () => {
    dom.textSizeValue.textContent = dom.textSize.value;
  });

  // Cancel placement if the tool is switched away (e.g. crop, Esc).
  store.subscribe((s, prev) => {
    if (prev.activeTool === 'text' && s.activeTool !== 'text') {
      dom.canvas.classList.remove('canvas--placing');
    }
  });

  return { arm };
}
