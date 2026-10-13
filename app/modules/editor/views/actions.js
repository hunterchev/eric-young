// View: entry-point links the editor places on other modules' pages through extension points.
// A wrapper is returned at once and the link is added only for writers, so readers never get the control in the DOM.

/** @param {Document} doc @returns {{el:HTMLElement, show:(link:{href:string,label:string,primary?:boolean}) => void}} */
export function actionSlot(doc) {
  const el = doc.createElement("span");
  el.className = "editor-slot";
  return { el, show({ href, label, primary }) {
    const a = doc.createElement("a");
    a.className = primary ? "btn btn-primary" : "btn";
    a.setAttribute("href", href);
    a.textContent = label;
    el.append(a);
  } };
}
