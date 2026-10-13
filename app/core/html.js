// Escaping-by-default templating. `html` escapes every interpolation unless it
// is wrapped in raw() or is itself the result of html``.
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const raw = s => new Raw(String(s ?? ""));

const part = v => v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join("") : (v === null || v === undefined || v === false) ? "" : esc(v);

/** html`<p>${userText}</p>` -> Raw (safe to nest, String() it for innerHTML). */
export function html(strings, ...values) {
  return new Raw(strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ""), ""));
}

// null/undefined/"" would otherwise become the epoch (new Date(null)), so they count as invalid.
const toDate = v => { if (v === null || v === undefined || v === "") return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
/** "Oct 12, 2026"; "—" for null/undefined/""/invalid input. */
export const fmtDate = iso => toDate(iso)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? "—";
/** "Oct 12, 2026, 3:45 PM"; "—" for null/undefined/""/invalid input. */
export const fmtDateTime = iso => { const d = toDate(iso); return d ? `${fmtDate(d)}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "—"; };

/** URL that serves an uploaded asset (views use this; it is not a gateway). The dev stub overrides via globalThis.__ERICBOARD_ASSET_URL(id). */
export const assetUrl = id => globalThis.__ERICBOARD_ASSET_URL?.(id) ?? "/_blob/" + encodeURIComponent(id);
