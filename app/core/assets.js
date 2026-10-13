// Gateway for uploaded images (upload is used by the editor module). Display URLs come from assetUrl(id) in core/html.js.

/** @typedef {{id:string, url:string, sizeBytes:number, contentType:string}} UploadResult */

/** @abstract */
export class AssetGateway {
  /** False when uploads cannot work in this view (read-only viewers get a null `assets` namespace): hide the controls. */
  get available() { return true; }
  /** @param {Blob} blob @param {{type?:string}} [options] @returns {Promise<UploadResult>} */
  async upload(_blob, _options) { throw new Error("AssetGateway.upload not implemented"); }
}

/** Wraps `await claude.use("assets")` (null on a read-only view). Contract: upload(blob, {type?}) -> {id, url, sizeBytes, contentType}; reject codes in assets.d.ts. */
export class ArtifactAssets extends AssetGateway {
  constructor(ns) { super(); this.ns = ns ?? null; }
  get available() { return this.ns !== null; }
  async upload(blob, options) {
    if (!this.ns) throw new Error("File upload is not available on this view");
    const { id, url, sizeBytes, contentType } = await this.ns.upload(blob, options);
    return { id, url, sizeBytes, contentType };
  }
}

/** In-memory fake for tests; ids are sequential. */
export class MemoryAssets extends AssetGateway {
  items = new Map();
  #n = 0;
  async upload(blob, options) {
    const id = `mem${++this.#n}`;
    this.items.set(id, blob);
    return { id, url: "/_blob/" + id, sizeBytes: blob?.size ?? 0, contentType: options?.type ?? blob?.type ?? "" };
  }
}
