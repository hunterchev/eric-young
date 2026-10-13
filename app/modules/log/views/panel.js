// Pure views: props in, element out. Only classes from the page CSS (design.md) plus log/style.css.
const el = (doc, tag, cls, text) => {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const field = (doc, label, control, id) => {
  const f = el(doc, "div", "field");
  const l = el(doc, "label", "", label);
  l.setAttribute("for", id); control.setAttribute("id", id);
  f.append(l, control);
  return f;
};

/** Reader view: no form, one line saying why (file mode: Grok keeps the file). */
export function renderReadOnly({ doc, mode }) {
  const p = el(doc, "div", "panel");
  p.append(el(doc, "p", "", mode === "file" ? "This board is maintained by Grok. Ask Grok to log an update or change a sheet."
    : "You can read this board. Ask the owner for edit access to log updates."));
  return p;
}

/**
 * The "Log an update" form.
 * @param {{doc:Document, project:{id:string,status:string}, statuses:{id:string,label:string}[], sources:string[], maxText:number,
 *          parse:(text:string)=>{status?:string}, onSubmit:(v:{text:string,source:string,status:string})=>Promise<boolean>}} props
 */
export function renderPanel({ doc, project, statuses, sources, maxText, parse, onSubmit }) {
  const form = el(doc, "form", "panel");
  form.append(el(doc, "h3", "", "Log an update"));

  const text = el(doc, "textarea");
  text.setAttribute("placeholder", "Paste the DASHBOARD UPDATE block from Grok, or type a note.");
  text.setAttribute("aria-label", "Update text");
  text.setAttribute("maxlength", String(maxText));
  const hint = el(doc, "p", "hint", "Grok's update block fills the stage for you.");
  const area = el(doc, "div", "field"); area.append(text, hint);

  const source = el(doc, "select");
  sources.forEach(s => source.append(Object.assign(el(doc, "option", "", s), { value: s })));
  source.value = sources[0];
  const status = el(doc, "select");
  statuses.forEach(s => status.append(Object.assign(el(doc, "option", "", s.label), { value: s.id })));
  status.value = project.status;

  const fields = el(doc, "div", "log-fields");
  const key = `log-${project.id}`;
  fields.append(field(doc, "Source", source, `${key}-source`), field(doc, "Stage", status, `${key}-stage`));

  const btn = el(doc, "button", "btn btn-primary", "Add to log");
  btn.setAttribute("type", "submit");
  form.append(area, fields, btn);

  text.addEventListener("input", () => {
    const p = parse(text.value);
    if (p.status) status.value = p.status;
  });
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    btn.disabled = true;
    try {
      if (await onSubmit({ text: text.value, source: source.value, status: status.value })) text.value = "";
    } finally { btn.disabled = false; text.focus?.(); }   // saved or not, the keyboard user keeps typing here
  });
  form.setStage = id => { status.value = id; };   // the page's stage moved while a draft keeps this form alive
  form.hasDraft = () => text.value.trim() !== "";   // lets the page skip rebuilding the panel mid-draft
  form.textarea = text;   // the controller moves focus to the new textarea when the page rebuilds this panel
  return form;
}
