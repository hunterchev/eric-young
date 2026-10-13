// Board settings persistence over the DbGateway, doc "board/settings". Model and limits live in ./settings.js.
import { BoardSettings, DEFAULT_SETTINGS } from "./settings.js";

const COLLECTION = "board", ID = "settings";
const parse = data => { try { return new BoardSettings(data ?? {}); } catch (e) { console.warn(`Ignoring invalid board settings: ${e.message}`); return new BoardSettings(DEFAULT_SETTINGS); } };

export class SettingsRepository {
  /** @param {import("./db.js").DbGateway} db */
  constructor(db) { this.db = db; }
  /** Stored settings, or the defaults when none (or invalid ones) are stored. */
  async get() { const s = await this.db.doc(`${COLLECTION}/${ID}`).get(); return s.exists ? parse(s.data) : new BoardSettings(DEFAULT_SETTINGS); }
  /** @param {BoardSettings} settings validated model @returns {Promise<BoardSettings>} */
  async save(settings) { const s = new BoardSettings(settings); await this.db.doc(`${COLLECTION}/${ID}`).set(s.toData()); return s; }
  /** cb(BoardSettings) on every snapshot (defaults while nothing is stored). @returns {() => void} unsubscribe */
  onChange(cb, onError) {
    return this.db.collection(COLLECTION).onChange(rows => { const r = rows.find(x => x.id === ID); cb(r ? parse(r.data) : new BoardSettings(DEFAULT_SETTINGS)); }, onError);
  }
}
