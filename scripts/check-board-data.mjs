// CHK-BOARDDATA: data/board.json (the file Grok edits) is valid. Usage: node scripts/check-board-data.mjs [root] [boardFile]
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(process.argv[2] ?? new URL("..", import.meta.url).pathname);
const file = resolve(root, process.argv[3] ?? "data/board.json");
const STAGES = ["idea", "research", "design", "prototype", "test", "done"];
const text = v => typeof v === "string" && v.trim() !== "";
const bad = [];

let board;
try { board = JSON.parse(readFileSync(file, "utf8")); } catch (e) { console.error(`${file}: ${e.message}\n1 violation(s)`); process.exit(1); }
const isMap = v => v !== null && typeof v === "object" && !Array.isArray(v);

if (board.schema !== "eric-board/1") bad.push(`schema must be "eric-board/1", found ${JSON.stringify(board.schema)}`);
if (!text(board.settings?.title)) bad.push("settings.title must be a non-empty string");
for (const k of ["projects", "log", "assets"]) if (!isMap(board[k])) bad.push(`${k} must be an object`);
const projects = isMap(board.projects) ? board.projects : {}, log = isMap(board.log) ? board.log : {}, assets = isMap(board.assets) ? board.assets : {};

const noPct = (v, path) => {
  if (!v || typeof v !== "object") return;
  for (const [k, x] of Object.entries(v)) { if (k === "pct") bad.push(`${path}.pct must not exist (the board tracks stage only)`); noPct(x, `${path}.${k}`); }
};
noPct(board, "board");

for (const [id, assetPath] of Object.entries(assets))
  if (!text(assetPath) || !existsSync(resolve(root, assetPath))) bad.push(`assets.${id}: file ${JSON.stringify(assetPath)} does not exist`);

for (const [k, p] of Object.entries(projects)) {
  const fail = m => bad.push(`${k}: ${m}`);
  for (const f of ["name", "tagline", "summary"]) if (!text(p[f])) fail(`${f} must be a non-empty string`);
  if (!STAGES.includes(p.status)) fail(`status "${p.status}" is not one of ${STAGES.join(", ")}`);
  if (typeof p.order !== "number" || !Number.isFinite(p.order)) fail("order must be a number");
  if (!Array.isArray(p.images)) fail("images must be an array");
  else p.images.forEach((im, i) => {
    if (!text(im?.id)) fail(`images[${i}] needs an id`);
    else if (!(im.id in assets)) fail(`images[${i}] id ${im.id} is not in the asset map`);
  });
  if (!Array.isArray(p.components) || p.components.length < 1) fail("components needs at least 1 entry");
  if (!Array.isArray(p.questions)) fail("questions must be an array");
  if (!Array.isArray(p.next)) fail("next must be an array");
  if (p.answered !== undefined) {
    if (!Array.isArray(p.answered)) fail("answered must be an array");
    else for (const a of p.answered) if (!Array.isArray(p.questions) || !p.questions.includes(a)) fail(`answered entry is not in questions: ${JSON.stringify(a).slice(0, 60)}`);
  }
  for (const w of ["DASHBOARD UPDATE", "STATUS:", "DONE:", "DECIDED:", "NEXT:", "OPEN:"]) if (!text(p.brief) || !p.brief.includes(w)) fail(`brief must contain "${w}"`);
  if (text(p.brief) && p.brief.includes("PROGRESS:")) fail('brief must not contain "PROGRESS:"');
}

for (const [id, e] of Object.entries(log)) {
  const fail = m => bad.push(`log.${id}: ${m}`);
  if (!(e?.project in projects)) fail(`project ${JSON.stringify(e?.project)} does not exist`);
  if (!text(e?.ts) || Number.isNaN(Date.parse(e.ts))) fail(`ts ${JSON.stringify(e?.ts)} is not an ISO date`);
  if (!text(e?.source)) fail("source must be non-empty");
  if (!text(e?.text)) fail("text must be non-empty");
  if (e?.status !== undefined && !STAGES.includes(e.status)) fail(`status "${e.status}" is not one of ${STAGES.join(", ")}`);
}

if (bad.length) { console.error(bad.join("\n") + `\n${bad.length} violation(s)`); process.exit(1); }
console.log(`board data ok: ${Object.keys(projects).length} projects, ${Object.keys(log).length} log entries, ${Object.keys(assets).length} assets, 0 violations`);
