// Pattern: pure parser. Reads the DASHBOARD UPDATE block Grok prints; no DOM, no I/O.
import { STAGES } from "../../core/stages.js";

// "Prototyping" and "proto" both mean prototype; the stem decides the former, a prefix the latter.
const STEMS = { idea: "idea", research: "research", design: "design", prototype: "prototyp", test: "test", done: "done" };
// PROGRESS is a key only so a legacy line is recognised and dropped (it must not swallow into the line above); its value is never read.
const KEY = /^[ \t]*(?:[-*][ \t]+)?(STATUS|PROGRESS|DONE|DECIDED|NEXT|OPEN)[ \t]*:[ \t]*(.*)$/i;

export class UpdateParser {
  /** "Researching" -> "research"; unknown words -> undefined. */
  static normalizeStatus(value) {
    const w = /^[a-z]+/.exec(String(value).trim().toLowerCase())?.[0];
    if (!w) return undefined;
    return STAGES.map(s => s.id).find(id => w.startsWith(STEMS[id]) || (w.length >= 3 && id.startsWith(w)));
  }

  /** @returns {{status?:string,done?:string,decided?:string,next?:string,open?:string}} */
  static parse(text) {
    const found = {};
    let cur = null;
    for (const line of String(text ?? "").split(/\r?\n/)) {
      const m = KEY.exec(line);
      if (m) {
        cur = m[1].toLowerCase();
        if (cur in found) cur = null;           // first occurrence wins
        else found[cur] = m[2].trim();
      } else if (cur && /^[ \t]+\S/.test(line)) found[cur] += "\n" + line.trim();   // indented continuation
      else cur = null;
    }
    const out = {};
    const status = "status" in found && UpdateParser.normalizeStatus(found.status);
    if (status) out.status = status;
    for (const k of ["done", "decided", "next", "open"]) if (found[k]) out[k] = found[k];
    return out;
  }
}
