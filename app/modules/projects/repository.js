// Pattern: Repository. The only place that knows projects live in the "projects" collection.
// Everything it returns is a validated Project; bad documents are skipped, never thrown at the board.
import { Project } from "./model.js";

const COLLECTION = "projects";

export class ProjectRepository {
  /** @param {import("../../core/db.js").DbGateway} db */
  constructor(db) { this.db = db; }

  #parse(rows) {
    const out = [];
    for (const row of rows) {
      try { out.push(new Project(row)); }
      catch (e) { console.warn(`Skipping invalid project "${row.id}": ${e.message}`); }
    }
    return out.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));   // stable: ties keep db order
  }

  /** Active (not archived) projects by order. */
  async list() { return this.#parse(await this.db.collection(COLLECTION).list()).filter(p => !p.isArchived); }
  async listArchived() { return this.#parse(await this.db.collection(COLLECTION).list()).filter(p => p.isArchived); }

  /** @returns {Promise<Project|null>} null when missing or invalid */
  async get(id) {
    const snap = await this.db.doc(`${COLLECTION}/${id}`).get();
    if (!snap.exists) return null;
    return this.#parse([{ id, data: snap.data }])[0] ?? null;
  }

  /** Writes status and updatedAt after validating the result. Omitted fields keep their current value. */
  async updateStatus(id, { status, updatedAt = new Date().toISOString() } = {}) {
    const snap = await this.db.doc(`${COLLECTION}/${id}`).get();
    if (!snap.exists) throw new Error(`No project "${id}"`);
    const next = { status: status ?? snap.data.status, updatedAt };
    new Project({ id, data: { ...snap.data, ...next } });   // throws ValidationError before anything is written
    await this.db.doc(`${COLLECTION}/${id}`).update(next);
  }

  /** Stores which questions are answered. Keeps strings that exist in `questions` (each once); stale entries are dropped. */
  async updateAnswered(id, list) {
    const snap = await this.db.doc(`${COLLECTION}/${id}`).get();
    if (!snap.exists) throw new Error(`No project "${id}"`);
    const questions = snap.data.questions ?? [];
    const answered = [...new Set(list)].filter(q => typeof q === "string" && questions.includes(q));
    new Project({ id, data: { ...snap.data, answered } });
    await this.db.doc(`${COLLECTION}/${id}`).update({ answered });
  }

  /** @param {(active:Project[]) => void} cb @param {(e:Error) => void} [onError] snapshot failure @returns {() => void} unsubscribe */
  onChange(cb, onError) { return this.db.collection(COLLECTION).onChange(rows => cb(this.#parse(rows).filter(p => !p.isArchived)), onError); }
}
