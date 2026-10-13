// exportMarkdown: a project sheet as one Markdown document. Pure: no I/O, no DOM.
// `project` is duck-typed to the projects module's Project (name, number, stageLabel, summary, components, questionRows, next, brief);
// modules never import each other, so nothing is imported from there.
const cell = s => String(s ?? "—").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() || "—";
const bullets = items => items.map(i => `- ${i}`).join("\n");
/** A fence longer than any backtick run inside, so a brief that contains ``` cannot close it early. */
const fenced = text => { const f = "`".repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map(r => r.length + 1))); return `${f}\n${text}\n${f}`; };
const section = (title, body) => `## ${title}\n\n${body || "None yet."}`;

/**
 * @param {object} project the sheet
 * @param {{title:string, markdown:string}[]} [sections] provider sections, appended in order
 * @param {{owner?:string, updated?:string}} [meta] title-block values the project does not carry (already formatted)
 * @returns {string}
 */
export function exportMarkdown(project, sections = [], { owner, updated } = {}) {
  const rows = project.questionRows.map(q => `- ${q.answered ? "[answered] " : ""}${q.text}`);
  const parts = [
    `# ${project.name}`,
    `| No. | Stage | Owner | Updated |\n| --- | --- | --- | --- |\n| ${[project.number, project.stageLabel, owner, updated].map(cell).join(" | ")} |`,
    section("Summary", project.summary),
    section("Parts and sensors", bullets(project.components)),
    section("Open questions", rows.join("\n")),
    section("Next steps", project.next.map((n, i) => `${i + 1}. ${n}`).join("\n")),
    section("Grok brief", project.brief && fenced(project.brief)),
    ...sections.map(s => `## ${s.title}\n\n${String(s.markdown ?? "").trim() || "None yet."}`),
  ];
  return parts.join("\n\n") + "\n";
}

const bullet = (sections, title, max = Infinity) => (sections.find(s => s.title === title)?.markdown ?? "").split("\n")
  .filter(l => l.startsWith("- ")).slice(0, max).map(l => (l.length > 200 ? `${l.slice(0, 199)}…` : l));   // ponytail: long log lines are cut at 200 characters
const block = (lines, none) => lines.length ? lines.join("\n") : none;

/**
 * The Grok brief followed by the sheet's current state, as plain text to paste into a new session. Pure.
 * Decisions and log lines come from the exportSections providers' "- " lines (newest first, as the log module writes them).
 * @param {object} project the sheet (name, stageLabel, brief, questionRows, next)
 * @param {{title:string, markdown:string}[]} [sections] provider sections ("Decisions", "Running log")
 * @param {{date?:string}} [meta] the date shown in the heading (already formatted)
 * @returns {string}
 */
export function sessionPrompt(project, sections = [], { date = "today" } = {}) {
  const open = project.questionRows.filter(q => !q.answered).map(q => `- ${q.text}`);
  const next = project.next.map(n => `- ${n}`);
  return [
    ...(project.brief ? [project.brief.trim(), ""] : []),
    `CURRENT STATE OF THIS PROJECT (from the board, ${date})`,
    `Stage: ${project.stageLabel}`,
    "Decisions so far:", block(bullet(sections, "Decisions"), "none yet"),
    "Open questions (not yet answered):", block(open, "none"),
    "Next steps:", block(next, "none"),
    "Last log entries (newest first, at most five):", block(bullet(sections, "Running log", 5), "none yet"),
    "",
    "Continue from this state. End the session with the DASHBOARD UPDATE block.",
  ].join("\n") + "\n";
}
