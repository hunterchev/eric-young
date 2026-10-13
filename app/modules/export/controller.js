// Pattern: thin Controller. Collects provider sections, builds the Markdown and hands it to the downloads gateway.
import { fmtDate } from "../../core/html.js";
import { exportMarkdown, sessionPrompt } from "./model.js";
import { exportButton, sessionPromptAction } from "./views/action.js";

const msg = e => e?.message ?? String(e);
const newest = (a, b) => (!a || Date.parse(b) > Date.parse(a) ? b : a);

export class ExportController {
  #ctx; #doc; #clipboard;
  /** @param {{ctx:object, doc?:Document, clipboard?:{writeText:Function}}} deps ctx = the module registration context (needs ctx.downloads); clipboard defaults to navigator.clipboard */
  constructor({ ctx, doc, clipboard }) { this.#ctx = ctx; this.#clipboard = clipboard; this.#doc = doc ?? ctx.shell.region?.ownerDocument ?? globalThis.document; }

  get #downloads() { return this.#ctx.downloads?.available ? this.#ctx.downloads : null; }

  /** "project.actions" provider: the button for readers and writers alike, nothing when this view cannot save files. */
  action(project) { return this.#downloads ? exportButton(this.#doc, () => this.exportSheet(project)) : null; }

  /** "project.actions" provider: copies the brief plus the sheet's current state; always offered (it needs the clipboard, not downloads). */
  sessionAction(project) { return sessionPromptAction(this.#doc, area => this.copySessionPrompt(project, area)); }

  /** Each provider's result in registration order, not awaited: a provider that throws is skipped. */
  #raw(project) {
    return this.#ctx.extensions.list("project.exportSections").flatMap(provider => {
      try { return [provider(project, this.#ctx)]; } catch (e) { console.warn("Export section provider failed", e); return []; }
    });
  }
  /** One provider may return a section, an array of them, null, or a promise of those; broken or empty ones are dropped. */
  #flat(results) { return results.flatMap(r => [r].flat()).filter(s => s?.title); }

  /** Provider sections in registration order; a provider that rejects or returns nothing is skipped. */
  async #sections(project) {
    const ok = await Promise.all(this.#raw(project).map(r => Promise.resolve(r).catch(e => { console.warn("Export section provider failed", e); return null; })));
    return this.#flat(ok);
  }

  /** The Updated cell: the sheet's own date, else the latest log entry any cardMeta provider reports. */
  #updated(project) {
    let latest = null;
    for (const f of this.#ctx.extensions.list("project.cardMeta")) { try { const t = f(project)?.latestTs; if (t) latest = newest(latest, t); } catch { /* the sheet page tolerates it too */ } }
    return fmtDate(project.updatedAt ?? latest);
  }

  /** Build `<slug>.md` and offer it for saving. Toasts the outcome; never throws. @returns {Promise<string|null>} the filename, or null on failure */
  async exportSheet(project) {
    const { shell } = this.#ctx, downloads = this.#downloads;
    if (!downloads) { shell.toast("Could not export: downloads are not available on this view"); return null; }
    const filename = `${String(project.id).replace(/[^a-z0-9._-]+/gi, "-")}.md`;
    try {
      const data = exportMarkdown(project, await this.#sections(project), { owner: shell.ownerLine || "Unassigned", updated: this.#updated(project) });
      await downloads.save({ filename, data });
      shell.toast(`Exported ${filename}`);
      return filename;
    } catch (e) { shell.toast(`Could not export: ${msg(e)}`); return null; }
  }

  /** Copy the session prompt. writeText runs inside the click handler whenever every provider answers synchronously (the log module does),
   *  which keeps the user gesture; if the clipboard refuses, the text goes into `area`, selected, for a manual copy. Never throws. */
  copySessionPrompt(project, area) {
    const { shell } = this.#ctx, raw = this.#raw(project);
    const copy = results => {
      const text = sessionPrompt(project, this.#flat(results), { date: fmtDate(new Date()) });
      return new Promise(res => res((this.#clipboard ?? globalThis.navigator?.clipboard).writeText(text)))
        .then(() => shell.toast("Session prompt copied"), () => {
          if (area) { area.value = text; area.removeAttribute("hidden"); area.focus?.(); area.select?.(); }
          shell.toast("Select and copy");
        });
    };
    return raw.some(r => r?.then) ? Promise.all(raw.map(r => Promise.resolve(r).catch(() => null))).then(copy) : copy(raw);
  }
}
