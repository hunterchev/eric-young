// Export module: "Export sheet" saves a project as a Markdown file through the downloads gateway (ctx.downloads).
// Depends on core only. It adds one extension and defines one extension point other modules fill:
//   extension  "project.actions"        (project, ctx) => HTMLElement | null   the "Export sheet" button; null (not rendered) when downloads are unavailable
//   extension  "project.actions"        the "Copy session prompt" button (brief + current state, plain text, to the clipboard); readers and writers
//   defines    "project.exportSections" (project, ctx) => { title: string, markdown: string } | null | Promise of the same
//                                         each provider adds one "## <title>" section after the sheet's own sections; the log module registers Decisions and Running log.
// ctx.downloads wiring (main.js): downloads: new ArtifactDownloads(await use("downloads")); the dev stub passes new MemoryDownloads().
import { ExportController } from "./controller.js";

export function register(ctx) {
  const ctl = new ExportController({ ctx });
  ctx.extensions.add("project.actions", project => ctl.action(project));
  ctx.extensions.add("project.actions", project => ctl.sessionAction(project));
}
