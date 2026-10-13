// Gateway for saving a generated file to the viewer's device. Contract: `await claude.use("downloads")` (null when the view cannot save);
// save({filename, data}) resolves once the viewer accepts and rejects with {code, message} otherwise.

/** @abstract */
export class DownloadsGateway {
  /** False when this view cannot save files: hide the control. */
  get available() { return true; }
  /** @param {{filename:string, data:string|Blob}} _file @returns {Promise<void>} */
  async save(_file) { throw new Error("DownloadsGateway.save not implemented"); }
}

const REASON = { declined: "The download was declined", rate_limited: "Another download prompt is open, try again in a moment", too_large: "The file is too large to save here", rejected_extension: "This file type cannot be saved here" };

/** Wraps `await claude.use("downloads")`. */
export class ArtifactDownloads extends DownloadsGateway {
  constructor(ns) { super(); this.ns = ns ?? null; }
  get available() { return this.ns !== null; }
  async save({ filename, data }) {
    if (!this.ns) throw new Error("Downloads are not available on this view");
    try { await this.ns.save({ filename, data }); }
    catch (e) { throw Object.assign(new Error(REASON[e?.code] ?? e?.message ?? "The download failed"), { code: e?.code }); }
  }
}

/** Plain browser save for file mode: an object URL on a temporary <a download>. Inert inside the artifact viewer, which uses ArtifactDownloads. */
export class BlobDownloads extends DownloadsGateway {
  constructor({ doc = globalThis.document, urls = globalThis.URL } = {}) { super(); this.doc = doc; this.urls = urls; }
  async save({ filename, data }) {
    const href = this.urls.createObjectURL(data instanceof Blob ? data : new Blob([data]));
    const a = this.doc.createElement("a");
    Object.assign(a, { href, download: filename });
    a.click();
    this.urls.revokeObjectURL(href);
  }
}

/** In-memory fake for tests and the dev stub: records every save. Pass `reject` (an Error) to make saves fail. */
export class MemoryDownloads extends DownloadsGateway {
  saved = [];
  constructor({ available = true, reject = null } = {}) { super(); this.#available = available; this.#reject = reject; }
  #available; #reject;
  get available() { return this.#available; }
  async save(file) { if (this.#reject) throw this.#reject; this.saved.push(file); }
}
