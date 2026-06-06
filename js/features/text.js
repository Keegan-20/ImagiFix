/**
 * Text overlay tool. The user types content / picks colour & size, hits
 * "Add Text", then clicks the canvas to drop it. Canvas pointer ownership is
 * arbitrated through `state.activeTool` so crop and text never fight over the
 * same click.
 */
import { getCanvasPoint } from '../canvas/geometry.js';
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
    const { x, y } = getCanvasPoint(dom.canvas, event);
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
