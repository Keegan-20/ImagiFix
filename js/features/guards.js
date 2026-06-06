/**
 * Shared precondition checks for editor actions.
 */
import { bus, EVENTS } from '../core/eventBus.js';

/**
 * Ensure an image is loaded before an edit runs; otherwise nudge the user.
 * @param {object} store
 * @returns {boolean} true when it's safe to proceed.
 */
export function ensureImage(store) {
  if (store.getState().image) return true;
  bus.emit(EVENTS.TOAST, { type: 'error', message: 'Select an image to begin editing.' });
  return false;
}
