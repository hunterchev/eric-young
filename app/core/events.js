// Pattern: Observer. Tiny in-process bus for cross-module notifications
// (e.g. "log:added"). Modules never import each other to talk; they emit here.
export class EventBus {
  #handlers = new Map();
  /** @param {string} type @param {(payload:any)=>void} fn @returns {() => void} unsubscribe */
  on(type, fn) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, new Set());
    this.#handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) { this.#handlers.get(type)?.delete(fn); }
  /** One failing listener never blocks the others. */
  emit(type, payload) {
    for (const fn of [...(this.#handlers.get(type) ?? [])]) {
      try { fn(payload); } catch (e) { console.error(`EventBus handler for "${type}" failed`, e); }
    }
  }
}
