// Models for the editor: ProjectDraft (what a form may produce), slug helpers and the standard Grok brief.
// Self-validating like core/settings.js. The projects module is not imported (modules never import each other),
// so the few project rules (status, name required) are restated here through core/validation.js.
import { oneOf, ValidationError } from "../../core/validation.js";
import { STAGES } from "../../core/stages.js";

export const STATUSES = STAGES.map(s => s.id);
export const STATUS_LABEL = Object.fromEntries(STAGES.map(s => [s.id, s.label]));
const LIST_FIELDS = ["components", "questions", "next"];
export const MAX_NAME = 80, MAX_TAGLINE = 200, MAX_TEXT = 20000, MAX_LIST = 4000;   // keep a sheet well under the db per-document limit
const LIST_LABEL = { components: "Parts and sensors", questions: "Open questions", next: "Next steps" };
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
const PDF_TYPE = "application/pdf";
export const ATTACH_TYPES = [...IMAGE_TYPES, PDF_TYPE];
/** "pdf" or "image" from an upload's content type (the default for anything else, as for legacy entries). */
export const attachmentKind = contentType => contentType === PDF_TYPE ? "pdf" : "image";

/** One item per line, trimmed, blank lines dropped. Arrays pass through the same cleaning. */
export const splitLines = v => (Array.isArray(v) ? v : String(v ?? "").split(/\r?\n/)).map(s => String(s).trim()).filter(Boolean);
export const joinLines = list => (list ?? []).join("\n");
const cap = (s, max, label) => { if (s.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer`); return s; };

export class ProjectDraft {
  /** @param {object} v form values (strings) or project data (arrays); `name` is optional when editing an existing sheet. @throws {ValidationError} */
  constructor(v = {}, { nameRequired = true } = {}) {
    const name = String(v.name ?? "").trim();
    if (nameRequired && !name) throw new ValidationError("Name is required");
    this.name = cap(name, MAX_NAME, "Name");
    this.tagline = cap(String(v.tagline ?? "").trim(), MAX_TAGLINE, "Tagline");
    this.summary = cap(String(v.summary ?? "").trim(), MAX_TEXT, "Summary");
    this.brief = cap(String(v.brief ?? "").trim(), MAX_TEXT, "Grok brief");
    this.status = oneOf(v.status === undefined || v.status === "" ? "idea" : v.status, STATUSES, "Status");
    for (const f of LIST_FIELDS) { this[f] = splitLines(v[f]); cap(joinLines(this[f]), MAX_LIST, LIST_LABEL[f]); }
  }
  /** The fields an edit may change (never the name, order or images). */
  toPatch() { const { name, ...rest } = this; return rest; }
}

/** "Pump Controls v2!" -> "pump-controls-v2"; never empty. */
export const slugify = name => String(name ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "") || "project";
/** base, then base-2, base-3 ... until it is not in existingIds. */
export const uniqueSlug = (base, existingIds) => {
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

/** The block the dashboard's update parser reads (no percent: the board tracks stage only). */
export const DASHBOARD_BLOCK = `At the end of EVERY session, print this block exactly so it can be pasted into the dashboard:
DASHBOARD UPDATE
STATUS: idea | research | design | prototype | test | done
DONE: <what was worked out this session, 2-4 lines>
NEXT: <the next concrete step>
OPEN: <any question Eric still needs to answer>`;

/** The standard brief for a new project: role line, Spec so far, How to work, DASHBOARD UPDATE block. */
export const briefTemplate = name => `You are the engineering assistant for the ${String(name).trim().toUpperCase()} project. Eric is a senior oilfield mechanical engineer. Help him develop it from idea to working design.

Spec so far:
- Nothing recorded yet. Start by asking what the project must do.

How to work: think like a field engineer. Give sizes, load numbers, part types and vendors when you can. Ask one question at a time only when you truly cannot proceed. Keep a list of decisions made.

${DASHBOARD_BLOCK}`;
