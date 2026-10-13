// View: pure function props -> html. No fetching, no repository. Classes come from the page CSS (design.md).
import { html, assetUrl } from "../../../core/html.js";
import { STATUSES, STATUS_LABEL, isFiltered } from "../model.js";

const SEGMENTS = [0, 1, 2, 3, 4, 5];

/** The six-segment track, filled up to the project's stage, with the stage name as plain text beside it. No percentage. */
export const stageTrack = p => html`<div class="stage"><div class="stage-track" role="img"
    aria-label="Stage ${p.stageIndex + 1} of 6, ${STATUS_LABEL[p.status]}">${SEGMENTS.map(i =>
  html`<span class="seg${i < p.stageIndex ? " is-done" : i === p.stageIndex ? " is-current" : ""}" data-n="${i + 1}"></span>`)}</div>
  <span class="stage-name">Stage: ${STATUS_LABEL[p.status]}</span></div>`;

const thumb = p => p.cover
  ? html`<div class="thumb"><img src="${assetUrl(p.cover)}" alt="" loading="lazy"></div>`
  : html`<div class="thumb thumb-none"><img class="thumb-mark" src="brand/rearden-mark.png" alt="" width="48" height="48"></div>`;

/** @param {{project:object, index:number, total:number, meta:{text:string|null, entries?:number}}} props */
const sheet = ({ project: p, index, total, meta }) => html`<a class="sheet" href="#/p/${encodeURIComponent(p.id)}">
  <div class="sheet-no"><span>${p.sheetNumber(index, total)}</span></div>
  <div class="sheet-body">${thumb(p)}
    <h2 class="sheet-title">${p.name}</h2>
    <p class="tagline">${p.tagline}</p>
    ${stageTrack(p)}
    <p class="card-meta${meta.text ? "" : " is-empty"}">${meta.text ?? "No updates yet"}</p>
  </div></a>`;

const FILTER_NONE = { stage: "", query: "" };

/** Counts strip, then one panel per board section (Recent updates...). Sits above the filter row; the controller repaints it with the list.
 *  `sections` = [{title, rows:[{href, name, date, text, stage}]}], already resolved to sheet names; the filter never touches them.
 *  `entries` = log entries over the whole board (so the strip keeps its shape on an empty filter result); without it, the shown cards are summed. */
export function boardTop({ cards, entries: all, sections = [] }) {
  const open = cards.filter(c => c.project.status !== "done").length;
  const counted = all !== undefined || cards.some(c => c.meta.entries !== undefined);
  const entries = all ?? cards.reduce((n, c) => n + (c.meta.entries ?? 0), 0);
  return html`<dl class="title-block board-counts">
      <div><dt>Projects</dt><dd>${cards.length}</dd></div>
      <div><dt title="Sheets not yet done">In progress</dt><dd>${open}</dd></div>
      ${counted ? html`<div><dt>Log entries</dt><dd>${entries}</dd></div>` : ""}
    </dl>
    ${sections.map(s => html`<section class="panel board-section"><h3>${s.title}</h3>${s.rows.length
      ? html`<ul class="plain recent-list">${s.rows.map(r => html`<li>${r.stage ? `→ ${r.stage} — ` : ""}<a href="${r.href}">${r.name} — ${r.date} — ${r.text}</a></li>`)}</ul>`
      : html`<p class="empty-note">No updates yet.</p>`}</section>`)}`;
}

/** "Showing N of M" when filtered, then the sheets or the no-match state. The part the controller repaints with boardTop. */
export function boardList({ cards, total = cards.length, filter = FILTER_NONE }) {
  const filtered = isFiltered(filter);
  return html`${filtered ? html`<p class="filter-count" role="status">Showing ${cards.length} of ${total}</p>` : ""}
    ${filtered && !cards.length
      ? html`<div class="state-empty panel"><h2>No sheets match.</h2><p>No sheet fits this stage and search.</p><button type="button" class="btn" data-action="clear-filters">Clear filters</button></div>`
      : html`<div class="sheet-grid">${cards.map((c, i) => sheet({ ...c, index: c.index ?? i, total }))}</div>`}`;
}

/**
 * The drawing index. cards: [{project, meta:{text, entries?}, index?}] in board order (index = position on the whole board,
 * so a filtered sheet keeps its number); total = sheets on the whole board; filter = {stage, query}.
 * @returns {import("../../../core/html.js").Raw}
 */
export function boardView({ cards, total = cards.length, filter = FILTER_NONE, entries, sections }) {
  return html`<section class="board" aria-label="Projects">
    <div class="board-actions" data-actions-slot></div>
    <div class="board-top" data-board-top>${boardTop({ cards, entries, sections })}</div>
    <div class="board-filter" role="search" aria-label="Filter sheets">
      <div class="field"><label for="board-stage">Stage</label>
        <select id="board-stage" data-filter="stage"><option value="">All stages</option>${STATUSES.map(s =>
          html`<option value="${s}"${filter.stage === s ? " selected" : ""}>${STATUS_LABEL[s]}</option>`)}</select></div>
      <div class="field"><label for="board-query">Search sheets</label>
        <input id="board-query" type="search" data-filter="query" value="${filter.query}" autocomplete="off"></div>
      <button type="button" class="btn" data-action="clear-filters">Clear</button>
    </div>
    <div class="board-list" data-board-list>${boardList({ cards, total, filter })}</div></section>`;
}
