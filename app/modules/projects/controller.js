// Pattern: thin Controller (use cases) + Observer. The controller subscribes to the repository once, keeps the
// latest snapshot, and repaints whatever page is showing when data, an extension or the log changes.
// Extension points and bus events are listed in ./index.js.
import { boardView, boardTop, boardList } from "./views/board.js";
import { filterProjects, STATUS_LABEL } from "./model.js";
import { fmtDate } from "../../core/html.js";
import { projectView } from "./views/project.js";

const LOAD_ERROR = "Could not load the board data. Reload the page; on claude.ai, open it while signed in.";
const isNode = x => typeof x?.nodeType === "number";
const hasDraft = el => typeof el.hasDraft === "function" ? el.hasDraft() === true : el.hasDraft === true;

export class ProjectsController {
  #repo; #ctx; #clipboard;
  #list = []; #ready = null; #canWrite = false;   // #canWrite resolved once per page visit so repaints stay synchronous
  #current = null;          // repaint closure for the page on screen
  #shown = null;            // project on the project page, for Copy brief and log.changed
  #lastKey = null;          // skip repainting a project page whose data did not change (keeps panel forms alive)
  #filter = { stage: "", query: "" };   // board filter: lives here for the page's life, never in the hash
  #fullBoard = true;        // next board paint rebuilds the whole page (a late board.actions provider needs the slot)
  #mounted = null;          // {id, count, raws, els} panels on the project page, reused while one has a draft
  #settings = null;         // last bus "settings.changed" payload {title, owner}: newer than shell.ownerLine until the shell catches up

