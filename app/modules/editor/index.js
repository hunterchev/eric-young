// Editor module: create, edit, archive and illustrate projects; board title and owner line.
// Depends on core only. It reaches the projects page through extension points (the projects module renders them):
//   "board.actions"   (ctx) => HTMLElement            "New project", writers only
//   "project.actions" (project, ctx) => HTMLElement   "Edit sheet", writers only
// and announces writes on ctx.bus as "project.changed" {id}. Routes: /new, /p/:id/edit, /archived, /settings.
import { SettingsRepository } from "../../core/settings-repository.js";
import { EditorRepository } from "./repository.js";
import { EditorController } from "./controller.js";

/** Returns at once: settings reach the masthead when their first snapshot arrives. */
export async function register(ctx) {
  ctx.shell.loadStyle("app/modules/editor/style.css");
  const settings = new SettingsRepository(ctx.db);
  const ctl = new EditorController({ repo: new EditorRepository(ctx.db), settings, ctx });
  ctx.router.register("/new", () => ctl.showNew());
  ctx.router.register("/p/:id/edit", ({ id }) => ctl.showEdit(id));
  ctx.router.register("/archived", () => ctl.showArchived());
  ctx.router.register("/settings", () => ctl.showSettings());
  ctx.extensions.add("board.actions", () => ctl.boardAction());
  ctx.extensions.add("project.actions", project => ctl.projectAction(project));
  settings.onChange(s => ctl.applySettings(s), e => console.error("Could not read the board settings", e));
}
