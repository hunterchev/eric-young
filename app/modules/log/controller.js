// Pattern: thin controller. Wires views to the repository; talks to other modules only through the
// event bus (core/events.js). The rules live in LogEntry and UpdateParser.
import { fmtDate } from "../../core/html.js";
import { STAGES } from "../../core/stages.js";
import { LogEntry, SOURCES, MAX_TEXT } from "./model.js";
import { UpdateParser } from "./parser.js";
import { renderPanel, renderReadOnly } from "./views/panel.js";
import { renderEntries, renderDecisions, renderLogError } from "./views/entries.js";

const LABEL = Object.fromEntries(STAGES.map(s => [s.id, s.label]));
const labelOf = id => LABEL[id] ?? id;
const DISARM_MS = 4000;

export class LogController {
  #live = new Map();   // projectId -> {root, host, armed, armedEl, form, canWrite}: the panel currently on screen for that project
  #off;                // repository unsubscribe
  #failed = false;     // the log collection reported an error: panels show the in-panel error state, also when they mount later

  /** @param {{repo:import("./repository.js").LogRepository, bus:{emit:(type:string,payload:any)=>void}, user:object, shell:object, mode?:"artifact"|"file"|"dev", doc?:Document, now?:()=>string, timers?:{set:Function}}} deps */
  constructor({ repo, bus, user, shell, mode = "artifact", doc = globalThis.document, now = () => new Date().toISOString(),
    timers = { set: (f, ms) => { const t = setTimeout(f, ms); t.unref?.(); return t; } } }) {
    Object.assign(this, { repo, bus, user, shell, mode, doc, now, timers });
    // Panels the page no longer shows are forgotten here, so the registry never outgrows the screen.
    // One snapshot = one redraw pass + one "log.changed" with project null ("any"), so the board repaints live.
    this.#off = repo.onChange(() => { this.#drawAll(); bus.emit("log.changed", { project: null }); });
  }

  /** Redraw the panels still on screen and forget the rest. */
  #drawAll() { this.#live.forEach((st, id) => (st.root.isConnected ? this.#draw(id) : this.#live.delete(id))); }

