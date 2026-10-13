// View: the New project form. Name is the only required field; everything else gets a default.
import { html } from "../../../core/html.js";
import { MAX_NAME } from "../model.js";
import { field, formError, head } from "./shared.js";

/** @param {{values:{name?:string}, error?:string}} props */
export const newView = ({ values, error }) => html`<section class="editor" aria-label="New project">${head("New sheet", "New project")}
  <form class="panel editor-form" data-form="new" novalidate>
    ${formError(error)}
    ${field({ id: "ed-name", label: "Name", hint: "Everything else starts with a default and can be edited on the sheet.",
      control: html`<input id="ed-name" name="name" type="text" required maxlength="${MAX_NAME}" autocomplete="off" value="${values.name ?? ""}">` })}
    <div class="editor-actions"><button type="submit" class="btn btn-primary">Create project</button><a class="btn" href="#/">Cancel</a></div>
  </form></section>`;
