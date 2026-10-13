// Composition root: resolve gateways, build the shell, let each module register, start the router.
import { ArtifactDb } from "./core/db.js";
import { ArtifactUser, StaticUser } from "./core/user.js";
import { ArtifactAssets } from "./core/assets.js";
import { ArtifactDownloads, BlobDownloads } from "./core/downloads.js";
import { FileDb, loadBoardFile } from "./core/filedb.js";
import { HashRouter } from "./core/router.js";
import { EventBus } from "./core/events.js";
import { Extensions } from "./core/extensions.js";
import { Shell } from "./shell/shell.js";
import { modules } from "./modules/index.js";

const PLACES = [
  { label: "Board", path: "/", also: ["/p/"] },
  { label: "Archived", path: "/archived" },
  { label: "Settings", path: "/settings" },
  { label: "Help", path: "/help" },
];

const LOAD_WATCHDOG_MS = 15000;
const LOAD_FAILED = "Could not load the board data. Reload the page; on claude.ai, open it while signed in.";

/** Each loader + register(ctx) in its own try/catch: a module that fails to load is logged and skipped, the rest still boot. */
export async function loadModules(loaders, ctx) {
  for (const load of loaders) {
    try { await (await load()).register(ctx); } catch (e) { console.error("A module failed to load", e); ctx.shell.toast("A module failed to load"); }
  }
}

const use = async name => { try { return await claude.use(name); } catch { return null; } };

/** Three modes, reported as ctx.mode:
 *  "artifact": inside claude.ai (window.claude.use): the artifact database, signed-in permissions.
 *  "file": no window.claude and data/board.json is served: a read-only board that Grok edits as a file; images resolve through its asset map.
 *  "dev": no window.claude and no board file, or `?dev` in the URL: the local stub seeded from seed.json (never published).
 *  A board file that is served but invalid rejects with a message for the page; the dev stub is not tried. */
export async function gateways() {
  if (window.claude?.use) {
    const db = await use("db");
    if (!db) return null;
    return { mode: "artifact", db: new ArtifactDb(db), user: new ArtifactUser(await use("user")), assets: new ArtifactAssets(await use("assets")), downloads: new ArtifactDownloads(await use("downloads")) };
  }
  if (!/[?&]dev\b/.test(globalThis.location?.search ?? "")) {
    let board;
    try { board = await loadBoardFile(); } catch (e) { throw new Error(`data/board.json could not be read: ${e.message}. Run node scripts/check-board-data.mjs and fix the file.`); }
    if (board) {
      const db = new FileDb(board);
      globalThis.__ERICBOARD_ASSET_URL = id => db.assetUrl(id);
      return { mode: "file", db, user: new StaticUser(false), assets: new ArtifactAssets(null), downloads: new BlobDownloads() };
    }
  }
  return { mode: "dev", ...await (await import("../dev/claude-stub.js")).createDevGateways() };
}

/** Phones lay a page out at 980 px without this; claude.ai supplies one, file and dev pages do not. */
export function ensureViewport(doc = document) {
  if (doc.querySelector?.('meta[name="viewport"]')) return;   // ?. : headless element stubs have no selector engine
  const meta = doc.createElement("meta");
  meta.setAttribute("name", "viewport");
  meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
  doc.head.append(meta);
}

async function boot() {
  ensureViewport();
  const shell = new Shell().mount(document.getElementById("app"));
  const router = new HashRouter();
  router.setNotFound(path => shell.renderNotFound(path));
  router.setOnError(e => { console.error(e); shell.renderError(e?.message || "Something went wrong"); });
  router.onNavigate(path => { shell.routed(path); scrollTo(0, 0); });

  let g;
  try { g = await gateways(); } catch (e) { console.error(e); return shell.renderError(e.message); }
  if (!g) return shell.renderError("Sign in to claude.ai to open this board");
  const ctx = { router, shell, bus: new EventBus(), extensions: new Extensions(), ...g };

  // Armed before the modules load so a register() that breaks the "return promptly" contract cannot hang the page either.
  shell.watchLoading(LOAD_WATCHDOG_MS, LOAD_FAILED);
  await loadModules(modules, ctx);
  if (!router.has("/")) router.register("/", () => shell.renderEmpty("No projects yet", "The projects module is not installed."));
  shell.nav(PLACES.filter(p => router.has(p.path)));
  router.start();
}

boot().catch(e => { console.error(e); document.getElementById("app").textContent = "The board could not start."; });
