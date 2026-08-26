/**
 * The homepage's own editable bits.
 *
 * These were hardcoded in index.html, which meant the three pills under the
 * headline — the most prominent links on the site — were the only content BGS
 * could not change without editing markup. They live here so the store can
 * layer admin edits over them like everything else.
 */

/**
 * The pills beneath the hero copy.
 *
 * `page` is which section to land on. `query` names one record on that page;
 * when it matches, that record's panel opens on arrival rather than the
 * visitor being dropped on a filtered list to find it again. Leave `query`
 * empty to land on the whole section, and leave `page` empty for a
 * tailor-made WhatsApp enquiry.
 *
 * The query has to match the record's title as the catalogue spells it, which
 * is why these read "Saudi Multiple Entry Visa" and not "Saudi Multiple Visa"
 * the way the labels do. The label is what a visitor reads; the query is what
 * the page looks up.
 */
export const HOME_PILLS = [
  { collection: "visa", name: "Saudi Multiple Entry Visa", label: "Saudi Multiple Visa" },
  { collection: "visa", name: "Schengen Visa" },
  { page: "mice", label: "MICE" },
];

/**
 * What a pill actually points at.
 *
 * Two shapes, because a pill does two jobs. Most name one record — a visa, a
 * package — and land on its panel; `collection` and `name` reference it the same
 * way HOME_CARDS does, so the pill follows the record rather than repeating it.
 * A few name a whole section instead, like MICE, and carry `page` on its own.
 *
 * `label` is optional and only for when the record's own name is too long for a
 * button: the pill reads "Saudi Multiple Visa" while pointing at "Saudi Multiple
 * Entry Visa", which is what the catalogue calls it.
 *
 * The older { label, page, query } shape still resolves, so pills written before
 * this keep working without a migration.
 *
 * @param {object}   pill
 * @param {Function} lookup (collection) => that collection's records
 */
export function resolvePill(pill, lookup = () => []) {
  if (!pill) return null;

  // A whole section, or the pre-reference shape.
  if (!pill.collection) {
    const query = pill.query ?? "";
    return {
      label: pill.label ?? query,
      page: pill.page ?? "",
      query,
      open: Boolean(query),
      missing: false,
    };
  }

  const norm = (v) => String(v ?? "").trim().toLowerCase();
  const key = PILL_TITLE_KEY[pill.collection] ?? "title";
  const record = (lookup(pill.collection) ?? [])
    .find((item) => norm(item[key]) === norm(pill.name));

  return {
    label: pill.label || pill.name || "",
    // Collection names and page names are the same word throughout the site,
    // so visa -> visa.html and packages -> packages.html without a table.
    page: pill.collection,
    query: record ? record[key] : pill.name,
    open: true,
    // Renaming the record leaves the pill pointing at nothing. Say so in the
    // admin rather than shipping a button that lands on an empty search.
    missing: !record,
  };
}

/** Duplicated from data/packages.js rather than imported: store.js loads this
 *  file for its defaults, and reaching back into packages.js from here would
 *  make that a cycle. Six words, and the site has no seventh collection. */
const PILL_TITLE_KEY = {
  packages: "title", activities: "title", visa: "name",
  destinations: "name", services: "label", mice: "name",
};

/**
 * The cards in the homepage carousel, in order.
 *
 * References rather than copies: each entry names a collection and a record, and
 * the carousel looks the live record up when it renders. A card therefore shows
 * the same title, photograph and detail as the record's own page, and editing it
 * in one place changes both — which is the point, because a visa quoted at two
 * prices on two pages is worse than a visa quoted on one.
 *
 * An ordered list rather than a flag on each record, because the row is mixed:
 * a flag can say "show this" but not "show this third, after two visas", and
 * flags live on the records so they cannot order across two collections at all.
 *
 * `name` matches the record's own title field — name for a visa, title for a
 * package. An entry that matches nothing is skipped rather than rendered blank,
 * so renaming a visa quietly drops it from the homepage instead of leaving a
 * card with no words on it.
 */
