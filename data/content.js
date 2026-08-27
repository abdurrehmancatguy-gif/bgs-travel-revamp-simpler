import { PHOTOS } from "./photos.js?v=217";
/**
 * Content for the category pages that is not a package or an activity.
 *
 * Same contract as data/packages.js: this is the shipped default, and the admin
 * layers edits over it through js/store.js. Images use the same Wikimedia
 * Special:FilePath helper so a single swap moves the whole site to BGS's own
 * photography later.
 */

const commons = (file, width = 1600) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    file.replace(/ /g, "_")
  )}?width=${width}`;

/**
 * One entry per place in the Destinations menu. `key` matches the
 * `destinationKey` on packages and activities, which is how a destination page
 * pulls its related trips.
 */
export const DESTINATIONS = [
  {
    key: "uae-dubai",
    name: "UAE & Dubai",
    region: "UAE",
    blurb:
      "Desert, skyline and old trading creek in one city, the easiest place in the world to combine a beach week with a proper adventure.",
    bestTime: "November to March",
    image: PHOTOS.uaeDubai,
  },
  {
    key: "tanzania",
    name: "Tanzania",
    region: "Africa",
    blurb:
      "The Serengeti migration, Ngorongoro Crater and the spice islands of Zanzibar: Africa's most complete safari-and-beach pairing.",
    bestTime: "June to October",
    image: PHOTOS.tanzania,
  },
  {
    key: "south-africa",
    name: "South Africa",
    region: "Africa",
    blurb:
      "Big Five game drives in Kruger, then Table Mountain, the Cape winelands and a coastline that runs two oceans together.",
    bestTime: "May to September",
    image: PHOTOS.southAfricaDest,
  },
  {
    key: "ethiopia",
    name: "Ethiopia",
    region: "Africa",
    blurb:
      "Rock-hewn churches at Lalibela, the highlands, and a coffee culture older than almost anywhere else on earth.",
    bestTime: "October to March",
    image: PHOTOS.ethiopiaDest,
  },
  {
    key: "uganda",
    name: "Uganda",
    region: "Africa",
    blurb:
      "Mountain gorillas in Bwindi's forest, the source of the Nile, and some of the greenest country in East Africa.",
    bestTime: "June to September",
    image: PHOTOS.uganda,
  },
  {
    key: "zambia",
    name: "Zambia",
    region: "Africa",
    blurb:
      "Victoria Falls at full thunder, walking safaris in South Luangwa, and camps far from anyone else.",
    bestTime: "May to October",
    image: PHOTOS.zambia,
  },
  {
    key: "malawi",
    name: "Malawi",
    region: "Africa",
    blurb:
      "A freshwater lake big enough to have its own horizon, quiet highlands, and a reputation for warmth that precedes it.",
    bestTime: "May to October",
    image: PHOTOS.malawi,
  },
  {
    key: "mozambique",
    name: "Mozambique",
    region: "Africa",
    blurb:
      "Indian Ocean archipelagos, Portuguese-era towns and diving that rivals anywhere in the region.",
    bestTime: "May to November",
    image: PHOTOS.mozambique,
  },
  {
    key: "india",
    name: "India",
    region: "Asia",
    blurb:
      "Rajasthan's forts and palaces, the backwaters of the south, and food worth the trip on its own.",
    bestTime: "October to March",
    image: PHOTOS.india,
  },
  {
    key: "pakistan",
    name: "Pakistan",
    region: "Asia",
    blurb:
      "The Karakoram highway, Hunza in autumn, and mountain scenery that stands with anywhere on the planet.",
    bestTime: "April to October",
    image: PHOTOS.pakistan,
  },
  {
    key: "indonesia",
    name: "Indonesia",
    region: "Asia",
    blurb:
      "Bali's temples and rice terraces, volcanoes at sunrise, and thousands of islands beyond the ones everyone knows.",
    bestTime: "April to October",
    image: PHOTOS.indonesia,
  },
  {
    key: "germany",
    name: "Germany",
    region: "Europe & Americas",
    blurb:
      "Christmas markets, castles above the Rhine, and cities that reward slow days as much as long lists.",
    bestTime: "May to September",
    image: PHOTOS.germany,
  },
  {
    key: "united-kingdom",
    name: "United Kingdom",
    region: "Europe & Americas",
    blurb:
      "London in full swing, the Scottish Highlands, and enough coastline and countryside to fill a fortnight.",
    bestTime: "May to September",
    image: PHOTOS.unitedKingdom,
  },
  {
    key: "moldova",
    name: "Moldova",
    region: "Europe & Americas",
    blurb:
      "Underground wine cellars measured in kilometres, monasteries in the hills, and almost no crowds.",
    bestTime: "May to October",
    image: PHOTOS.moldova,
  },
  {
    key: "panama",
    name: "Panama",
    region: "Europe & Americas",
    blurb:
      "The canal, Caribbean islands on one side and the Pacific on the other, and rainforest an hour from the capital.",
    bestTime: "December to April",
    image: PHOTOS.panama,
  },
];

/**
 * Visa services. `name` is what appears in the Visa dropdown and as the search
 * term when that menu item is clicked.
 */
export const VISA_TYPES = [
  {
    key: "dubai-visa",
    name: "Dubai Visa",
    country: "United Arab Emirates",
    processing: "3 to 5 working days",
    validity: "60 days from issue",
    blurb:
      "Tourist and visit visas for the UAE, prepared, submitted and tracked for you, including the paperwork most applications get rejected for.",
    requirements: [
      "Passport valid at least 6 months",
      "Passport-size photograph, white background",
      "Confirmed return ticket",
      "Hotel booking or host details",
    ],
    image: PHOTOS.dubaiVisa,
  },
  {
    key: "saudi-multiple-entry-visa",
    name: "Saudi Multiple Entry Visa",
    country: "Saudi Arabia",
    processing: "5 to 10 working days",
    validity: "1 year, multiple entry",
    blurb:
      "A one-year multiple entry visa for Saudi Arabia, suited to repeat business travel, Umrah and family visits.",
    requirements: [
      "Passport valid at least 6 months",
      "Passport-size photograph, white background",
      "Proof of accommodation",
      "Travel insurance for the period of stay",
    ],
    image: PHOTOS.saudiVisa,
  },
];

/**
 * Headline and intro for each category page. Editable from the admin so the
 * copy can change without touching markup.
 */
export const PAGE_COPY = {
  activities: {
    title: "Activities & Experiences",
    intro:
      "Desert, water, culture and sky: single experiences you can book on their own or fold into a longer trip.",
    notFound: "Couldn\u2019t find your desired activity?",
  },
  packages: {
    title: "Travel Packages",
    intro:
      "Multi-day journeys across Africa, Asia and beyond, planned end to end so every connection is already handled.",
    notFound: "Couldn\u2019t find your desired package?",
  },
  destinations: {
    title: "Destinations",
    intro:
      "Fifteen countries we know well enough to plan around you, from the UAE on your doorstep to the far side of the world.",
    notFound: "Couldn\u2019t find your desired destination?",
  },
  services: {
    title: "Services",
    intro:
      "Flights, stays, transfers and a team on call: the parts of a journey that hold everything else together.",
    notFound: "Couldn\u2019t find your desired service?",
  },
  mice: {
    title: "MICE & Corporate Travel",
    intro:
      "Meetings, incentives, conferences and exhibitions, planned, booked and run by one team, from the first flight to the closing dinner.",
    notFound: "Couldn\u2019t find your desired MICE service?",
  },
  visa: {
    title: "Visa Services",
    intro:
      "Applications prepared, submitted and tracked, so the paperwork is never the reason a trip does not happen.",
    notFound: "Couldn\u2019t find your desired visa?",
  },
};
