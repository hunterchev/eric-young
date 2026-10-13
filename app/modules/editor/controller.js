// Pattern: thin Controller (use cases) over repositories. Routes: /new, /p/:id/edit, /archived, /settings.
// Every use case is a plain method taking plain values, so tests run it without a browser; the only DOM code is
// #wire (one delegated listener per event on the region) and readForm.
import { ValidationError } from "../../core/validation.js";
import { BoardSettings, DEFAULT_SETTINGS } from "../../core/settings.js";
import { ProjectDraft, joinLines, ATTACH_TYPES, attachmentKind } from "./model.js";
import { newView } from "./views/new.js";
import { editView } from "./views/edit.js";
import { archivedView } from "./views/archived.js";
import { settingsView } from "./views/settings.js";
import { readOnly } from "./views/shared.js";
import { actionSlot } from "./views/actions.js";

const ARM_MS = 4000;
const LOAD_ERROR = "Could not load the board data. Reload the page; on claude.ai, open it while signed in.";
const msg = e => e?.message ?? String(e);
const fields = d => ({ tagline: d.tagline ?? "", summary: d.summary ?? "", status: d.status ?? "idea", components: joinLines(d.components), questions: joinLines(d.questions), next: joinLines(d.next), brief: d.brief ?? "" });
/** Form -> plain values; repeated `caption` inputs come back as an array. */
const readForm = form => { const fd = new FormData(form), v = Object.fromEntries(fd); v.captions = fd.getAll("caption"); return v; };

export class EditorController {
  #repo; #settings; #ctx; #doc;
  #writer = null;     // Promise<boolean>, resolved once
  #edit = null;       // {id, archived, values, images, armed, error, timer}: the sheet on screen
  #draft = {};        // values typed into the form that is on screen, kept across repaints
  #settingsValues = DEFAULT_SETTINGS;
  #paint = null;      // repaint closure of the form on screen
  #error = "";        // inline validation message of the new/settings form

  /** @param {{repo:import("./repository.js").EditorRepository, settings:import("../../core/settings-repository.js").SettingsRepository, ctx:object, doc?:Document}} deps */
  constructor({ repo, settings, ctx, doc }) {
    this.#repo = repo; this.#settings = settings; this.#ctx = ctx;
    this.#doc = doc ?? ctx.shell.region?.ownerDocument ?? globalThis.document;
    this.#wire(ctx.shell.region);
  }

