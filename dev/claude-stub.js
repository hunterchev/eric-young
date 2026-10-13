// Dev stub: stands in for window.claude when the page runs from the local run contract.
// Never published to the artifact; app/main.js imports it only when window.claude is absent.
import { MemoryDb } from "../app/core/db.js";
import { MemoryAssets } from "../app/core/assets.js";
import { StaticUser } from "../app/core/user.js";
import { MemoryDownloads } from "../app/core/downloads.js";

const IMAGE_FILES = {
  dd9b9c3fede3773644eed2d193970bcf: "3.png", d6673b0bff4e765a6f0f4e92e8a84fee: "1.png",
  "941702b39331ccc7f9159abd18597b30": "2.png", "5b8612443d398f2f846d6d8242e517d4": "4.png",
  "05a98c0a0b4f324465ac05b3f7ef2229": "5.png", "7fdb5b0d27b7cc00d70b735fa36c5d60": "6.png",
  edffc524af7a891bcd7fbac0a3809f72: "7.png", "25e64ce108412acbb507e71c368b4e96": "8.png",
};

export async function createDevGateways() {
  const res = await fetch(new URL("../seed.json", import.meta.url));   // ok === false: headless fetch stubs omit ok, a real Response never does
  if (res.ok === false) throw new Error("Development mode needs seed.json next to the page. This copy runs from data/board.json; open eric-board.html without ?dev.");
  const seed = await res.json();
  const root = new URL("../", import.meta.url);
  const blobUrls = new Map();
  globalThis.__ERICBOARD_ASSET_URL = id => blobUrls.get(id) ?? (IMAGE_FILES[id] ? new URL(`images/${IMAGE_FILES[id]}`, root).href : "/_blob/" + encodeURIComponent(id));
  // Local uploads: show the attached file through an object URL so its thumbnail renders without a server.
  class DevAssets extends MemoryAssets {
    async upload(blob, options) {
      const r = await super.upload(blob, options);
      r.url = URL.createObjectURL(blob); blobUrls.set(r.id, r.url);
      return r;
    }
  }

  const db = new MemoryDb();
  const keys = Object.keys(seed);
  db.seed("projects", keys.map(k => ({ id: k, data: seed[k] })));
  const day = 86400000, now = Date.now();
  db.seed("log", keys.map((k, i) => ({
    id: `seed-${k}`,
    data: { project: k, ts: new Date(now - (i + 1) * day).toISOString(), source: "Claude", status: seed[k].status, text: "Loaded from Eric's notes. This is the starting point; later updates are logged above it." },
  })));
  return { db, user: new StaticUser(true), assets: new DevAssets(), downloads: new MemoryDownloads() };
}
