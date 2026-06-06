/**
 * Undo / redo built on lightweight *state snapshots* rather than pixel data.
 *
 * The original implementation pushed a full `ImageData` (~2.3 MB at 980×600)
 * onto the stack for every edit. Here a snapshot is a few numbers, two small
 * objects and a reference to the current image bitmap — kilobytes, not
 * megabytes — and restoring is just a store update that triggers a repaint.
 *
 * `past` is a stack whose top is always the current committed state; `future`
 * holds states that were undone and can be redone.
 */
import { bus, EVENTS } from '../core/eventBus.js';

export function createHistory(store) {
  /** @type {object[]} */ let past = [];
  /** @type {object[]} */ let future = [];

  /** Capture the committed (non-transient) slice of state. */
  const snapshot = () => {
    const s = store.getState();
    return {
      image: s.image,
      filters: { ...s.filters },
      rotation: s.rotation,
      flipH: s.flipH,
      flipV: s.flipV,
      text: { ...s.text },
    };
  };

  /** Push a snapshot back into the store, clearing any live crop selection. */
  const apply = (snap) => {
    store.setState({
      image: snap.image,
      filters: { ...snap.filters },
      rotation: snap.rotation,
      flipH: snap.flipH,
      flipV: snap.flipV,
      text: { ...snap.text },
      activeTool: null,
      crop: { rect: null },
    });
  };

  const announce = () =>
    bus.emit(EVENTS.HISTORY_CHANGED, { canUndo: canUndo(), canRedo: canRedo() });

  const canUndo = () => past.length > 1;
  const canRedo = () => future.length > 0;

  /** Record the current state as a new committed entry. */
  const record = () => {
    past.push(snapshot());
    future = [];
    announce();
  };

  /** Start a fresh timeline from the current state (e.g. on new image). */
  const reset = () => {
    past = [snapshot()];
    future = [];
    announce();
  };

  const undo = () => {
    if (!canUndo()) return;
    future.push(past.pop());
    apply(past[past.length - 1]);
    announce();
  };

  const redo = () => {
    if (!canRedo()) return;
    const next = future.pop();
    past.push(next);
    apply(next);
    announce();
  };

  return { record, reset, undo, redo, canUndo, canRedo };
}
