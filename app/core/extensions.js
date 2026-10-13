// Pattern: Observer/registry. Feature modules extend each other through named points
// (e.g. "project.panel", "project.cardMeta"), never by importing each other.
export class Extensions {
  #points = new Map();   // point -> fn[]
  #watchers = new Map(); // point -> Set(cb)

  /** Register fn at point. @returns {() => void} unsubscribe */
  add(point, fn) {
    if (!this.#points.has(point)) this.#points.set(point, []);
    this.#points.get(point).push(fn);
    for (const cb of [...(this.#watchers.get(point) ?? [])]) {
      try { cb(fn); } catch (e) { console.error(`Extensions onAdd for "${point}" failed`, e); }
    }
    return () => { const fns = this.#points.get(point), i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); };
  }
  /** @returns {Function[]} copy, in registration order */
  list(point) { return [...(this.#points.get(point) ?? [])]; }
  /** cb(fn) whenever a new fn is added to point. @returns {() => void} unsubscribe */
  onAdd(point, cb) {
    if (!this.#watchers.has(point)) this.#watchers.set(point, new Set());
    this.#watchers.get(point).add(cb);
    return () => this.#watchers.get(point).delete(cb);
  }
}
