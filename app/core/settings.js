// Board settings (title and owner line): self-validating model + limits. Persistence is in ./settings-repository.js.
import { ValidationError } from "./validation.js";

export const DEFAULT_SETTINGS = Object.freeze({ title: "Eric Young", owner: "" });
export const MAX_TITLE = 60, MAX_OWNER = 80;

export class BoardSettings {
  /** @param {{title?:string, owner?:string}} [d] @throws {ValidationError} */
  constructor(d = {}) {
    const title = typeof d.title === "string" ? d.title.trim() : "";
    const owner = typeof d.owner === "string" ? d.owner.trim() : "";
    if (!title) throw new ValidationError("Board title is required");
    if (title.length > MAX_TITLE) throw new ValidationError(`Board title must be ${MAX_TITLE} characters or fewer`);
    if (owner.length > MAX_OWNER) throw new ValidationError(`Owner line must be ${MAX_OWNER} characters or fewer`);
    this.title = title; this.owner = owner;
  }
  toData() { return { title: this.title, owner: this.owner }; }
}
