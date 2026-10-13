// Views: the "Export sheet" and "Copy session prompt" actions the export module places on the project header.
/** @param {Document} doc @param {() => void} onClick @returns {HTMLElement} */
export function exportButton(doc, onClick) {
  const b = doc.createElement("button");
  b.className = "btn";
  b.setAttribute("type", "button");
  b.setAttribute("data-action", "export-sheet");
  b.textContent = "Export sheet";
  b.addEventListener?.("click", onClick);
  return b;
}

/** "Copy session prompt": the button plus a readonly textarea (hidden until the clipboard refuses) so the text can be selected by hand.
 *  @param {Document} doc @param {(area:HTMLTextAreaElement) => void} onClick @returns {HTMLElement} */
export function sessionPromptAction(doc, onClick) {
  const wrap = doc.createElement("div"), b = doc.createElement("button"), area = doc.createElement("textarea");
  b.className = "btn";
  b.setAttribute("type", "button");
  b.setAttribute("data-action", "copy-session-prompt");
  b.textContent = "Copy session prompt";
  b.addEventListener?.("click", () => onClick(area));
  area.setAttribute("readonly", "");
  area.setAttribute("hidden", "");
  area.setAttribute("rows", "10");
  area.setAttribute("aria-label", "Session prompt");
  area.setAttribute("data-session-prompt", "");
  wrap.append(b, area);
  return wrap;
}
