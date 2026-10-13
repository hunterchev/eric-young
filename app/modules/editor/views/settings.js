// View: board settings. Writers get the form and the New project action; readers see the values.
import { html } from "../../../core/html.js";
import { MAX_TITLE, MAX_OWNER } from "../../../core/settings.js";
import { field, formError, head, readerNote } from "./shared.js";

/** @param {{values:{title:string,owner:string}, canWrite:boolean, error?:string, mode?:string}} props */
export const settingsView = ({ values: v, canWrite, error, mode }) => html`<section class="editor" aria-label="Board settings">${head("Settings", "Board settings")}
  ${canWrite ? html`<form class="panel editor-form" data-form="settings" novalidate>
    ${formError(error)}
    ${field({ id: "ed-title", label: "Board title", control: html`<input id="ed-title" name="title" type="text" required maxlength="${MAX_TITLE}" value="${v.title}">` })}
    ${field({ id: "ed-owner", label: "Owner line", hint: "Shown in the masthead. Leave empty for Unassigned.", control: html`<input id="ed-owner" name="owner" type="text" maxlength="${MAX_OWNER}" value="${v.owner}">` })}
    <div class="editor-actions"><button type="submit" class="btn btn-primary">Save settings</button></div>
  </form>
  <div class="panel"><h3>Board actions</h3><div class="editor-actions"><a class="btn" href="#/new">New project</a></div></div>`
  : html`<dl class="title-block"><div><dt>Board title</dt><dd>${v.title}</dd></div><div><dt>Owner</dt><dd>${v.owner || "Unassigned"}</dd></div></dl>
  <p class="hint">${readerNote(mode, "Only people with write access can change these.")}</p>`}</section>`;
