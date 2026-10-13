// View: the project page. Pure props -> html. The right-hand slot is filled by the controller with registered panels.
import { html, fmtDate, assetUrl } from "../../../core/html.js";
import { STATUS_LABEL } from "../model.js";
import { stageTrack } from "./board.js";

const section = (title, body) => html`<section class="panel"><h3>${title}</h3>${body}</section>`;
// One quiet line for every empty section; writers are pointed at the Edit sheet action.
const none = (what, canWrite) => html`<p class="empty-note">No ${what} yet.${canWrite ? " Add one with Edit sheet." : ""}</p>`;
const list = (tag, items, empty) => items.length
  ? (tag === "ol" ? html`<ol class="plain">${items.map(i => html`<li>${i}</li>`)}</ol>` : html`<ul class="plain">${items.map(i => html`<li>${i}</li>`)}</ul>`)
  : empty;
const documents = docs => docs.length
  ? html`<ul class="plain documents">${docs.map(d => html`<li><a href="${assetUrl(d.id)}" target="_blank" rel="noopener">${d.caption || "Document"}</a> <span class="label">PDF</span></li>`)}</ul>` : "";
const questions = (p, canWrite) => p.questions.length
  ? html`<ul class="plain">${p.questionRows.map(q => html`<li class="question${q.answered ? " is-answered" : ""}"><span class="question-text">${q.text}</span>${canWrite
      ? html` <button type="button" class="btn q-toggle" data-action="toggle-answered" data-index="${q.index}">${q.answered ? "Reopen" : "Mark answered"}</button>` : ""}</li>`)}</ul>`
  : none("open questions", canWrite);

/**
 * @param {{project:object, owner:string, meta:{entries?:number, latestTs?:string}, canWrite?:boolean, panels?:Raw[], hasPanels:boolean}} props panels = Raw panels; element panels are appended by the controller
 * @returns {import("../../../core/html.js").Raw}
 */
export function projectView({ project: p, owner, meta, canWrite = false, panels = [], hasPanels }) {
  return html`<article class="project">
    <header class="project-head"><h2>${p.name}</h2><p class="tagline">${p.tagline}</p>
      <div class="project-actions" data-actions-slot></div></header>
    <dl class="title-block">
      <div><dt>No.</dt><dd>${p.number}</dd></div>
      <div><dt>Title</dt><dd>${p.name}</dd></div>
      <div><dt title="Log entries on this sheet">Entries</dt><dd>${meta.entries ?? "—"}</dd></div>
      <div><dt>Stage</dt><dd>${STATUS_LABEL[p.status]}</dd></div>
      <div><dt>Owner</dt><dd>${owner}</dd></div>
      <div><dt>Updated</dt><dd>${fmtDate(p.updatedAt ?? meta.latestTs)}</dd></div>
    </dl>
    ${stageTrack(p)}
    <div class="project-grid">
      <div class="project-main">
        ${section("What it is", p.summary ? html`<p>${p.summary}</p>` : none("summary", canWrite))}
        ${section("Original notes", p.images.length
          ? html`${p.photos.length ? html`<div class="notes">${p.photos.map(im => html`<figure class="note"><img src="${assetUrl(im.id)}" alt="${im.caption}" loading="lazy"><figcaption>${im.caption}</figcaption></figure>`)}</div>` : ""}${documents(p.documents)}`
          : none("original notes", canWrite))}
        ${section("Parts and sensors", list("ul", p.components, none("parts or sensors", canWrite)))}
        ${section("Open questions", questions(p, canWrite))}
        ${section("Next steps", list("ol", p.next, none("next steps", canWrite)))}
        ${section("Grok brief", p.brief
          ? html`<pre class="brief" data-brief>${p.brief}</pre>
            <div class="brief-actions"><button type="button" class="btn" data-action="copy-brief">Copy brief</button>
            <p class="hint">Paste it into this project's Grok bot to start a session.</p></div>`
          : none("Grok brief", canWrite))}
      </div>
      <aside class="panel-slot" data-panel-slot aria-label="Panels">${hasPanels ? panels : html`<p class="panel no-panels">No panels</p>`}</aside>
    </div></article>`;
}
