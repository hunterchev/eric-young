// Help module: a plain how-to page for the Grok hand-off and the six stages. Depends on core only.
// Route: /help. The Director adds the loader line and the "Help" place at integration.
import { STAGES } from "../../core/stages.js";
import { helpView } from "./views/help.js";

export function register(ctx) {
  ctx.router.register("/help", () => { ctx.shell.show(helpView({ stages: STAGES, mode: ctx.mode })); });
}
