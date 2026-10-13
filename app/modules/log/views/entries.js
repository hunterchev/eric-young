import { fmtDate } from "../../../core/html.js";

const el = (doc, tag, cls, text) => {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** "Decisions": one line per entry that carries `decided`, "<date> — <text>", in the order given (newest first). */
export function renderDecisions({ doc, entries }) {
  const sec = el(doc, "section", "panel");
  sec.append(el(doc, "h3", "", "Decisions"));
  const list = entries.filter(e => e.decided);
  if (!list.length) { sec.append(el(doc, "p", "label", "No decisions recorded yet.")); return sec; }
  const ul = el(doc, "ul", "log-decisions");
  for (const e of list) ul.append(el(doc, "li", "", `${fmtDate(e.ts)} — ${e.decided.replace(/\s+/g, " ")}`));
  sec.append(ul);
  return sec;
}

/** Small in-panel error; the rest of the page stays as it is. */
export function renderLogError({ doc }) {
  const sec = el(doc, "section", "panel");
  sec.append(el(doc, "h3", "", "Running log"), el(doc, "p", "state-error", "The log could not load. Reload to try again."));
  return sec;
}

/**
 * "Running log — N" and its entries, newest first (the caller sorts).
 * @param {{doc:Document, entries:{id:string,ts:string,source:string,text:string,status?:string|null}[],
 *          canWrite:boolean, armedId:string|null, labelOf:(status:string)=>string, onRemove:(id:string)=>void}} props
 */
export function renderEntries({ doc, entries, canWrite, armedId, labelOf, onRemove }) {
  const sec = el(doc, "section", "panel");
  sec.append(el(doc, "h3", "", `Running log — ${entries.length}`));
  if (!entries.length) { sec.append(el(doc, "p", "label", "No updates logged yet.")); return sec; }
  const list = el(doc, "ol", "log-list");
  sec.removeButtons = new Map();
  for (const e of entries) {
    const li = el(doc, "li", "log-entry");
    const meta = el(doc, "div", "log-meta");
    meta.append(el(doc, "span", "log-source", e.source), el(doc, "span", "num", fmtDate(e.ts)));
    if (e.status) meta.append(el(doc, "span", "num", `→ ${labelOf(e.status)}`));
    if (canWrite) {
      const armed = armedId === e.id;
      const b = el(doc, "button", `btn log-remove${armed ? " is-armed" : ""}`, armed ? "click again to remove" : "remove");
      b.setAttribute("type", "button");
      b.addEventListener("click", () => onRemove(e.id));
      sec.removeButtons.set(e.id, b);   // the controller moves focus to these when it redraws
      meta.append(b);
    }
    li.append(meta, el(doc, "p", "log-text", e.text));
    list.append(li);
  }
  sec.append(list);
  return sec;
}
