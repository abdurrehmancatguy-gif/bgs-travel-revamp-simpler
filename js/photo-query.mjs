/**
 * Turns a record's name into something worth searching a photo library for.
 *
 * "Saudi Multiple Entry Visa" is a product name, not a picture. Searched
 * literally it returns passport documents and rubber stamps, which is why
 * automatic photographs looked wrong: the words that make a name specific to
 * BGS — visa, entry, package, circuit — are exactly the words that stop it
 * describing a place.
 *
 * So the product vocabulary is stripped and what remains is almost always the
 * place: Saudi, Dubai, Bali, Ethiopia. A hint per collection then steers the
 * result towards the recognisable view of it rather than a hotel lobby.
 */

/* Words that describe what BGS sells rather than where it is. */
const NOISE = new RegExp(
  "\\b(" + [
    "e-?visas?", "visas?", "sticker", "multiple", "single", "entry", "entries",
    "business", "tourist", "visitor", "visit", "transit", "residence",
    "package[s]?", "tour[s]?", "trip[s]?", "holiday[s]?", "circuit", "extension",
    "highlights", "discovery", "explorer", "classic", "royal", "heritage",
    "support", "application", "processing", "service[s]?", "assistance",
    "by air", "by bus", "\\d+\\s*(day|night)s?",
  ].join("|") + ")\\b",
  "gi"
);

/** What kind of picture each collection wants behind its cards. */
const HINT = {
  visa: "landmark",
  destinations: "landmark",
  packages: "landscape",
  activities: "",
  mice: "conference",
  services: "travel",
};

/**
 * @param {string} name       the record's title, as typed in the admin
 * @param {string} collection which collection it belongs to
 * @returns {string} a query for the stock-image function
 */
export function photoQuery(name, collection = "") {
  const raw = String(name ?? "").trim();
  if (!raw) return "";

  const stripped = raw
    // A subtitle after a colon or dash names the itinerary, not the place.
    .split(/[:(–—]/)[0]
    .replace(NOISE, " ")
    .replace(/[+,&/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Everything was product vocabulary — search the name itself rather than
  // sending an empty query.
  const place = (stripped || raw).split(" ").slice(0, 3).join(" ");
  return [place, HINT[collection] ?? ""].filter(Boolean).join(" ").trim();
}
