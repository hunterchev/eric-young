// Pattern: validating value object. One log line: what Grok, Claude or Eric did on a project.
import { required, oneOf, ValidationError } from "../../core/validation.js";
import { STAGES } from "../../core/stages.js";
import { UpdateParser } from "./parser.js";

export const SOURCES = ["Grok", "Eric", "Claude"];
export const MAX_TEXT = 20000;
export const MAX_DECIDED = 2000;
const STATUS_IDS = STAGES.map(s => s.id);

export class LogEntry {
  /** @param {{id?:string|null,project:string,source:string,text:string,ts?:string,status?:string|null,decided?:string|null}} d */
  constructor({ id = null, project, source, text, ts = new Date().toISOString(), status = null, decided = null }) {
    this.id = id;
    this.project = required(project, "project");
    this.source = oneOf(source, SOURCES, "source");
    this.text = required(text, "text");
    if (typeof this.text !== "string") throw new ValidationError("text must be a string");
    if (this.text.length > MAX_TEXT) throw new ValidationError(`text is too long (${this.text.length} characters, the limit is ${MAX_TEXT})`);
    if (typeof ts !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(ts) || Number.isNaN(Date.parse(ts))) throw new ValidationError("ts must be an ISO date");
    this.ts = ts;
    this.status = status ? oneOf(status, STATUS_IDS, "status") : null;
    // Optional: a part, vendor or design choice. Blank, or the brief's own "none", means no decision.
    if (decided != null) {
      if (typeof decided !== "string") throw new ValidationError("decided must be a string");
      const d = decided.trim();
      if (d.length > MAX_DECIDED) throw new ValidationError(`decided is too long (${d.length} characters, the limit is ${MAX_DECIDED})`);
      if (d && !/^none\.?$/i.test(d)) this.decided = d;
    }
  }

  /** status is the project's new stage, or undefined when the update changed nothing. */
  static fromUpdate(projectId, source, text, status, ts, decided) {
    return new LogEntry({ project: projectId, source, text, status, ts, decided });
  }

  /** One line for cards and the board: a DASHBOARD UPDATE block's DONE (else DECIDED, else NEXT), otherwise the first non-empty line. */
  get summary() {
    const u = UpdateParser.parse(this.text);
    const decided = /^none\.?$/i.test(u.decided ?? "") ? undefined : u.decided;   // "DECIDED: none" is no decision
    const line = u.done ?? decided ?? u.next ?? this.text.split(/\r?\n/).find(l => l.trim() && !/^\W*DASHBOARD UPDATE\W*$/i.test(l)) ?? "";
    return line.replace(/\s+/g, " ").trim();
  }

  /** Persisted shape; the id lives in the document key, not the data. */
  toData() {
    const d = { project: this.project, ts: this.ts, source: this.source, text: this.text, status: this.status };
    if (this.decided) d.decided = this.decided;
    return d;
  }
}
