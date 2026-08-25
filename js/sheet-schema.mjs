/**
 * What a spreadsheet column means.
 *
 * Each collection lists the fields an upload may set, the type to coerce to,
 * and every header spelling that maps to it. The aliases cover two things at
 * once: the headers our own export writes, and the ones in BGS's existing rate
 * sheet, so their current file works without being reformatted first.
 *
 * A field absent from this table cannot be set by a spreadsheet at all. That is
 * deliberate — `image`, `icon`, `id` and `slug` are preserved from the record
 * already on the site, so an upload cannot wipe the photographs.
 */

/**
 * Vendor cost. The rate sheet carries "BUYING PRICE IN AED - VENDOR" beside the
 * selling price, and it must never reach a browser. Matching headers are
 * dropped during parse and asserted absent again before anything is saved.
 */
export const COST_HEADER = /buying|cost\s*price|vendor|purchase|margin|profit|wholesale/i;

const norm = (s) => String(s ?? "")
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")   // visaType -> visa Type
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Shared shapes, so packages and activities do not drift apart. */
const PRICED = [
  { field: "price", type: "number", aliases: ["price", "selling price", "selling price in aed", "selling price in aed bgs", "package price", "package price bgs", "from",
      // A sheet that quotes two turnarounds labels the slower one; a sheet that
      // quotes one leaves it bare. Both mean the same column.
      "normal price", "normal selling price", "normal selling price in aed", "normal selling price in aed bgs",
      "standard price", "standard selling price", "regular price"] },
  { field: "currency", type: "text", aliases: ["currency"] },
  { field: "priceUnit", type: "text", aliases: ["price unit", "per"] },
];

/**
 * The faster turnaround's rate, spliced in beside the price it varies.
 *
 * Visa only — express is a processing tier, which is a visa idea; a package has
 * no faster version of itself. A column the importer accepts and no page ever
 * renders would be a silent hole for somebody's data to fall into.
 *
 * Matching is exact on the normalised header, so this cannot collide with the
 * plain "selling price" column, and COST_HEADER refuses anything like
 * "EXPRESS BUYING PRICE IN AED - VENDOR" before aliases are consulted at all.
 */
const EXPRESS_PRICE = { field: "expressPrice", type: "number",
  aliases: ["express price", "express selling price", "express selling price in aed",
            "express selling price in aed bgs", "urgent price", "urgent selling price",
            "express fee", "express charge"] };

/** PRICED with the express rate immediately after price. This list is also the
 *  column order of the template and both exports. */
const PRICED_WITH_EXPRESS =
  PRICED.flatMap((col) => (col.field === "price" ? [col, EXPRESS_PRICE] : [col]));

