// Projects module: the board of project sheets and the project page.
// Other modules never import this file; they extend it through ctx.extensions and talk to it over ctx.bus:
//   extensions "project.panel"    (project, ctx) => HTMLElement | Raw   rendered into the project page's panel slot
//   extensions "project.cardMeta" (project) => {text:string|null, entries:number} | null   (sync, cheap)
//   bus "project.updateStatus"    {id, status?, updatedAt?}   validated and written here; failure toasts
//   extensions "project.actions"  (project, ctx) => HTMLElement   appended to the project header actions slot
//   extensions "board.actions"    (ctx) => HTMLElement            appended to the board header actions slot
//   extensions "board.sections"  (ctx, ids) => {title, rows:[{projectId, ts, status?, text}]} | null   rendered under the counts strip as links to the sheets
//   bus "settings.changed"        {title, owner}   repaints the open sheet (Owner) and the board
//   bus "log.changed"             {project}   repaints card meta / Rev for the board or the shown project
// Draft protocol: a panel element may expose `hasDraft` (boolean or () => boolean). While it is true, a data
// repaint of the same project re-mounts that same element instead of re-rendering the panels, so typed input survives.
import { ProjectRepository } from "./repository.js";
import { ProjectsController } from "./controller.js";


export function register(ctx) {
  const repo = new ProjectRepository(ctx.db);
  const controller = new ProjectsController({ repo, ctx });
  ctx.shell.loadStyle("app/modules/projects/style.css");
  ctx.router.register("/", () => controller.showBoard());
  ctx.router.register("/p/:id", ({ id }) => controller.showProject(id));
}
