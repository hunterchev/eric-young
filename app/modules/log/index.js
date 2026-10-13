// Log module: each project's running log and the DASHBOARD UPDATE form.
// Depends on core only: extends the project page through ctx.extensions and notifies through ctx.bus.
import { LogRepository } from "./repository.js";
import { LogController } from "./controller.js";

/** Returns at once: the log renders when its first snapshot arrives; a failed read shows an error inside the log panel only. */
export function register(ctx) {
  ctx.shell.loadStyle("app/modules/log/style.css");
  const repo = new LogRepository(ctx.db);
  const log = new LogController({ repo, bus: ctx.bus, user: ctx.user, shell: ctx.shell, mode: ctx.mode });
  repo.start(() => log.fail());   // panel-level error: the board and sheet stay up
  ctx.extensions.add("project.panel", project => log.render(project));
  ctx.extensions.add("project.cardMeta", log.cardMeta);
  ctx.extensions.add("board.sections", log.recentSection);   // rows carry projectId; the board adds the sheet names
  ctx.extensions.add("project.exportSections", log.exportSections);   // returns [{title, markdown}, ...]
}
