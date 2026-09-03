/**
 * Minimal pub/sub used for cross-cutting signals that don't belong in the
 * state tree — e.g. "image:loaded", "history:changed", "request:save".
 *
 * The store handles *data*; the bus handles *events*. Keeping them separate
 * means a feature can announce something happened without knowing who cares.
 */
function createEventBus() {
  const channels = new Map();

  /**
   * Subscribe to an event. Returns an unsubscribe fn.
   * @param {string} event
   * @param {(payload:any)=>void} handler
   */
  const on = (event, handler) => {
    if (!channels.has(event)) channels.set(event, new Set());
    channels.get(event).add(handler);
    return () => off(event, handler);
  };

  /** Subscribe once; auto-unsubscribes after the first emit. */
  const once = (event, handler) => {
    const wrapped = (payload) => { off(event, wrapped); handler(payload); };
    return on(event, wrapped);
  };

  const off = (event, handler) => {
    channels.get(event)?.delete(handler);
  };

  /** Emit an event to all current subscribers. */
  const emit = (event, payload) => {
    channels.get(event)?.forEach((handler) => handler(payload));
  };

  return { on, once, off, emit };
}

/** Shared singleton — import the same bus everywhere. */
export const bus = createEventBus();

/** Canonical event names, so we never typo a string literal. */
export const EVENTS = Object.freeze({
  IMAGE_LOADED: 'image:loaded',
  IMAGE_CLEARED: 'image:cleared',
  HISTORY_CHANGED: 'history:changed',
  REQUEST_SAVE: 'request:save',
  TOAST: 'ui:toast',
  /** The text panel opened/closed; payload { open, commit } (commit=false means discard). */
  TEXT_PANEL: 'text:panel',
});
