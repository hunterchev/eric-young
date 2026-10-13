// Hash router. Location is a bare token path in the hash: "#/p/pump-controls".
// Never query strings. Handlers get (params, path) and may return a dispose
// function that runs before the next route (use it to unsubscribe from db).

/** @typedef {(params:Record<string,string>, path:string) => (void|(() => void)|Promise<void|(() => void)>)} RouteHandler */

export class HashRouter {
  #routes = [];
  #dispose = null;
  #token = 0;
  #notFound = path => console.warn("No route for", path);
  #onError = e => console.error(e);
  #listeners = new Set();

  /** @param {{getHash?:()=>string, setHash?:(h:string)=>void, listen?:(fn:()=>void)=>void}} [env] injectable for tests */
  constructor(env = {}) {
    this.getHash = env.getHash ?? (() => location.hash);
    this.setHash = env.setHash ?? (h => { location.hash = h; });
    this.listen = env.listen ?? (fn => addEventListener("hashchange", fn));
  }

  /** @param {string} pattern "/", "/p/:id", "/archived" @param {RouteHandler} handler */
  register(pattern, handler) { this.#routes.push({ parts: split(pattern), pattern, handler }); }
  has(pattern) { return this.#routes.some(r => r.pattern === pattern); }
  setNotFound(fn) { this.#notFound = fn; }
  setOnError(fn) { this.#onError = fn; }
  /** Called with the resolved path after every navigation (shell uses it for the active nav link). */
  onNavigate(fn) { this.#listeners.add(fn); return () => this.#listeners.delete(fn); }

  navigate(path) { this.setHash("#" + path); }
  start() { this.listen(() => this.#run()); return this.#run(); }

  currentPath() { const h = this.getHash().replace(/^#/, ""); return h.startsWith("/") ? h : "/" + h; }

  /** Pure matcher: path -> {handler, params} | null. */
  match(path) {
    const segs = split(path);
    for (const r of this.#routes) {
      if (r.parts.length !== segs.length) continue;
      const params = {};
      const ok = r.parts.every((p, i) => p.startsWith(":") ? (params[p.slice(1)] = safeDecode(segs[i])) !== null : p === segs[i]);
      if (ok) return { handler: r.handler, params };
    }
    return null;
  }

  async #run() {
    const path = this.currentPath();
    const token = ++this.#token;
    try { this.#dispose?.(); } catch (e) { this.#onError(e); }
    this.#dispose = null;
    this.#listeners.forEach(fn => fn(path));
    const m = this.match(path);
    if (!m) return this.#notFound(path);
    try {
      const dispose = await m.handler(m.params, path);
      if (token !== this.#token) dispose?.();   // a newer navigation won the race
      else this.#dispose = typeof dispose === "function" ? dispose : null;
    } catch (e) { this.#onError(e); }
  }
}

const split = p => p.split("/").filter(Boolean);
const safeDecode = s => { try { return decodeURIComponent(s); } catch { return s; } };
