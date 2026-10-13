// Small view parts shared by the editor screens. Pure: props -> html.
import { html } from "../../../core/html.js";

/** Label + control (+ hint) in the design.md `.field` shape. `control` is an html`` fragment. */
export const field = ({ id, label, hint, control }) => html`<div class="field"><label for="${id}">${label}</label>${control}${hint ? html`<p class="hint">${hint}</p>` : ""}</div>`;

export const formError = message => message ? html`<p class="form-error" role="alert">${message}</p>` : "";

export const head = (label, title) => html`<header class="project-head"><p class="label">${label}</p><h2>${title}</h2></header>`;

/** Why a reader cannot edit: file mode means Grok keeps data/board.json; elsewhere the artifact owner grants write access. */
const GROK_NOTE = "This board is maintained by Grok. Ask Grok to change it.";
export const readerNote = (mode, artifact) => mode === "file" ? GROK_NOTE : artifact;

/** Shown instead of a form to people without write access. */
export const readOnly = ({ title, back, mode }) => html`<section class="editor" aria-label="${title}">${head("Read only", title)}
  <div class="panel"><p>${readerNote(mode, "You can view this board but not change it. Editing needs write access to the artifact.")}</p>
  <div class="editor-actions"><a class="btn" href="${back}">Back</a></div></div></section>`;
