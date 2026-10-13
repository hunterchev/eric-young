// Pattern: Entity with self-validation. A Project can only exist if its data is valid,
// so the repository, controller and views never see a half-checked document.
import { required, oneOf } from "../../core/validation.js";
import { STAGES } from "../../core/stages.js";

export const STATUSES = STAGES.map(s => s.id);
export const STATUS_LABEL = Object.fromEntries(STAGES.map(s => [s.id, s.label]));

const pad = n => String(n).padStart(2, "0");

export class Project {
  /** @param {{id:string, data:object}} doc @throws {ValidationError} */
  constructor({ id, data }) {
    const d = data ?? {};
    this.id = required(id, "id");
    this.name = required(d.name, "name");
    this.status = oneOf(d.status, STATUSES, "status");
    this.tagline = d.tagline ?? "";
    this.summary = d.summary ?? "";
    this.components = d.components ?? [];
    this.questions = d.questions ?? [];
    this.answered = Array.isArray(d.answered) ? d.answered.filter(q => typeof q === "string") : [];   // question texts marked answered; a text that no longer matches reads as open
    this.next = d.next ?? [];
    this.images = d.images ?? [];
    this.brief = d.brief ?? "";
    this.order = Number.isFinite(d.order) ? d.order : null;
    this.updatedAt = d.updatedAt ?? null;
    this.archived = d.archived === true;
    this.extra = Object.fromEntries(Object.entries(d).filter(([k]) => !(k in this)));   // unknown fields survive toData()
  }

  /** Attachments are {id, caption, kind}; kind "image" is the default when absent (legacy data), "pdf" is a document. */
  get photos() { return this.images.filter(a => a.kind !== "pdf"); }
  get documents() { return this.images.filter(a => a.kind === "pdf"); }
  /** Id of the first image (never a PDF), or null. */
  get cover() { return this.photos[0]?.id ?? null; }
  /** 0-5, position in the six-stage track. */
  get stageIndex() { return STATUSES.indexOf(this.status); }
  get stageLabel() { return STATUS_LABEL[this.status]; }
  get isArchived() { return this.archived; }
  /** Questions as [{text, index, answered}], open ones first (stable), answered ones after. */
  get questionRows() {
    const rows = this.questions.map((text, index) => ({ text, index, answered: this.answered.includes(text) }));
    return [...rows.filter(r => !r.answered), ...rows.filter(r => r.answered)];
  }
  /** "PRJ-03" from the board order; falls back to the id. */
  get number() { return this.order === null ? this.id : `PRJ-${pad(this.order)}`; }
  /** @param {number} index 0-based position on the board @param {number} total */
  sheetNumber(index, total) { return `SHT ${pad(index + 1)} / ${pad(total)}`; }

  toData() {
    const { id, extra, archived, order, updatedAt, answered, ...rest } = this;
    return { ...structuredClone(extra), ...structuredClone(rest), ...(answered.length ? { answered: [...answered] } : {}), ...(order !== null ? { order } : {}), ...(updatedAt ? { updatedAt } : {}), ...(archived ? { archived } : {}) };
  }
}

/** Pure board filter. stage: a stage id, or "" for all. query: case-insensitive substring over name and tagline. */
export function filterProjects(projects, { stage = "", query = "" } = {}) {
  const q = query.trim().toLowerCase();
  return projects.filter(p => (!stage || p.status === stage) && (!q || `${p.name}\n${p.tagline}`.toLowerCase().includes(q)));
}
export const isFiltered = ({ stage = "", query = "" } = {}) => Boolean(stage || query.trim());