  /** Stop listening to the repository and drop every panel. */
  dispose() { this.#off?.(); this.#live.clear(); }

  /** The log collection failed to load or sync: say so inside the log panel, leave the rest of the page alone. */
  fail() {
    this.#failed = true;
    this.#drawAll();
  }

  /** Project-page panel. Returns at once; `.ready` resolves when the write permission is known and the form (or read-only note) is in.
   *  `.hasDraft()` is true while the textarea holds unsaved text. */
  render(project) {
    const cur = { ...project };   // what the project is known to be; updated after each logged change
    const root = this.doc.createElement("div");
    root.className = "region";
    this.#live.forEach((st, id) => st.root.isConnected || this.#live.delete(id));   // panels the page dropped
    // The page rebuilds this panel after a save; if the old textarea had focus, the new one takes it (focus never drops to BODY).
    const oldText = this.#live.get(project.id)?.form?.textarea;
    const refocus = !!oldText && this.doc.activeElement === oldText;
    const st = { root, host: this.doc.createElement("div"), armed: null, armedEl: null, form: null, canWrite: false };
    let top = null;
    root.hasDraft = () => top?.hasDraft?.() ?? false;
    /** The project page was repainted while a draft kept this panel: take over the new stage, leave the textarea alone. */
    root.refresh = p => { if (p?.status && p.status !== cur.status) { cur.status = p.status; top?.setStage?.(p.status); } };
    this.#live.set(project.id, st);
    this.#draw(project.id);
    root.append(st.host);
    root.ready = Promise.resolve(this.user.canWrite()).catch(() => false).then(can => {
      st.canWrite = can;
      top = can
        ? renderPanel({ doc: this.doc, project: cur, statuses: STAGES, sources: SOURCES, maxText: MAX_TEXT, parse: UpdateParser.parse, onSubmit: v => this.submit(cur, v) })
        : renderReadOnly({ doc: this.doc, mode: this.mode });
      st.form = top;
      root.replaceChildren(top, st.host);
      this.#draw(project.id);
      if (refocus) top.textarea?.focus?.();
      return root;
    });
    return root;
  }

  /** `focusId`: the entry whose remove button takes focus after the redraw. An armed button that had focus keeps it. */
  #draw(projectId, focusId = null) {
    const st = this.#live.get(projectId);
    if (!st) return;
    if (focusId === null && st.armedEl !== null && this.doc.activeElement === st.armedEl) focusId = st.armed;
    st.armedEl = null;   // cleared first: the blur a removed button may fire must not disarm
    if (this.#failed) return st.host.replaceChildren(renderLogError({ doc: this.doc }));
    const entries = this.repo.listFor(projectId);
    const list = renderEntries({ doc: this.doc, entries, canWrite: st.canWrite, armedId: st.armed, labelOf, onRemove: id => this.remove(projectId, id) });
    st.host.replaceChildren(renderDecisions({ doc: this.doc, entries }), list);
    const b = list.removeButtons?.get(st.armed);
    if (b) {
      st.armedEl = b;
      b.addEventListener("blur", () => { if (st.armedEl === b) this.#disarm(projectId, st.armed); });
    }
    list.removeButtons?.get(focusId)?.focus?.();
  }

  /** Put an armed remove back to "remove" (its 4 s ran out, or it lost focus). Focus stays on the button if it had it. */
  #disarm(projectId, id) {
    const st = this.#live.get(projectId);
    if (!st || st.armed !== id) return;
    const focused = st.armedEl !== null && this.doc.activeElement === st.armedEl;
    st.armed = null;
    this.#draw(projectId, focused ? id : null);
  }

  /** `cur` is the project as the panel knows it; it is updated in place when the stage changes.
   *  @returns {Promise<boolean>} true when saved (the form then clears itself). */
  async submit(cur, { text, source, status }) {
    let entry, changed;
    try {
      const ts = this.now();
      changed = status !== cur.status;
      entry = LogEntry.fromUpdate(cur.id, source, text, changed ? status : undefined, ts, UpdateParser.parse(text).decided);
      await this.repo.add(entry);
    } catch (e) {
      this.shell.toast(`Could not save: ${e?.message ?? e}`);
      return false;
    }
    this.shell.toast("Logged");
    // Fire-and-forget: the projects module validates, writes and toasts its own failure.
    if (changed) {
      cur.status = entry.status;
      this.bus.emit("project.updateStatus", { id: cur.id, status: entry.status, updatedAt: entry.ts });
    } else this.bus.emit("project.updateStatus", { id: cur.id, updatedAt: entry.ts });
    this.bus.emit("log.changed", { project: cur.id });
    return true;
  }

  /** Two-step: the first click arms the entry, the second deletes it. */
  async remove(projectId, id) {
    const st = this.#live.get(projectId);
    if (st && st.armed !== id) {
      st.armed = id;
      this.timers.set(() => this.#disarm(projectId, id), DISARM_MS);   // a stale timer is a no-op: #disarm checks the id
      return this.#draw(projectId, id);
    }
    if (st) st.armed = null;
    try {
      await this.repo.remove(id);
      this.shell.toast("Removed");
      this.bus.emit("log.changed", { project: projectId });
    } catch (e) { this.shell.toast(`Could not remove: ${e?.message ?? e}`); }
    this.#draw(projectId);
  }

  /** Card meta for the projects module: latest entry's summary as "<date> — <summary>" (or null), the entry count and `latestTs` (ISO of the latest entry, or null). */
  cardMeta = project => {
    const list = this.repo.listFor(project.id);
    const e = list[0];
    return { text: e ? `${fmtDate(e.ts)} — ${e.summary}` : null, entries: list.length, latestTs: e?.ts ?? null };
  };
  /** "board.sections" provider: the eight latest entries across the board, newest first. `ids` (the sheets on the board) is optional.
   *  Rows are {projectId, ts, status|null, text (the entry's summary)}; the projects module turns them into links with the sheet name. */
  recentSection = (_ctx, ids) => ({
    title: "Recent updates",
    rows: this.repo.recent(8, ids).map(e => ({ projectId: e.project, ts: e.ts, status: e.status ?? null, text: e.summary })),
  });
  /** "project.exportSections" provider: an array of {title, markdown}, newest first; "_None yet._" when a list is empty. */
  exportSections = project => {
    const list = this.repo.listFor(project.id), one = t => t.replace(/\s+/g, " ");
    const md = lines => lines.length ? lines.join("\n") : "_None yet._";
    return [
      { title: "Decisions", markdown: md(list.filter(e => e.decided).map(e => `- ${fmtDate(e.ts)} — ${one(e.decided)}`)) },
      { title: "Running log", markdown: md(list.map(e => `- ${fmtDate(e.ts)} — ${e.source} — ${one(e.text)}`)) },
    ];
  };
}
