// Pattern: Repository over DbGateway. Keeps one live in-memory copy of the `log` collection as
// LogEntry objects so reads (panel, card meta) are synchronous; writes go to the db and come back through onChange.
import { LogEntry } from "./model.js";

export class LogRepository {
  #col; #db; #rows = []; #subs = new Set();

  constructor(db) { this.#db = db; this.#col = db.collection("log"); }

  /** Subscribes and returns at once; each snapshot refreshes the cache and notifies subscribers. Returns unsubscribe. */
  start(onError) {
    return this.#col.onChange(rows => {
      this.#rows = rows.flatMap(r => {
        try { return [new LogEntry({ ...r.data, id: r.id })]; }
        catch (e) { console.warn(`log: skipped malformed entry ${r.id}: ${e.message}`); return []; }
      });
      this.#subs.forEach(cb => cb());
    }, onError);
  }

  async add(entry) { return (await this.#col.add(entry.toData())).id; }
  remove(id) { return this.#db.doc(`log/${id}`).delete(); }
  /** Newest first; equal timestamps keep the later write first. */
  listFor(projectId) { return this.#rows.filter(r => r.project === projectId).reverse().sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)); }
  /** The latest `limit` entries across projects (only those in `ids` when given), newest first. */
  recent(limit, ids) { return this.#rows.filter(r => !ids || ids.has(r.project)).reverse().sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, limit); }
  latestFor(projectId) { return this.listFor(projectId)[0] ?? null; }
  count() { return this.#rows.length; }
  onChange(cb) { this.#subs.add(cb); return () => this.#subs.delete(cb); }
}
