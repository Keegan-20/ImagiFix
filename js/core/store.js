/**
 * A tiny observable store — the single source of truth for the editor.
 *
 * Redux-ish without the ceremony: state is read-only from the outside,
 * updates flow through `setState` (a shallow merge) or `update` (a producer
 * fn), and every change notifies subscribers. Components subscribe and
 * react; they never reach into each other.
 */
export function createStore(initialState = {}) {
  let state = { ...initialState };
  const subscribers = new Set();

  /** @returns {Readonly<object>} the current state (treat as immutable). */
  const getState = () => state;

  /** Notify every subscriber with the current and previous state. */
  const notify = (prev) => {
    for (const fn of subscribers) fn(state, prev);
  };

  /**
   * Shallow-merge a partial patch into state and notify.
   * No-ops (and skips notifying) when nothing actually changed.
   */
  const setState = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    if (!next) return;

    let changed = false;
    for (const key in next) {
      if (next[key] !== state[key]) { changed = true; break; }
    }
    if (!changed) return;

    const prev = state;
    state = { ...state, ...next };
    notify(prev);
  };

  /**
   * Update via a producer that receives a shallow draft, mutates it, and
   * the result is committed. Handy for nested patches:
   *   update(s => { s.filters = { ...s.filters, blur: 5 }; });
   */
  const update = (producer) => {
    const draft = { ...state };
    producer(draft);
    setState(draft);
  };

  /**
   * Register a listener. Returns an unsubscribe fn.
   * @param {(state:object, prev:object)=>void} fn
   */
  const subscribe = (fn) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  };

  return { getState, setState, update, subscribe };
}
