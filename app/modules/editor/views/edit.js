// View: the sheet editor (#/p/:id/edit). Values are the strings in the form, so a repaint keeps what was typed.
import { html, assetUrl } from "../../../core/html.js";
import { STATUSES, STATUS_LABEL, MAX_TAGLINE, MAX_TEXT, MAX_LIST } from "../model.js";
import { field, formError, head } from "./shared.js";

const text = (id, label, value, { rows, hint, max } = {}) => field({ id, label, hint,
  control: rows ? html`<textarea id="${id}" name="${id.slice(3)}" rows="${rows}" maxlength="${max}">${value}</textarea>` : html`<input id="${id}" name="${id.slice(3)}" type="text" maxlength="${max}" value="${value}">` });

/** "340 KB" / "2.4 MB". */
const fmtSize = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
/** A PDF row says what the file is; legacy entries without a name keep the plain PDF label (the caption field is the row's text). */
const pdfLabel = im => im.name ? `${im.name} — ${fmtSize(im.sizeBytes ?? 0)}` : "PDF";

const fileRow = (im, i) => html`<li class="image-row">
  ${im.kind === "pdf" ? html`<span class="label file-kind">${pdfLabel(im)}</span>` : html`<img src="${assetUrl(im.id)}" alt="" loading="lazy">`}
  <div class="field"><label for="ed-cap-${i}">Caption ${i + 1}</label><input id="ed-cap-${i}" name="caption" type="text" maxlength="${MAX_TAGLINE}" value="${im.caption ?? ""}"></div>
  <button type="button" class="btn" data-action="remove-file" data-index="${i}">Remove</button></li>`;

const files = ({ images: list, canAttach }) => html`<fieldset class="panel editor-images"><legend class="label">Attachments</legend>
  ${list.length ? html`<ul class="image-list">${list.map(fileRow)}</ul>` : html`<p class="hint">No files attached.</p>`}
  ${canAttach
    ? field({ id: "ed-attach", label: "Attach file", hint: "An image (PNG, JPEG, GIF, WebP or SVG) or a PDF. It is added to the sheet at once.",
      control: html`<input id="ed-attach" type="file" accept="image/*,application/pdf" data-attach>` })
    : html`<p class="hint" data-no-upload>File upload is not available on this view</p>`}</fieldset>`;

const archiveBlock = ({ archived, armed }) => html`<div class="panel editor-archive">
  <h3>${archived ? "Archived sheet" : "Archive"}</h3>
  <p class="hint">${archived ? "This sheet is hidden from the board. Unarchive it to put it back." : "Archived sheets leave the board; their page and log stay reachable from Archived."}</p>
  <div class="editor-actions">${archived
    ? html`<button type="button" class="btn" data-action="unarchive">Unarchive sheet</button>`
    : html`<button type="button" class="btn${armed ? " is-armed" : ""}" data-action="archive">${armed ? "Click again to archive" : "Archive sheet"}</button>`}</div></div>`;

/** @param {{project:{id:string,name:string}, values:object, images:{id:string,caption:string,kind?:string,name?:string,sizeBytes?:number}[], canAttach:boolean, archived:boolean, armed:boolean, error?:string}} props */
export const editView = ({ project, values: v, images: list, canAttach, archived, armed, error }) => html`<section class="editor" aria-label="Edit ${project.name}">
  ${head("Edit sheet", project.name)}
  <form class="panel editor-form" data-form="edit" novalidate>
    ${formError(error)}
    ${text("ed-tagline", "Tagline", v.tagline, { max: MAX_TAGLINE })}
    ${text("ed-summary", "Summary", v.summary, { rows: 4, max: MAX_TEXT })}
    ${field({ id: "ed-status", label: "Status", control: html`<select id="ed-status" name="status">${STATUSES.map(s => html`<option value="${s}"${s === v.status ? " selected" : ""}>${STATUS_LABEL[s]}</option>`)}</select>` })}
    ${text("ed-components", "Parts and sensors", v.components, { rows: 5, hint: "One per line.", max: MAX_LIST })}
    ${text("ed-questions", "Open questions", v.questions, { rows: 5, hint: "One per line.", max: MAX_LIST })}
    ${text("ed-next", "Next steps", v.next, { rows: 5, hint: "One per line, in order.", max: MAX_LIST })}
    ${text("ed-brief", "Grok brief", v.brief, { rows: 10, max: MAX_TEXT })}
    ${files({ images: list, canAttach })}
    <div class="editor-actions"><button type="submit" class="btn btn-primary">Save sheet</button><a class="btn" href="#/p/${encodeURIComponent(project.id)}">Cancel</a></div>
  </form>
  ${archiveBlock({ archived, armed })}</section>`;
