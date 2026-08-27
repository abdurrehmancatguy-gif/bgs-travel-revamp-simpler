import { PHOTOS } from "./photos.js?v=193";

/**
 * MICE — Meetings, Incentives, Conferences and Exhibitions.
 *
 * The corporate side of the business, and structurally different from the rest
 * of the catalogue: a package or an activity is a single thing you book, while
 * a MICE section is a *family* of services. So the record carries a list of
 * items rather than a price and a duration, and one card stands for a whole
 * section with its items shown inside it.
 *
 * Same contract as the other data files: this is the shipped default, and the
 * admin layers edits over it through js/store.js.
 */
export const MICE_SECTIONS = [
  {
    key: "meetings",
    icon: "meetings",
    name: "Meetings",
    blurb:
      "Rooms, arrivals and everything around them handled, so the only thing your people have to think about is the agenda.",
    items: [
      "Corporate Meetings",
      "Business Meetings",
      "Board Meetings",
      "Sales & Annual Meetings",
    ],
    image: PHOTOS.miceMeetings,
  },
  {
    key: "incentive-travel",
    icon: "incentive",
    name: "Incentive Travel",
    blurb:
      "The trip people actually want to win — planned end to end, with the logistics invisible to everyone but you.",
    items: [
      "Corporate Incentive Trips",
      "Employee Reward Trips",
      "Team-Building Tours",
      "Luxury Group Experiences",
    ],
    image: PHOTOS.miceIncentive,
  },
  {
    key: "conferences",
    icon: "conference",
    name: "Conferences & Conventions",
    blurb:
      "Delegates from a dozen countries, one schedule. Flights, transfers, rooms and the venue itself, coordinated from one desk.",
    items: [
      "International Conferences",
      "Corporate Conferences",
      "Seminars & Workshops",
      "Convention Travel & Management",
    ],
    image: PHOTOS.miceConferences,
  },
  {
    key: "exhibitions",
    icon: "exhibition",
    name: "Exhibitions & Trade Shows",
    blurb:
      "Whether you are exhibiting or attending, the stand and the people reach the hall on time and in one piece.",
    items: [
      "Exhibition Travel",
      "Trade Fair Packages",
      "Exhibitor & Visitor Arrangements",
      "Business Delegation Travel",
    ],
    image: PHOTOS.miceExhibitions,
  },
  {
    key: "corporate-events",
    icon: "corporateEvent",
    name: "Corporate Events",
    blurb:
      "The evenings that get remembered — staged, catered and run, from a product launch to an awards night.",
    items: [
      "Product Launches",
      "Gala Dinners",
      "Award Ceremonies",
      "Networking Events",
      "Corporate Celebrations",
    ],
    image: PHOTOS.miceEvents,
  },
];

/**
 * What BGS handles on any MICE booking, whichever section it falls under.
 * Shown as a strip beneath the sections rather than repeated on every card.
 */
export const MICE_SERVICES = [
  "Flight booking",
  "Hotel accommodation",
  "Airport transfers",
  "Visa assistance",
  "Venue booking",
  "Group transportation",
  "Event registration",
  "Sightseeing",
  "Catering coordination",
  "Complete event management",
];
