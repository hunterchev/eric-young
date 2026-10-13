// Small guards used by controllers at trust boundaries (forms, imported data).
export class ValidationError extends Error {
  constructor(message) { super(message); this.name = "ValidationError"; }
}

/** Non-empty string (after trim) or throw. Returns the trimmed string. */
export function required(value, name = "value") {
  const s = typeof value === "string" ? value.trim() : value;
  if (s === undefined || s === null || s === "") throw new ValidationError(`${name} is required`);
  return s;
}

/** value must be one of list or throw. */
export function oneOf(value, list, name = "value") {
  if (!list.includes(value)) throw new ValidationError(`${name} must be one of: ${list.join(", ")}`);
  return value;
}
