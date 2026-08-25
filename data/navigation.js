/**
 * Navigation content and what each item does. Every entry carries an `action`
 * so nothing in the menus is a dead `#` link.
 *
 * Action shapes:
 *   { kind: "page", page, q }                         open a category page with
 *       its search box pre-filled with `q` and already filtered. This is how
 *       every dropdown item behaves: pick "Desert" and you land on Activities
 *       with "Desert" searched.
 *   { kind: "scene", scene }                          scroll to a home scene.
 *   { kind: "service", service }                      scroll to Services and
 *       select that service panel.
 *   { kind: "whatsapp", intent }                      open a WhatsApp enquiry.
 */

/** Scroll offsets (px into the pinned cinematic section) for each scene. */
export const SCENES = {
  intro: 0,
  promise: 1180,
  discovery: 2320,
  packages: 3150,
  services: 4200,
};

export const DESTINATION_GROUPS = [
  {
    label: "UAE",
    items: [{ label: "UAE & Dubai", value: "uae-dubai" }],
  },
  {
    label: "Africa",
    items: [
      { label: "Tanzania", value: "tanzania" },
      { label: "South Africa", value: "south-africa" },
      { label: "Ethiopia", value: "ethiopia" },
      { label: "Uganda", value: "uganda" },
      { label: "Zambia", value: "zambia" },
      { label: "Malawi", value: "malawi" },
      { label: "Mozambique", value: "mozambique" },
    ],
  },
  {
    label: "Asia",
    items: [
      { label: "India", value: "india" },
      { label: "Pakistan", value: "pakistan" },
      { label: "Indonesia", value: "indonesia" },
    ],
  },
  {
    label: "Europe & Americas",
    items: [
      { label: "Germany", value: "germany" },
      { label: "United Kingdom", value: "united-kingdom" },
      { label: "Moldova", value: "moldova" },
      { label: "Panama", value: "panama" },
    ],
  },
];

export const SERVICES = [
  {
    key: "visa",
    label: "Visa Services",
    icon: "visa",
    image: "https://images.pexels.com/photos/4922356/pexels-photo-4922356.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    blurb:
      "Tourist, transit and visit visas for the UAE and beyond, prepared and tracked for you.",
  },
  {
    key: "flights",
    label: "Flights",
    icon: "flights",
    image: "https://images.pexels.com/photos/14400667/pexels-photo-14400667.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    blurb:
      "Fares held, routings compared and every connection checked before you book.",
  },
  {
    key: "hotels",
    label: "Hotels & Stays",
    icon: "hotels",
    image: "https://images.pexels.com/photos/2736384/pexels-photo-2736384.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    blurb:
      "City hotels, desert camps, safari lodges and beach resorts, matched to your trip.",
  },
  {
    key: "transport",
    label: "Transport & Fleet",
    icon: "transport",
    image: "https://images.pexels.com/photos/28284095/pexels-photo-28284095.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    blurb:
      "Airport transfers, private drivers and a fleet sized to your group anywhere in the UAE.",
  },
  {
    key: "concierge",
    label: "Concierge",
    icon: "concierge",
    image: "https://images.pexels.com/photos/14036251/pexels-photo-14036251.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    blurb:
      "One team on call through the whole trip, from the first idea to the journey home.",
  },
  {
    key: "activities",
    label: "Activities & Excursions",
    icon: "activities",
    image: "https://images.pexels.com/photos/1453097/pexels-photo-1453097.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    blurb:
      "Desert, water, cultural and family experiences, booked around the rest of your itinerary.",
  },
];

/** Package regions and themes, and the activity categories. */
const PACKAGE_FILTERS = ["Africa", "Asia", "Europe", "Luxury", "Family", "Adventure"];
const ACTIVITY_FILTERS = [
  "Desert",
  "Water",
  "Sightseeing",
  "Luxury",
  "Family",
  "Adventure",
  "Cultural",
];

const toPage = (page, q = "") => ({ kind: "page", page, q });

/** The primary menus, centred in the header. */
export const PRIMARY_NAV = [
  {
    id: "visa",
    label: "Visa",
    kind: "list",
    page: "visa",
    items: [
      { label: "All Visa Services", action: toPage("visa") },
      { label: "Dubai Visa", action: toPage("visa", "Dubai Visa") },
      {
        label: "Saudi Multiple Entry Visa",
        action: toPage("visa", "Saudi Multiple Entry Visa"),
      },
    ],
  },
  {
    // MICE sections are families of services, so the dropdown lists the five
    // sections and the page shows what each one covers.
    id: "mice",
    label: "MICE",
    kind: "list",
    page: "mice",
    items: [
      { label: "All MICE Services", action: toPage("mice") },
      { label: "Meetings", action: toPage("mice", "Meetings") },
      { label: "Incentive Travel", action: toPage("mice", "Incentive Travel") },
      {
        label: "Conferences & Conventions",
        action: toPage("mice", "Conferences & Conventions"),
      },
      {
        label: "Exhibitions & Trade Shows",
        action: toPage("mice", "Exhibitions & Trade Shows"),
      },
      { label: "Corporate Events", action: toPage("mice", "Corporate Events") },
    ],
  },
  {
    id: "packages",
    label: "Packages",
    kind: "list",
    page: "packages",
    items: [
      { label: "All Packages", action: toPage("packages") },
      ...PACKAGE_FILTERS.map((label) => ({
        label,
        action: toPage("packages", label),
      })),
    ],
  },
  {
    id: "activities",
    label: "Activities",
    kind: "list",
    page: "activities",
    items: [
      { label: "All Activities", action: toPage("activities") },
      ...ACTIVITY_FILTERS.map((label) => ({
        label,
        action: toPage("activities", label),
      })),
    ],
  },
  {
    id: "services",
    label: "Services",
    kind: "services",
    page: "services",
    // Visa has its own menu and Activities has its own page, so neither belongs
    // in this list. Named rather than sliced by position, so reordering
    // SERVICES cannot quietly change which ones appear here.
    items: SERVICES.filter(
      (service) => service.key !== "visa" && service.key !== "activities"
    ).map((service) => ({
      label: service.label,
      icon: service.icon,
      action: toPage("services", service.label),
    })),
  },
  {
    id: "destinations",
    label: "Destinations",
    kind: "groups",
    page: "destinations",
    groups: DESTINATION_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({
        label: item.label,
        // Destinations search by place name, so the label is the query.
        action: toPage("destinations", item.label),
      })),
    })),
  },
];

/**
 * About and Contact. No longer a header menu — MICE took that slot, and these
 * two live behind the menu icon on the right instead. Still exported because
 * the drawer renders them.
 */
export const UTILITY_NAV = {
  id: "more",
  label: "More",
  kind: "list",
  items: [
    { label: "About", action: { kind: "scene", scene: "promise" } },
    { label: "Contact", action: { kind: "scene", scene: "services" } },
  ],
};

export const ALL_MENUS = [...PRIMARY_NAV, UTILITY_NAV];

/**
 * Everything, because below 760px the header row is gone and the icon is the
 * only way to the categories. On a wider screen the drawer then repeats what
 * the header already shows, which is the cheaper of the two mistakes: the menus
 * have to be reachable at the width where nothing else offers them.
 */
export const DRAWER_MENUS = ALL_MENUS;
