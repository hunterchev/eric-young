// The Shell owns the page chrome (masthead, places nav, status key, content
// region, skip link, toasts) and the designed states. It knows nothing about projects.
// It builds DOM through an injected `doc`, so tests run it against an element stub.
import { esc } from "../core/html.js";
import { STAGES } from "../core/stages.js";

const TOAST_MS = 2600;

export class Shell {
  #doc; #owner = null; #timers; #queue = []; #showing = false; #navItems = []; #navLinks = []; #styles = new Set(); #routed = false;

  /** @param {{doc?:Document, timers?:{set:Function,clear:Function}}} [env] */
  // unref (Node only) so a pending toast/watchdog never keeps a headless test process alive.
  constructor({ doc = document, timers = { set: (f, ms) => { const t = setTimeout(f, ms); t.unref?.(); return t; }, clear: id => clearTimeout(id) } } = {}) {
    this.#doc = doc; this.#timers = timers;
  }

  #el(tag, cls, text) {
    const e = this.#doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** Replaces whatever is in rootEl (the static loading markup) with the live chrome. */
  mount(rootEl) {
    this.root = rootEl;
    const masthead = this.#el("header", "masthead");
    const id = this.#el("div", "mast-cell mast-id");
    for (const [theme, file] of [["dark", "rearden-logo-dark.png"], ["light", "rearden-logo-light.png"]]) {
      const img = this.#el("img", `brand-logo logo-${theme}`);
      img.setAttribute("src", `brand/${file}`); img.setAttribute("alt", "Rearden Research");
      id.append(img);
    }
    this.titleEl = this.#el("h1", "mast-title", "Eric Young");
    id.append(this.titleEl);
    const owner = this.#el("div", "mast-cell mast-owner");
    owner.append(this.#el("p", "label", "Owner"));
    this.ownerEl = this.#el("p", "mast-owner-line", "");
    owner.append(this.ownerEl);
    this.navEl = this.#el("nav", "place-nav");
    this.navEl.setAttribute("aria-label", "Places");
    const key = this.#el("div", "mast-cell status-key");
    key.setAttribute("role", "group");
    key.setAttribute("aria-label", "Status key: six stages");
    // Native disclosure: folded on phones, held open on wide screens (the CSS hides the toggle there).
    const details = this.#el("details", "key-details");
    details.append(this.#el("summary", "", "Stage key"));
    const ol = this.#el("ol", "key-list");
    STAGES.forEach((s, i) => {
      const li = this.#el("li", "key-item");
      const sw = this.#el("span", "key-swatch"); sw.setAttribute("data-stage", s.id);
      li.append(sw, this.#el("span", "", `${i + 1} ${s.label}`));
      ol.append(li);
    });
    details.append(ol);
    key.append(details);
    const wide = this.#doc.defaultView?.matchMedia?.("(min-width: 601px)") ?? globalThis.matchMedia?.("(min-width: 601px)");
    if (wide) { details.open = wide.matches; wide.addEventListener?.("change", e => { details.open = e.matches; }); }
    masthead.append(id, owner, this.navEl, key);

    this.region = this.#el("main", "region");
    this.region.setAttribute("id", "region");
    this.region.setAttribute("tabindex", "-1");   // focus target for the skip link (-1: never in the tab order)
    this.toastRegion = this.#el("div", "toast-region");
    this.toastRegion.setAttribute("role", "status");
    this.toastRegion.setAttribute("aria-live", "polite");

    // The hash is the router's, so the skip link moves focus itself instead of navigating to #region.
    const skip = this.#el("a", "skip-link", "Skip to content");
    skip.setAttribute("href", "#region");
    skip.addEventListener?.("click", e => { e.preventDefault(); this.region.focus?.(); });

    rootEl.replaceChildren(skip, masthead, this.region, this.toastRegion);
    this.setOwnerLine("");
    this.renderLoading("Loading the board");
    return this;
  }

  setTitle(text) { this.titleEl.textContent = text; this.#doc.title = text; }
  setOwnerLine(text) { this.#owner = text || null; this.ownerEl.textContent = text || "Unassigned"; }
  /** Last text passed to setOwnerLine, or null. Read-only. */
  get ownerLine() { return this.#owner; }

  /** Places only (Board, Archived, Settings). Actions never go in the nav. @param {{label:string,path:string,also?:string[]}[]} items */
  nav(items) {
    this.#navItems = items;
    this.#navLinks = items.map(it => {
      const a = this.#el("a", "place", it.label);
      a.setAttribute("href", "#" + it.path);
      return a;
    });
    this.navEl.replaceChildren(...this.#navLinks);
  }

  /** Mark the nav link for the current path (also= extra path prefixes that belong to the place). */
  setActive(path) {
    this.#navItems.forEach((it, i) => {
      const on = path === it.path || (it.also ?? []).some(p => path.startsWith(p));
      if (on) this.#navLinks[i].setAttribute("aria-current", "page");
      else this.#navLinks[i].removeAttribute("aria-current");
    });
  }

  /** After each navigation: mark the place, and (from the second one on) move focus to the content region so a keyboard
   *  user lands on the new page instead of BODY. The first load leaves focus alone so the skip link is still the first stop. */
  routed(path) {
    this.setActive(path);
    if (this.#routed) this.region.focus?.({ preventScroll: true });
    this.#routed = true;
  }

  /** Put content in the region: html string (already escaped), Raw, or Node(s). */
  show(content) {
    if (content?.nodeType) this.region.replaceChildren(content);
    else this.region.innerHTML = String(content);
  }

  /** Append a stylesheet link (module css) once. */
  loadStyle(href) {
    if (this.#styles.has(href)) return;
    this.#styles.add(href);
    const l = this.#el("link"); l.setAttribute("rel", "stylesheet"); l.setAttribute("href", href);
    (this.#doc.head ?? this.root).append(l);
  }

  /** True while the region shows the loading state. */
  isLoading() { return /class="state-loading/.test(this.region.innerHTML); }
  /** Never hang: if the region is still loading after ms, replace it with the error state. */
  watchLoading(ms, message) { this.#timers.set(() => { if (this.isLoading()) this.renderError(message); }, ms); }

  renderLoading(message = "Loading") {
    this.show(`<div class="state-loading" role="status" aria-busy="true">
      <p class="label">${esc(message)}</p>
      <div class="sheet-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`);
  }
  renderEmpty(title, hint = "") {
    this.show(`<div class="state-empty panel"><h2>${esc(title)}</h2>${hint ? `<p>${esc(hint)}</p>` : ""}</div>`);
  }
  renderNotFound(path = "") {
    this.show(`<div class="state-notfound panel"><p class="label">Error 404 — ${esc(path)}</p><h2>Sheet not found</h2>
      <p>This drawing is not in the index. It may have been archived or the link is wrong.</p><a class="btn" href="#/">Back to the board</a></div>`);
  }
  renderError(message = "Something went wrong") {
    this.show(`<div class="state-error panel" role="alert"><p class="label">Fault</p><h2>${esc(message)}</h2>
      <p>Reload the page. If it keeps happening, the board data could not be read.</p></div>`);
  }

  /** Queue a message in the ARIA live region; one at a time, auto-hides. No dialogs, ever. */
  toast(message) { this.#queue.push(String(message)); if (!this.#showing) this.#next(); }
  #next() {
    const msg = this.#queue.shift();
    if (msg === undefined) { this.#showing = false; return; }
    this.#showing = true;
    const t = this.#el("div", "toast", msg);
    this.toastRegion.append(t);
    this.#timers.set(() => { t.remove(); this.#next(); }, TOAST_MS);
  }
}