  /** @param {{repo:ProjectRepository, ctx:object, clipboard?:{writeText:Function}}} deps ctx = the module registration context */
  constructor({ repo, ctx, clipboard }) {
    this.#repo = repo; this.#ctx = ctx; this.#clipboard = clipboard;
    // One delegated listener: writeText must run inside the click handler to keep the user gesture.
    ctx.shell.region?.addEventListener?.("click", e => {
      if (e.target?.closest?.("[data-action='copy-brief']")) this.copyBrief();
      const q = e.target?.closest?.("[data-action='toggle-answered']");
      if (q) this.toggleAnswered(Number(q.dataset?.index ?? q.getAttribute?.("data-index")));
      if (e.target?.closest?.("[data-action='clear-filters']")) this.clearFilters();
    });
    ctx.shell.region?.addEventListener?.("input", e => {
      const key = e.target?.getAttribute?.("data-filter");
      if (key) this.setFilter({ [key]: e.target.value });
    });
    ctx.extensions.onAdd("project.panel", () => { this.#lastKey = null; this.#repaint(); });
    ctx.extensions.onAdd("project.cardMeta", () => this.#repaint());
    ctx.extensions.onAdd("project.actions", () => { this.#lastKey = null; this.#repaint(); });
    ctx.extensions.onAdd("board.actions", () => { this.#fullBoard = true; this.#repaint(); });
    ctx.extensions.onAdd("board.sections", () => this.#repaint());
    ctx.bus.on("settings.changed", payload => { this.#settings = payload ?? null; this.#lastKey = null; this.#repaint(); });
    ctx.bus.on("project.updateStatus", payload => this.updateStatus(payload));
    ctx.bus.on("log.changed", payload => {
      const id = payload?.project?.id ?? payload?.project;
      if (!this.#shown || this.#shown.id === id) this.#repaint();
    });
  }

  /** Bus handler: validate through the model (repository) and write; never throws, toasts on failure. */
  updateStatus(payload) {
    const { id, ...patch } = payload ?? {};
    return this.#repo.updateStatus(id, patch).catch(e => this.#ctx.shell.toast(`Could not update stage: ${e?.message ?? e}`));
  }

  #start() {
    return this.#ready ??= new Promise(resolve => this.#repo.onChange(
      list => { this.#list = list; resolve(); this.#repaint(); },
      () => this.#ctx.shell.renderError(LOAD_ERROR)));
  }
  #repaint() { Promise.resolve(this.#current?.()).catch(e => this.#ctx.shell.renderError(e?.message)); }
  /** Make `paint` the live page; the returned dispose only clears it if no newer page replaced it. */
  async #mount(paint) {
    this.#current = paint; await paint();
    return () => { if (this.#current === paint) { this.#current = null; this.#shown = null; this.#mounted = null; } };
  }

  /** Card meta from every "project.cardMeta" provider: first text wins, entries add up. No providers -> no entries. */
  #meta(project) {
    const providers = this.#ctx.extensions.list("project.cardMeta");
    if (!providers.length) return { text: null };
    const out = { text: null, entries: 0, latestTs: null };
    for (const provider of providers) {
      try {
        const m = provider(project);
        if (m === null || m === undefined) continue;
        if (typeof m !== "object") throw new TypeError("card meta must be {text, entries} or null");
        out.text ??= m.text ?? null;
        if (Number.isFinite(m.entries)) out.entries += m.entries;
        if (m.latestTs && !Number.isNaN(Date.parse(m.latestTs)) && (!out.latestTs || Date.parse(m.latestTs) > Date.parse(out.latestTs))) out.latestTs = m.latestTs;
      } catch (e) { console.warn("Card meta provider failed", e); }
    }
    return out;
  }

  #panels(project) {
    const renders = this.#ctx.extensions.list("project.panel");
    const m = this.#mounted;
    if (m?.id === project.id && m.count === renders.length && m.els.some(hasDraft)) {
      m.els.forEach(el => el.refresh?.(project));   // kept for the draft: let the panel pick up changes (the stage) without a rebuild
      return m;
    }
    const out = renders.flatMap(render => { try { return [render(project, this.#ctx)]; } catch (e) { console.warn("Project panel failed", e); return []; } });
    return this.#mounted = { id: project.id, count: renders.length, raws: out.filter(p => !isNode(p)), els: out.filter(isNode) };
  }

  /** "board.sections" providers: (ctx, ids) => {title, rows:[{projectId, ts, status?, text}]} | null. Rows are resolved to sheet names here
   *  (log never sees projects); rows of sheets that are not on the board are dropped. The filter does not apply. */
  #sections() {
    const byId = new Map(this.#list.map(p => [p.id, p])), ids = new Set(byId.keys());
    return this.#ctx.extensions.list("board.sections").flatMap(provider => {
      try {
        const s = provider(this.#ctx, ids);
        if (!s) return [];
        const rows = s.rows.filter(r => byId.has(r.projectId)).map(r => ({ href: `#/p/${encodeURIComponent(r.projectId)}`, name: byId.get(r.projectId).name,
          date: fmtDate(r.ts), text: r.text, stage: r.status ? (STATUS_LABEL[r.status] ?? r.status) : null }));
        return [{ title: s.title, rows }];
      } catch (e) { console.warn("Board section provider failed", e); return []; }
    });
  }

  /** Append every provider's element for `point` into the page's actions slot; a failing provider is skipped. */
  #actions(point, ...args) {
    const slot = this.#ctx.shell.region.querySelector?.("[data-actions-slot]");
    if (!slot) return;
    const els = this.#ctx.extensions.list(point).flatMap(fn => { try { return [fn(...args, this.#ctx)]; } catch (e) { console.warn(`Action "${point}" failed`, e); return []; } });
    slot.append(...els.filter(isNode));
  }

  async showBoard() {
    this.#ctx.shell.renderLoading("Loading the board");
    await this.#start();
    return this.#mount(() => {
      this.#shown = null;
      const { shell } = this.#ctx;
      if (!this.#list.length) { this.#fullBoard = true; return shell.renderEmpty("No projects yet", "New projects will appear here as sheets."); }
      const metas = new Map(this.#list.map(project => [project, this.#meta(project)]));
      const counted = [...metas.values()].some(m => m.entries !== undefined);
      const props = { sections: this.#sections(), total: this.#list.length, filter: this.#filter,
        entries: counted ? [...metas.values()].reduce((n, m) => n + (m.entries ?? 0), 0) : undefined,   // whole board, so the strip keeps its shape when a filter matches nothing
        cards: filterProjects(this.#list, this.#filter).map(project => ({ project, meta: metas.get(project), index: this.#list.indexOf(project) })) };
      const slot = !this.#fullBoard && shell.region.querySelector?.("[data-board-list]");
      if (slot) {
        const top = shell.region.querySelector("[data-board-top]");
        if (top) top.innerHTML = String(boardTop(props));
        slot.innerHTML = String(boardList(props));
        return;
      }   // repaint the list only: the inputs keep their text and focus
      this.#fullBoard = false;
      shell.show(boardView(props));
      this.#actions("board.actions");
    });
  }

  /** Board filter: {stage?: stage id or "", query?: text}. */
  setFilter(patch) { this.#filter = { ...this.#filter, ...patch }; this.#repaint(); }
  clearFilters() {
    this.#filter = { stage: "", query: "" };
    for (const el of this.#ctx.shell.region.querySelectorAll?.("[data-filter]") ?? []) el.value = "";   // the inputs are not repainted, so reset them here
    this.#repaint();
  }

  async showProject(id) {
    this.#ctx.shell.renderLoading("Opening the sheet");
    await this.#start();
    this.#canWrite = await this.#ctx.user.canWrite();
    this.#lastKey = null; this.#mounted = null;
    return this.#mount(async () => {
      const project = this.#list.find(p => p.id === id) ?? await this.#repo.get(id);   // archived projects stay reachable
      if (this.#current === null) return;
      if (!project) { this.#shown = null; return this.#ctx.shell.renderNotFound(`/p/${id}`); }
      const meta = this.#meta(project);
      const key = JSON.stringify([project.toData(), meta.entries, meta.latestTs, this.#canWrite]);
      if (key === this.#lastKey) return;
      this.#lastKey = key; this.#shown = project;
      const { shell } = this.#ctx;
      const { raws, els } = this.#panels(project);
      shell.show(projectView({ project, owner: (this.#settings ? this.#settings.owner : shell.ownerLine) || "Unassigned", meta, canWrite: this.#canWrite, panels: raws, hasPanels: raws.length + els.length > 0 }));
      if (els.length) shell.region.querySelector?.("[data-panel-slot]")?.append(...els);
      this.#actions("project.actions", project);
    });
  }

  /** Flip one question of the shown project between open and answered (writers only; the view shows no control to readers). */
  async toggleAnswered(index) {
    const p = this.#shown, text = p?.questions[index], { shell } = this.#ctx;
    if (text === undefined) return;
    try {
      if (!this.#canWrite) return;
      const reopen = p.answered.includes(text);
      await this.#repo.updateAnswered(p.id, reopen ? p.answered.filter(q => q !== text) : [...p.answered, text]);
      shell.toast(reopen ? "Reopened" : "Marked answered");
    } catch (e) { shell.toast(`Could not update the question: ${e?.message ?? e}`); }
  }

  /** Copy the shown project's brief. Call from the click handler itself (user gesture). */
  copyBrief() {
    const text = this.#shown?.brief;
    if (!text) return Promise.resolve();
    const { shell } = this.#ctx;
    return new Promise(res => res((this.#clipboard ?? globalThis.navigator?.clipboard).writeText(text)))   // writeText runs synchronously here
      .then(() => shell.toast("Brief copied"), () => {
        const el = shell.region.querySelector?.("[data-brief]"), sel = globalThis.getSelection?.();
        if (el && sel) { const r = globalThis.document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); }
        shell.toast("Select and copy");
      });
  }
}