  get #shell() { return this.#ctx.shell; }
  /** Cached: the permission does not change while the page is open. */
  canWrite() { return this.#writer ??= Promise.resolve(this.#ctx.user.canWrite()).then(v => v === true, () => false); }
  get #canAttach() { return this.#ctx.assets?.available !== false && !!this.#ctx.assets; }
  #go(path) { this.#ctx.router.navigate(path); }

  // -- extension points: a wrapper now, the link only if the viewer can write --
  boardAction() { return this.#action(() => ({ href: "#/new", label: "New project", primary: true })); }
  projectAction(project) { return this.#action(() => ({ href: `#/p/${encodeURIComponent(project.id)}/edit`, label: "Edit sheet" })); }
  #action(link) {
    const slot = actionSlot(this.#doc);
    this.canWrite().then(ok => { if (ok) slot.show(link()); });
    return slot.el;
  }

  // -- settings applied to the masthead --
  applySettings(s) {
    this.#settingsValues = s; this.#shell.setTitle(s.title); this.#shell.setOwnerLine(s.owner);
    this.#ctx.bus.emit("settings.changed", { title: s.title, owner: s.owner });   // other modules (the projects title block) follow Settings
  }

  // -- #/new --
  async showNew() {
    if (!(await this.canWrite())) return this.#shell.show(readOnly({ title: "New project", back: "#/", mode: this.#ctx.mode }));
    this.#draft = {};
    this.#paint = () => this.#shell.show(newView({ values: this.#draft, error: this.#error }));
    this.#error = ""; this.#paint();
    return () => { this.#paint = null; };
  }

  /** Create from the form values; on success toast, then open the new sheet. @returns {Promise<string|null>} the new id */
  async createProject(values) {
    this.#draft = values; this.#error = "";
    try {
      const id = await this.#repo.create(new ProjectDraft(values));
      this.#ctx.bus.emit("project.changed", { id });
      this.#shell.toast("Project created");
      this.#go(`/p/${encodeURIComponent(id)}`);
      return id;
    } catch (e) { return this.#fail(e, "create the project"); }
  }

  // -- #/p/:id/edit --
  async showEdit(id) {
    if (!(await this.canWrite())) return this.#shell.show(readOnly({ title: "Edit sheet", back: `#/p/${encodeURIComponent(id)}`, mode: this.#ctx.mode }));
    this.#shell.renderLoading("Opening the sheet");
    let row;
    try { row = await this.#repo.get(id); } catch (e) { return this.#shell.renderError(LOAD_ERROR); }
    if (!row) return this.#shell.renderNotFound(`/p/${id}/edit`);
    const edit = this.#edit = { id, name: row.data.name, archived: row.data.archived === true, values: fields(row.data), images: structuredClone(row.data.images ?? []), armed: false, error: "", timer: null };
    this.#paint = () => this.#shell.show(editView({ project: { id, name: edit.name }, values: edit.values, images: edit.images, canAttach: this.#canAttach, archived: edit.archived, armed: edit.armed, error: edit.error }));
    this.#paint();
    return () => { clearTimeout(edit.timer); if (this.#edit === edit) { this.#edit = null; this.#paint = null; } };
  }

  /** Remember what is typed (and caption edits) before an in-place repaint or a save. */
  #sync(values) {
    const e = this.#edit;
    if (!e || !values) return;
    const { captions, ...rest } = values;
    e.values = { ...e.values, ...rest };
    if (captions) e.images = e.images.map((im, i) => ({ ...im, caption: captions[i] ?? im.caption }));
  }

  /** Save the sheet fields and captions → toast, back to the project page. */
  async saveSheet(values) {
    const e = this.#edit;
    if (!e) return null;
    this.#sync(values); e.error = "";
    try {
      await this.#repo.update(e.id, { ...new ProjectDraft(e.values, { nameRequired: false }).toPatch(), images: e.images });
      this.#ctx.bus.emit("project.changed", { id: e.id });
      this.#shell.toast("Sheet saved");
      this.#go(`/p/${encodeURIComponent(e.id)}`);
      return e.id;
    } catch (err) { return this.#fail(err, "save the sheet", e); }
  }

  /** Upload an image or PDF through the asset gateway, add {id, caption, kind, name, sizeBytes} to the sheet and write it at once (so the id is never lost). */
  async attachFile(file, values) {
    const e = this.#edit;
    if (!e || !file) return null;
    this.#sync(values);
    if (!this.#canAttach) { this.#shell.toast("File upload is not available on this view"); return null; }
    if (!ATTACH_TYPES.includes(file.type)) { this.#shell.toast("Choose a PNG, JPEG, GIF, WebP or SVG image, or a PDF"); return null; }
    try {
      const { id, contentType, sizeBytes } = await this.#ctx.assets.upload(file, { type: file.type });
      const attachment = { id, caption: String(file.name ?? "").replace(/\.[^.]+$/, "").trim(), kind: attachmentKind(contentType || file.type), name: String(file.name ?? ""), sizeBytes: sizeBytes ?? file.size ?? 0 };
      e.images = [...e.images, attachment];
      await this.#repo.update(e.id, { images: e.images });
      this.#ctx.bus.emit("project.changed", { id: e.id });
      this.#shell.toast(attachment.kind === "pdf" ? "PDF attached" : "Image attached");
      this.#paint?.();
      return attachment;
    } catch (err) { this.#shell.toast(`Could not attach file: ${msg(err)}`); return null; }
  }

  /** Drop an attachment from the sheet's list (applied on Save; the uploaded file itself is kept). */
  removeFile(index, values) {
    const e = this.#edit;
    if (!e) return;
    this.#sync(values);
    e.images = e.images.filter((_, i) => i !== index);
    this.#shell.toast("File removed. Save the sheet to keep this change");
    this.#paint?.();
  }

  /** First call arms (button asks "Click again to archive", disarms after a few seconds); the second archives. */
  async archive() {
    const e = this.#edit;
    if (!e || e.archived) return false;
    if (!e.armed) {
      e.armed = true; clearTimeout(e.timer);
      e.timer = setTimeout(() => { e.armed = false; if (this.#edit === e) this.#paint?.(); }, ARM_MS); e.timer.unref?.();
      this.#paint?.();
      return false;
    }
    clearTimeout(e.timer);
    try {
      await this.#repo.setArchived(e.id, true);
      this.#ctx.bus.emit("project.changed", { id: e.id });
      this.#shell.toast("Archived");
      this.#go("/archived");
      return true;
    } catch (err) { e.armed = false; return this.#fail(err, "archive the sheet", e); }
  }

  async unarchive() {
    const e = this.#edit;
    if (!e || !e.archived) return false;
    try {
      await this.#repo.setArchived(e.id, false);
      this.#ctx.bus.emit("project.changed", { id: e.id });
      this.#shell.toast("Unarchived");
      this.#go(`/p/${encodeURIComponent(e.id)}`);
      return true;
    } catch (err) { return this.#fail(err, "unarchive the sheet", e); }
  }

  // -- #/archived --
  async showArchived() {
    this.#shell.renderLoading("Loading archived sheets");
    try {
      const [items, canWrite] = await Promise.all([this.#repo.listArchived(), this.canWrite()]);
      this.#shell.show(archivedView({ items, canWrite }));
    } catch (e) { this.#shell.renderError(LOAD_ERROR); }
  }

  // -- #/settings --
  async showSettings() {
    const canWrite = await this.canWrite();
    this.#paint = () => this.#shell.show(settingsView({ values: this.#settingsValues, canWrite, error: this.#error, mode: this.#ctx.mode }));
    this.#error = ""; this.#paint();
    return () => { this.#paint = null; };
  }

  /** Validate, save, update the masthead at once. @returns {Promise<BoardSettings|null>} */
  async saveSettings(values) {
    try {
      const s = await this.#settings.save(new BoardSettings(values));
      this.applySettings(s);
      this.#shell.toast("Settings saved");
      this.#error = ""; this.#paint?.();
      return s;
    } catch (e) { this.#settingsValues = { ...this.#settingsValues, ...values }; return this.#fail(e, "save the settings"); }
  }

  /** ValidationError → inline message on the form; anything else → toast. Always returns null. */
  #fail(e, what, edit) {
    if (e instanceof ValidationError) { this.#error = msg(e); if (edit) edit.error = msg(e); this.#paint?.(); }
    else this.#shell.toast(`Could not ${what}: ${msg(e)}`);
    return null;
  }

  // -- DOM glue: one delegated listener per event on the region, harmless on the test stub --
  #wire(region) {
    const on = (type, fn) => region?.addEventListener?.(type, e => Promise.resolve(fn(e)).catch(err => this.#shell.toast(`Something went wrong: ${msg(err)}`)));
    on("submit", e => {
      const form = e.target?.closest?.("form[data-form]");
      if (!form) return;
      e.preventDefault();
      const v = readForm(form);
      return { new: () => this.createProject(v), edit: () => this.saveSheet(v), settings: () => this.saveSettings(v) }[form.dataset.form]?.();
    });
    on("click", e => {
      const b = e.target?.closest?.("[data-action]");
      if (!b) return;
      const form = b.closest("form");
      const act = b.dataset.action;
      if (act === "archive") return this.archive();
      if (act === "unarchive") return this.unarchive();
      if (act === "remove-file") return this.removeFile(Number(b.dataset.index), form ? readForm(form) : undefined);
    });
    on("change", e => {
      const input = e.target;
      if (!input?.matches?.("input[type=file][data-attach]")) return;
      const file = input.files?.[0], values = readForm(input.closest("form"));
      input.value = "";
      return this.attachFile(file, values);
    });
  }
}
