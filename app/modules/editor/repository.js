// Pattern: Repository. The editor's view of the "projects" collection, straight over the core DbGateway
// (the projects module is not imported). Rows are plain {id, data}; the editor only writes fields it owns.
import { slugify, uniqueSlug, briefTemplate } from "./model.js";

const COLLECTION = "projects";
const byOrder = (a, b) => (a.data.order ?? Infinity) - (b.data.order ?? Infinity);
const isSheet = r => typeof r.data?.name === "string" && r.data.name.trim() !== "";   // skip rows the board would also skip

export class EditorRepository {
  /** @param {import("../../core/db.js").DbGateway} db */
  constructor(db) { this.db = db; }

  async #rows() { return (await this.db.collection(COLLECTION).list()).filter(isSheet); }

  /** @returns {Promise<{id:string, data:object}|null>} archived or not; null when missing */
  async get(id) {
    const s = await this.db.doc(`${COLLECTION}/${id}`).get();
    return s.exists ? { id, data: s.data } : null;
  }

  /** Archived sheets by board order. */
  async listArchived() { return (await this.#rows()).filter(r => r.data.archived === true).sort(byOrder); }

  /** New sheet from a validated ProjectDraft: unique slug, order = max + 1, standard brief unless the draft has one. @returns {Promise<string>} the new id */
  async create(draft) {
    const rows = await this.#rows();
    const id = uniqueSlug(slugify(draft.name), (await this.db.collection(COLLECTION).list()).map(r => r.id));
    const order = rows.reduce((m, r) => Math.max(m, Number.isFinite(r.data.order) ? r.data.order : 0), 0) + 1;
    await this.db.doc(`${COLLECTION}/${id}`).set({
      order, name: draft.name, tagline: draft.tagline, status: draft.status, summary: draft.summary,
      components: draft.components, questions: draft.questions, next: draft.next, images: [], brief: draft.brief || briefTemplate(draft.name),
      updatedAt: new Date().toISOString(),
    });
    return id;
  }

  /** Merge a patch into an existing sheet (and stamp updatedAt). Throws when the sheet is gone. */
  async update(id, patch) {
    if (!(await this.get(id))) throw new Error(`No project "${id}"`);
    await this.db.doc(`${COLLECTION}/${id}`).update({ ...patch, updatedAt: new Date().toISOString() });
  }

  /** Archive hides a sheet from the board; its page and log stay. */
  async setArchived(id, archived) {
    if (!(await this.get(id))) throw new Error(`No project "${id}"`);
    await this.db.doc(`${COLLECTION}/${id}`).update({ archived: archived === true });
  }
}