export const HOME_CARDS = [
  { collection: "visa", name: "Saudi Multiple Entry Visa" },
  { collection: "visa", name: "Schengen Visa" },
  { collection: "visa", name: "China Business Visa" },
  { collection: "packages", name: "Ethiopia Historical Circuit: Lalibela + Addis" },
  { collection: "packages", name: "Bali Discovery: Temples, Rice Terraces + Beaches" },
  { collection: "packages", name: "Rajasthan Royal Heritage Tour" },
];

/**
 * Every line of text the homepage speaks, editable in the admin under
 * Homepage → Text. The site never hardcodes these strings anywhere else: the
 * build writes them into the HTML for crawlers and js/home.js re-applies them
 * live, so an edit lands everywhere at once.
 *
 * tickerPhrases is the human half of the moving badge strip — the counted
 * halves (visa services, destinations) are computed from the catalogue and
 * cannot be typed, so they cannot go stale or be invented.
 */
export const HOME_COPY = {
  eyebrow: "Dubai, UAE — travel & tourism",
  titleA: "Consider your trip",
  titleB: "halfway planned.",
  subtitle: "Visas, flights, stays and journeys built around you — one team handles the paperwork and the planning, from the first idea to the trip home.",
  chatLabel: "Chat on WhatsApp",
  browseLabel: "Browse visa services",
  formTitle: "Where do you want to go?",
  formSub: "Tell us the two things that matter — we take it from there on WhatsApp.",
  formButton: "Start on WhatsApp",
  formNote: "Opens a WhatsApp chat with our team — nothing is stored on this site.",
  journeysEyebrow: "01 — Begin somewhere",
  journeysHeading: "Chosen journeys",
  journeysMore: "View all packages",
  servicesEyebrow: "02 — Every detail",
  servicesHeading: "Handled by one team",
  servicesMore: "All services",
  ctaEyebrow: "03 — Say the word",
  ctaA: "The world is waiting.",
  ctaB: "Let\u2019s take you there.",
  planLabel: "Plan a trip on WhatsApp",
  ctaBrowseLabel: "Browse destinations",
  /* The entire moving strip, in order. {visas} and {destinations} expand to
     live catalogue counts — so every pill is editable, but a number can only
     ever be counted, never typed. A line whose count is zero is dropped. */
  payLabel: "We accept",
  payNote: "as well",
  /* The serif marquee of place names. Empty means automatic — every name in
     the Destinations catalogue; put names here (one per line in the admin) to
     show exactly those instead. */
  marqueeNames: [],
  marqueeNote: "See you in Arabian Travel Mart",
  bandA: "From anywhere",
  bandB: "to everywhere.",
  faqEyebrow: "04 \u2014 Questions",
  faqHeading: "Asked often",
  /* One per line as "Question | Answer" \u2014 the pipe splits them. Also fed to
     search engines as FAQPage structured data by the build. */
  faq: [
    "How do I start a visa application? | Send us your destination on WhatsApp \u2014 we reply with the exact document list and the price before you commit to anything.",
    "How long does processing take? | It depends on the country: every visa card lists its turnaround, and we confirm current timings before you pay.",
    "Do you handle flights and hotels too? | Yes \u2014 flights, stays, transfers and full itineraries are arranged by the same team that files your visa.",
    "How do payments work? | We accept Tabby and Tamara as well as the usual methods, and nothing is charged until you\u2019ve confirmed the plan with our team.",
    "Where are you based? | Dubai, UAE \u2014 and we plan journeys worldwide.",
  ],
  cformEyebrow: "05 \u2014 Or just ask",
  cformTitle: "Tell us what you need",
  cformSub: "One message \u2014 a person replies on WhatsApp.",
  cformButton: "Send on WhatsApp",
  cformNote: "Opens a WhatsApp chat with our team \u2014 nothing is stored on this site.",
  tickerPhrases: [
    "{visas} visa services",
    "{destinations} destinations",
    "One team, end to end",
    "Dubai, UAE",
  ],
};
