// Gateway for "who is looking": controllers ask canWrite(), never claude.use("user").

/** @abstract */
export class UserGateway {
  /** @returns {Promise<boolean>} */
  async canWrite() { throw new Error("UserGateway.canWrite not implemented"); }
}

/** Wraps `await claude.use("user")`; a null namespace (not signed in) is read-only. */
export class ArtifactUser extends UserGateway {
  constructor(ns) { super(); this.ns = ns; }
  async canWrite() { return this.ns ? (this.ns.can("data.write") ?? true) : false; }
}

export class StaticUser extends UserGateway {
  constructor(write) { super(); this.write = !!write; }
  async canWrite() { return this.write; }
}
