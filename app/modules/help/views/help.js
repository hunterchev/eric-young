// View: the Help page. Pure; takes the stage list so the wording stays next to the vocabulary.
import { html } from "../../../core/html.js";

// What each stage means, by stage id (labels come from core/stages.js).
const MEANING = {
  idea: "A rough thought. Nothing is worked out yet.",
  research: "Options and numbers are being gathered; nothing is drawn yet.",
  design: "A choice has been made and the layout, sizes and parts are being worked out on paper.",
  prototype: "Something real is being built or bench-tested.",
  test: "The prototype is being tried against the job it has to do.",
  done: "It works, it is written down, and nothing more is planned.",
};

/** @param {{stages:{id:string,label:string}[], mode?:"artifact"|"file"|"dev"}} props  File mode = the Grok-run copy: Grok does the editing. */
export const helpView = ({ stages, mode }) => { const grok = mode === "file"; return html`<section class="help" aria-label="Help">
  <h2>Help</h2>
  <div class="panel"><h3>Set up a project's Grok bot</h3>
    <ol>
      <li>Open the project's sheet.</li>
      <li>Click Copy brief.</li>
      <li>Paste it as the project instructions of a new Grok project. Use one bot per project.</li>
    </ol>
    <p>The brief tells Grok to end every session with a DASHBOARD UPDATE block.</p></div>
  <div class="panel"><h3>Log a session</h3>
    <p>Start each Grok session by pasting the Copy session prompt from the sheet; Copy brief is for setting up the bot the first time.</p>
    ${grok ? html`<p>Grok logs the session for you. From the DASHBOARD UPDATE block it records:</p>`
      : html`<p>Paste the DASHBOARD UPDATE block into "Log an update" on the sheet. Each line does one thing:</p>`}
    <ul>
      <li>STATUS sets the stage.</li>
      <li>DONE is the text of the running log.</li>
      <li>DECIDED goes to the Decisions list.</li>
      <li>NEXT and OPEN are kept in the text.</li>
    </ul>
    ${grok ? html`<p>Grok also does what Mark answered, Edit sheet and New project do on the claude.ai copy: tell Grok when a question is settled, a sheet needs changing or a project starts. This page is read-only.</p>`
      : html`<p>A plain note works too. When an open question is settled, click Mark answered next to it.</p>
    <p>When Grok runs this board, Grok makes these changes for you; the page is read-only.</p>`}</div>
  <div class="panel"><h3>What the six stages mean</h3>
    <ul>${stages.map(s => html`<li><strong>${s.label}</strong>: ${MEANING[s.id] ?? ""}</li>`)}</ul>
    <p>On the board, "Entries" counts the log entries on a sheet and "In progress" counts the sheets that are not yet done.</p></div>
  <p class="hint">${grok ? html`This copy is maintained by Grok; the claude.ai copy is Claude's.`
    : html`Claude can add or change sheets too: in a Claude chat that has this board's link, ask for the change and it edits the same records you see here.`}</p>
</section>`; };