export const SHEETS = {
  visa: {
    tab: "Visa", identity: "name", label: "Visa Services",
    columns: [
      { field: "name", type: "text", aliases: ["name", "visa", "visa name", "title", "countries", "country name"] },
      { field: "country", type: "text", aliases: ["country", "issuing country", "destination country"] },
      { field: "category", type: "text", aliases: ["category", "visa category", "type of visa"] },
      { field: "visaType", type: "text", aliases: ["visa type", "entry", "entry type"] },
      { field: "processing", type: "text", aliases: ["processing", "processing time", "lead time"] },
      { field: "validity", type: "text", aliases: ["validity", "valid for"] },
      ...PRICED_WITH_EXPRESS,
      { field: "blurb", type: "textarea", aliases: ["description", "blurb", "summary", "details"] },
      { field: "fullDescription", type: "textarea", aliases: ["full description", "notes", "important notes", "process"] },
      { field: "requirements", type: "list", aliases: ["requirements", "required documents", "documents", "what you'll need", "what you will need"] },
    ],
    // A sheet with only COUNTRIES gives a name but no country; fill it from the
    // name rather than leaving the card's kicker blank.
    normalise(rec) {
      if (!rec.country && rec.name) rec.country = rec.name.replace(/\s*visa\s*$/i, "").trim();
      if (rec.name && !/visa/i.test(rec.name)) rec.name = `${rec.name} Visa`;
      if (rec.price && !rec.currency) rec.currency = "AED";
      if (rec.price && !rec.priceUnit) rec.priceUnit = "per applicant";
      return rec;
    },
  },

  packages: {
    tab: "Packages", identity: "title", label: "Travel Packages",
    columns: [
      { field: "title", type: "text", aliases: ["title", "name", "package", "package name"] },
      { field: "category", type: "text", aliases: ["category", "type"] },
      { field: "region", type: "text", aliases: ["region"] },
      { field: "destination", type: "text", aliases: ["destination", "country", "where"] },
      { field: "duration", type: "text", aliases: ["duration", "nights", "days"] },
      ...PRICED,
      { field: "tags", type: "list", aliases: ["tags", "themes"] },
      { field: "shortDescription", type: "textarea", aliases: ["description", "short description", "summary"] },
      { field: "fullDescription", type: "textarea", aliases: ["full description", "details", "notes"] },
      { field: "highlights", type: "list", aliases: ["highlights", "inclusions summary"] },
      { field: "included", type: "list", aliases: ["included", "what's included", "whats included"] },
      { field: "requirements", type: "list", aliases: ["requirements", "required documents", "documents"] },
    ],
    normalise(rec) {
      rec.kind = "package";
      if (rec.price && !rec.currency) rec.currency = "AED";
      if (rec.price && !rec.priceUnit) rec.priceUnit = "per person";
      return rec;
    },
  },

  activities: {
    tab: "Activities", identity: "title", label: "Activities & Experiences",
    columns: [
      { field: "title", type: "text", aliases: ["title", "name", "activity", "activity name"] },
      { field: "category", type: "text", aliases: ["category", "type"] },
      { field: "destination", type: "text", aliases: ["destination", "where", "city"] },
      { field: "region", type: "text", aliases: ["region"] },
      { field: "duration", type: "text", aliases: ["duration", "length"] },
      ...PRICED,
      { field: "tags", type: "list", aliases: ["tags", "themes"] },
      { field: "shortDescription", type: "textarea", aliases: ["description", "short description", "summary"] },
      { field: "fullDescription", type: "textarea", aliases: ["full description", "details", "notes"] },
      { field: "highlights", type: "list", aliases: ["highlights"] },
      { field: "included", type: "list", aliases: ["included", "what's included", "whats included"] },
      { field: "requirements", type: "list", aliases: ["requirements", "what to bring", "documents"] },
    ],
    normalise(rec) {
      rec.kind = "activity";
      if (rec.price && !rec.currency) rec.currency = "AED";
      if (rec.price && !rec.priceUnit) rec.priceUnit = "per person";
      return rec;
    },
  },

  destinations: {
    tab: "Destinations", identity: "name", label: "Destinations",
    columns: [
      { field: "name", type: "text", aliases: ["name", "destination", "place", "country"] },
      { field: "region", type: "text", aliases: ["region", "continent"] },
      { field: "bestTime", type: "text", aliases: ["best time", "best time to go", "season"] },
      { field: "blurb", type: "textarea", aliases: ["description", "blurb", "summary"] },
      { field: "fullDescription", type: "textarea", aliases: ["full description", "details"] },
      { field: "highlights", type: "list", aliases: ["highlights", "things to do"] },
      { field: "requirements", type: "list", aliases: ["requirements", "entry requirements", "documents"] },
    ],
  },

  services: {
    tab: "Services", identity: "label", label: "Services",
    columns: [
      { field: "label", type: "text", aliases: ["name", "service", "label", "title"] },
      { field: "blurb", type: "textarea", aliases: ["description", "blurb", "summary"] },
      { field: "fullDescription", type: "textarea", aliases: ["full description", "details"] },
      { field: "included", type: "list", aliases: ["included", "what's included", "whats included"] },
      { field: "requirements", type: "list", aliases: ["requirements", "documents"] },
    ],
  },

  mice: {
    tab: "MICE", identity: "name", label: "MICE & Corporate Travel",
    columns: [
      { field: "name", type: "text", aliases: ["name", "section", "title"] },
      { field: "blurb", type: "textarea", aliases: ["description", "blurb", "summary"] },
      { field: "fullDescription", type: "textarea", aliases: ["full description", "details"] },
      { field: "items", type: "list", aliases: ["items", "services", "what this covers", "sub categories", "subcategories"] },
      { field: "requirements", type: "list", aliases: ["requirements", "documents"] },
    ],
  },
};

/** Which collection a worksheet name refers to, or null if we do not know it. */
export function collectionForTab(tabName) {
  const wanted = norm(tabName);
  for (const [key, spec] of Object.entries(SHEETS)) {
    if (wanted === norm(spec.tab) || wanted === norm(key) || wanted === norm(spec.label)) return key;
  }
  return null;
}

/** Which field a header refers to, or null when it is unrecognised or a cost. */
export function fieldForHeader(header, collection) {
  if (COST_HEADER.test(header)) return null;
  const wanted = norm(header);
  if (!wanted) return null;
  for (const col of SHEETS[collection].columns) {
    // The field name is always an alias for itself, so anything this app
    // exports can be read back by it.
    if (norm(col.field) === wanted) return col;
    if (col.aliases.some((a) => norm(a) === wanted)) return col;
  }
  return null;
}

/**
 * Which collection a set of headers looks like, for a sheet whose name tells
 * us nothing. Scored by how many headers each collection recognises, and the
 * identity column is required — without a name there is nothing to match rows
 * on, so a confident guess is impossible and a wrong one is worse than none.
 */
export function inferCollection(headers) {
  let best = null;
  for (const [key, spec] of Object.entries(SHEETS)) {
    const matched = headers.filter((h) => fieldForHeader(h, key));
    const hasIdentity = matched.some((h) => fieldForHeader(h, key).field === spec.identity);
    if (!hasIdentity) continue;
    if (!best || matched.length > best.score) best = { key, score: matched.length };
  }
  return best?.key ?? null;
}

/** Fields a spreadsheet never sets; carried over from the existing record. */
export const PRESERVED = ["image", "icon", "id", "slug", "key", "kind",
                          "rating", "reviewCount", "destinationKey"];
