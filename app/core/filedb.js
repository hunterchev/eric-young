// Pattern: Repository/Gateway (read-only implementation of DbGateway). The board runs from data/board.json,
// which Grok edits directly; nothing in the page can write, so every write rejects with a plain message.
import { DbGateway } from "./db.js";

const READ_ONLY_MESSAGE = "This board is maintained by Grok; ask Grok to change it";
const SCHEMA = "eric-board/1";
const refuse = () => Promise.reject(new Error(READ_ONLY_MESSAGE));
const isMap = v => v !== null && typeof v === "object" && !Array.isArray(v);

export class FileDb extends DbGateway {
  #cols; #assets;

  /** @param {{projects:object, log:object, settings:object, assets?:object}} board parsed data/board.json (see loadBoardFile) */
  constructor(board) {
    super();
    this.#cols = { projects: board.projects, log: board.log, board: { settings: board.settings } };
    this.#assets = board.assets ?? {};
  }

  #rows(path) { return Object.entries(this.#cols[path] ?? {}).map(([id, data]) => ({ id, data: structuredClone(data) })); }

  collection(path) {
    return {
      list: async () => this.#rows(path),
      // One snapshot, no live updates: the file only changes when the page is reloaded.
      onChange: cb => { cb(this.#rows(path)); return () => {}; },
      add: refuse,
    };
  }

  doc(path) {
    const i = path.indexOf("/"), col = path.slice(0, i), id = path.slice(i + 1);
    return {
      get: async () => {
        const data = this.#cols[col]?.[id];
        return { id, exists: data !== undefined, data: data === undefined ? null : structuredClone(data) };
      },
      set: refuse, update: refuse, delete: refuse,
    };
  }

  /** Where an uploaded-image id lives: the board's asset map, else the folder the manual tells Grok to use. */
  assetUrl(id) { return this.#assets[id] ?? `data/files/${encodeURIComponent(id)}`; }
}

/** Fetches and shape-checks the board file. Resolves null when there is no file to read (fetch fails or the
 *  server answers not-ok, e.g. 404); rejects when the file is there but is not valid JSON or not an eric-board/1 board. */
export async function loadBoardFile(url = "data/board.json") {
  let res;
  try { res = await fetch(url); } catch { return null; }
  if (!res.ok) return null;
  const board = await res.json();
  if (board?.schema !== SCHEMA) throw new Error(`schema must be "${SCHEMA}"`);
  for (const k of ["settings", "projects", "log"]) if (!isMap(board[k])) throw new Error(`"${k}" must be an object`);
  if (board.assets !== undefined && !isMap(board.assets)) throw new Error(`"assets" must be an object`);
  return board;
}
