// Pattern: Repository/Gateway. Modules talk to DbGateway only, never to
// window.claude. ArtifactDb is production; MemoryDb backs tests and the dev stub.
//
// collection(path) -> { list(): Promise<Array<{id,data}>>,
//                       onChange(cb(Array<{id,data}>), onError?(Error)): unsubscribe,  // onError: snapshot failed (permission, offline)
//                       add(data): Promise<{id}> }
// doc("collection/id") -> { get(): Promise<{id,exists,data}>,   // never null; exists=false, data=null when missing
//                           set(data), update(data), delete() }  // all Promise<void>

/** @abstract */
export class DbGateway {
  collection(_path) { throw new Error("DbGateway.collection not implemented"); }
  doc(_path) { throw new Error("DbGateway.doc not implemented"); }
}

const toRows = snap => snap.docs.map(d => ({ id: d.id, data: d.data() }));

/** Wraps the Firestore-like namespace from `await claude.use("db")`. */
export class ArtifactDb extends DbGateway {
  constructor(ns) { super(); this.ns = ns; }
  collection(path) {
    const c = this.ns.collection(path);
    return {
      // ponytail: list() takes one snapshot via onSnapshot (the only read API the baseline used); switch to get() if the namespace offers it.
      list: () => new Promise((resolve, reject) => {
        let done = false, un = null;
        un = c.onSnapshot(s => { if (done) return; done = true; resolve(toRows(s)); un ? un() : queueMicrotask(() => un?.()); }, reject);
      }),
      onChange: (cb, onError) => c.onSnapshot(s => cb(toRows(s)), e => { console.error(`db onChange(${path})`, e); onError?.(e); }),
      add: async data => ({ id: (await c.add(data)).id }),
    };
  }
  doc(path) {
    const d = this.ns.doc(path);
    return {
      get: async () => {
        const s = await d.get();
        const exists = typeof s.exists === "function" ? s.exists() : !!s.exists;
        return { id: s.id ?? path.split("/").pop(), exists, data: exists ? s.data() : null };
      },
      set: data => d.set(data),
      update: data => d.update(data),
      delete: () => d.delete(),
    };
  }
}

/** In-memory gateway: onChange fires immediately and after every write to that collection (never errors; onError is accepted and unused). */
export class MemoryDb extends DbGateway {
  #cols = new Map();   // collection path -> Map(id -> data)
  #subs = new Map();   // collection path -> Set(cb)
  #n = 0;

  /** Test/stub helper: preload rows [{id,data}] into a collection. */
  seed(path, rows) { rows.forEach(r => this.#col(path).set(r.id, structuredClone(r.data))); }

  #col(p) { if (!this.#cols.has(p)) this.#cols.set(p, new Map()); return this.#cols.get(p); }
  #rows(p) { return [...this.#col(p)].map(([id, data]) => ({ id, data: structuredClone(data) })); }
  #fire(p) { for (const cb of [...(this.#subs.get(p) ?? [])]) cb(this.#rows(p)); }
  #split(path) { const i = path.indexOf("/"); return [path.slice(0, i), path.slice(i + 1)]; }

  collection(path) {
    return {
      list: async () => this.#rows(path),
      onChange: (cb, _onError) => {
        if (!this.#subs.has(path)) this.#subs.set(path, new Set());
        this.#subs.get(path).add(cb);
        cb(this.#rows(path));
        return () => this.#subs.get(path).delete(cb);
      },
      add: async data => { const id = `m${++this.#n}`; this.#col(path).set(id, structuredClone(data)); this.#fire(path); return { id }; },
    };
  }

  doc(path) {
    const [col, id] = this.#split(path);
    return {
      get: async () => { const data = this.#col(col).get(id); return { id, exists: data !== undefined, data: data === undefined ? null : structuredClone(data) }; },
      set: async data => { this.#col(col).set(id, structuredClone(data)); this.#fire(col); },
      update: async data => {
        const cur = this.#col(col).get(id);
        if (cur === undefined) throw new Error(`No document at ${path}`);
        this.#col(col).set(id, { ...cur, ...structuredClone(data) });
        this.#fire(col);
      },
      delete: async () => { this.#col(col).delete(id); this.#fire(col); },
    };
  }
}
