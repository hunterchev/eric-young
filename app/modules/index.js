// Module registry. Feature modules plug into the shell through this one file.
//
// Contract: each module lives in app/modules/<name>/ and its index.js exports
//   register(ctx)   sync or async, but it must return promptly: subscribe and render when data
//                   arrives, never await the first db snapshot (main.js awaits register in turn).
// A module is added with ONE loader line in the array below, e.g.
//   modules.push(() => import("./projects/index.js"));
// main.js runs each loader + register(ctx) in its own try/catch; a module that fails to load is
// logged and skipped, the rest still boot.
// Removing a module = delete its folder and that one line. No other file may import it:
// modules talk only through ctx.extensions (named points) and ctx.bus (events).

/**
 * @typedef {Object} ModuleContext
 * @property {import("../core/router.js").HashRouter} router   register routes: router.register("/p/:id", handler)
 * @property {import("../shell/shell.js").Shell} shell         render states, toast, set title/owner, nav, loadStyle
 * @property {import("../core/db.js").DbGateway} db            data access (never window.claude); collection(p).onChange(cb, onError)
 * @property {import("../core/user.js").UserGateway} user      user.canWrite()
 * @property {import("../core/assets.js").AssetGateway} assets upload images; assetUrl(id) from core/html.js shows them
 * @property {import("../core/events.js").EventBus} bus        cross-module events: "project.updateStatus", "log.changed"
 * @property {import("../core/downloads.js").DownloadsGateway} downloads save a file for the viewer (check .available)
 * @property {import("../core/extensions.js").Extensions} extensions named extension points: "project.panel", "project.cardMeta"
 */

/** @type {(() => Promise<{register:(ctx:ModuleContext)=>void|Promise<void>}>)[]} */
export const modules = [];

// -- one line per module below this marker --
modules.push(() => import("./projects/index.js"));
modules.push(() => import("./log/index.js"));
modules.push(() => import("./editor/index.js"));
modules.push(() => import("./export/index.js"));
modules.push(() => import("./help/index.js"));
