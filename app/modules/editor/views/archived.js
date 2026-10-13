// View: the Archived place. Compact list: hidden sheets stay reachable, and writers can edit (and so unarchive) them.
import { html, fmtDate } from "../../../core/html.js";
import { STATUS_LABEL } from "../model.js";
import { head } from "./shared.js";

const item = (p, canWrite) => html`<li class="panel archive-item">
  <a class="archive-link" href="#/p/${encodeURIComponent(p.id)}">${p.data.name}</a>
  <span class="stage">Stage: ${STATUS_LABEL[p.data.status] ?? p.data.status}</span>
  <span class="archive-date">Updated ${fmtDate(p.data.updatedAt)}</span>
  ${canWrite ? html`<a class="btn" href="#/p/${encodeURIComponent(p.id)}/edit">Edit this sheet</a>` : ""}</li>`;

/** @param {{items:{id:string,data:object}[], canWrite:boolean}} props */
export const archivedView = ({ items, canWrite }) => items.length
  ? html`<section class="editor" aria-label="Archived sheets">${head("Archived", "Archived sheets")}<ul class="archive-list">${items.map(p => item(p, canWrite))}</ul></section>`
  : html`<section class="editor" aria-label="Archived sheets">${head("Archived", "Archived sheets")}<div class="state-empty panel"><h2>No archived sheets.</h2><p>Sheets you archive leave the board and wait here.</p></div></section>`;
