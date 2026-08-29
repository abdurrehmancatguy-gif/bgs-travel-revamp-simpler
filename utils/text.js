/**
 * Punctuation the site does not use.
 *
 * The em dash is out. Removing it from the shipped copy is only half the job:
 * the live catalogue comes from Firestore, and records saved before this rule
 * existed still carry them — so anything read from the store passes through
 * here on the way to the page, and a dash pasted into the admin tomorrow is
 * normalised the same way.
 *
 * A dash between two words is doing the work of a comma, so that is what it
 * becomes. Between two numbers it is a range, so it becomes a hyphen.
 */
const EM = /—/;

export function dedash(value) {
  if (typeof value !== "string" || !EM.test(value)) return value;
  return value
    // "1994 — 1996" is a range; "you — one team" is an aside.
    .replace(/(\S)\s*—\s*(\S)/g, (_, before, after) =>
      /\d/.test(before) && /\d/.test(after) ? `${before}-${after}` : `${before}, ${after}`)
    // A leading or trailing dash has nothing to join, so it just goes.
    .replace(/\s*—\s*/g, " ")
    // Tidy the seams rather than leaving ", ," or a doubled space behind.
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Section labels are not numbered.
 *
 * "01 - Begin somewhere" becomes "Begin somewhere". Same reasoning as the
 * dash: the numbers live in saved copy, so removing them from the shipped
 * defaults alone would not clear them from the live page. Only a leading
 * two-digit index followed by a separator is taken — "24 hours in Dubai"
 * keeps its number, because nothing separates it from the words.
 */
export function stripIndex(value) {
  if (typeof value !== "string") return value;
  return value.replace(/^\s*\d{1,2}\s*[.,:·•|/-]\s+/, "").trim();
}

/** The same rule, applied through a whole content record. */
export function dedashDeep(value) {
  if (typeof value === "string") return dedash(value);
  if (Array.isArray(value)) return value.map(dedashDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dedashDeep(v)]));
  }
  return value;
}
