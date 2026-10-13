# Modules contract

Each feature is a folder `app/modules/<name>/` with an `index.js` that exports `register(ctx)` (sync or async).
Add it with ONE loader line in `app/modules/index.js`:

```js
modules.push(() => import("./projects/index.js"));
```

`main.js` runs each loader and `register(ctx)` in its own try/catch: a module that fails to load is logged (`console.error`) and skipped, the rest still boot.
`register(ctx)` must return promptly: subscribe and render when data arrives, never await the first db snapshot inside it.

Removing a module = delete its folder and that line. No other file may import anything inside a module folder: modules talk only through `ctx.extensions` and `ctx.bus` (below). `scripts/check-boundaries.mjs` enforces this.

## Layering (MVC, per module)

`models` (plain data + rules) · `controllers` (use cases, talk to repositories) · `views` (render, only classes from the page CSS) · `repository` (wraps `ctx.db`).
Views never import `core/db.js`, `core/assets.js`, `core/user.js`, repositories or gateways; they take `assetUrl`, `fmtDate`, `fmtDateTime` (which return "—" for missing/invalid dates) and `html` from `core/html.js`. Controllers are testable without a browser using `tests/helpers/fakes.js`.

## Registration context

| field | type | use |
|---|---|---|
| `router` | `HashRouter` | `router.register("/p/:id", (params, path) => { ...; return dispose })`. Paths: `/`, `/p/:id`, `/archived`, `/settings`. Hash routing only, no query strings. |
| `shell` | `Shell` | `show(htmlOrNode)`, `renderLoading/Empty/NotFound/Error`, `toast(msg)` (every data change shows one), `setTitle`, `setOwnerLine`, `nav(items)` (places only), `loadStyle(href)` for the module's own `style.css`, `region` |
| `db` | `DbGateway` | `collection(p).list/add`, `collection(p).onChange(cb, onError)` (onError: snapshot failed; render `shell.renderError(message)`), `doc("coll/id").get/set/update/delete` |
| `user` | `UserGateway` | `await user.canWrite()` |
| `assets` | `AssetGateway` | `upload(blob) -> {id}`; show with `assetUrl(id)` from `core/html.js` |
| `bus` | `EventBus` | `on/off/emit` for cross-module events (below) |
| `extensions` | `Extensions` | `add(point, fn) -> unsubscribe`, `list(point) -> fn[]` (registration order), `onAdd(point, cb(fn)) -> unsubscribe` |

The Board, Archived and Settings nav links appear only when some module registers `/`, `/archived`, `/settings`.

## Extension points (`ctx.extensions`)

- `"project.panel"`: `(project, ctx) => HTMLElement | Raw`, rendered into the project page's panel slot. Projects repaints the open project page when a panel is added (`onAdd`).
- `"project.cardMeta"`: `(project) => { text: string|null, entries: number } | null`. Projects uses `text` for the card's meta line and `entries` for the title-block Rev and the board's "Log entries" count (sum). Called often: keep it cheap and synchronous.

- `"project.actions"`: `(project, ctx) => HTMLElement`, appended to the project header's `.project-actions` slot (`data-actions-slot`). Projects repaints the open project page when one is added.
- `"board.actions"`: `(ctx) => HTMLElement`, appended to the board's `.board-actions` strip (`data-actions-slot`). Projects repaints the board when one is added.

The board tracks the stage (idea, research, design, prototype, test, done) and the running log, nothing else. CHK-NOPCT guards it.

## Bus events (`ctx.bus`)

- `"project.updateStatus"` `{ id, status?, updatedAt? }`: emitted by log after a logged update; projects validates, writes through its repository and toasts "Could not update stage: <message>" on failure. Fire-and-forget: the emitter does not await it.
- `"log.changed"` `{ project }`: emitted by log after an entry is added or removed; projects repaints card meta/Rev.

## Error state

If the region still shows the loading state 15 s after boot starts loading modules, `main.js` renders `shell.renderError(...)`. A module whose `onChange` reports an error renders `shell.renderError(message)` itself.

## Design

Use the classes in `docs/r2os/development/design.md` (`.sheet`, `.title-block`, `.stage-track`, `.stage`, `.btn`, `.btn-primary`, `.field`, `.panel`, `.state-*`). Module-only classes go in `app/modules/<name>/style.css` and must use tokens defined on `:root`.

### Contract additions (V2)
- `project.cardMeta` providers return `{ text, entries, latestTs }`; `latestTs` is the ISO timestamp of the latest log entry (projects use it as the Updated fallback).
- Bus `log.changed` payload `{ project }` where `project` may be `null`, meaning "any project changed" (emitted once per log snapshot); consumers repaint whatever they show.
- Log load errors render inside the log panel; modules never call `shell.renderError` for a single collection failure.
- The DASHBOARD UPDATE block has an optional `DECIDED:` line; entries carry `decided` and the log panel lists them under "Decisions".

### Contract additions (V3)
- `ctx.downloads`: a `DownloadsGateway` (`save({filename, data})`, `available`); the export module hides its action when unavailable.
- Extension point `project.exportSections`: `(project, ctx) => {title, markdown} | [{title, markdown}, …] | null | Promise`; the log module contributes Decisions and Running log; the export module collects them.
- Attachments: `images` entries are `{id, caption, kind}` with kind `image` (default) or `pdf`.
- Places: Board, Archived, Settings, Help (main.js PLACES).

### Contract additions (V4)
- Extension point `board.sections`: providers `(ctx, ids) => { title, rows: [{ projectId, ts, status|null, text }] } | null`; the projects board renders rows as links with the sheet name; the log module provides "Recent updates" (newest first, at most eight).
- Bus `settings.changed` payload `{ title, owner }`: emitted by the editor's settings path after a save and after each settings snapshot; projects repaint the open sheet and board on it.
- A project panel element may expose `refresh(project)`; projects call it instead of rebuilding while `hasDraft()` is true.
- Boundary rule (f): every named export from core, shell and module index files must be imported by another app/dev file (exceptions in scripts/export-allowlist.json).

### Contract additions (V5)
- The export module registers two `project.actions` entries: "Export sheet" (downloads) and "Copy session prompt" (clipboard with a select-and-copy fallback).
- `project.exportSections` providers may return a single `{title, markdown}` or an array of them.
- Shell: a "Skip to content" link focuses the content region; the toast region is `role="status" aria-live="polite"`; the places nav carries `aria-current="page"`; `scripts/check-a11y.mjs` enforces the mechanical rules on nine screens.
