/**
 * The six service master pages.
 *
 * SERVICES (data/navigation.js) says what a service IS in one line — that is
 * what the cards and the menus show. This says what the page for it holds:
 * a longer opening, the things we actually do under that heading, and which
 * catalogue to put in front of the visitor at the bottom.
 *
 * Why a separate collection rather than more fields on SERVICES: the live
 * `services` document in Firestore was written before these fields existed,
 * and a stored document replaces the shipped default wholesale — so anything
 * added to SERVICES now would be missing on the live site until someone
 * re-saved every record. A new collection has no stored document yet, so
 * these defaults apply everywhere until the admin edits them.
 *
 * Every line below is drawn from what the site already says about itself.
 * Nothing here claims a capability, a price or a number that was not already
 * on the page — offerings are the service's own blurb, unpacked.
 */
export const SERVICE_PAGES = [
  {
    key: "visa",
    label: "Visa Services",
    intro:
      "Applications prepared, submitted and tracked, so the paperwork is never the reason a trip does not happen. Tell us the passport and the destination and we will tell you what it takes.",
    offerings: [
      "Tourist visas | Short-stay entry for a holiday, prepared and tracked to the decision.",
      "Transit visas | For a layover long enough to leave the airport, timed around your flights.",
      "Visit visas | Longer stays with family or friends, including the sponsor paperwork.",
      "Prepared and tracked | We fill the forms, submit them and follow the file — you are told what is needed and when it moves.",
    ],
    catalogue: "visa",
    catalogueHeading: "Visas we file",
    catalogueMore: "See every visa service",
  },
  {
    key: "flights",
    label: "Flights",
    intro:
      "Fares held, routings compared and every connection checked before you book — so the ticket fits the trip rather than the trip bending around the ticket.",
    offerings: [
      "Fares held | A seat kept while the rest of the trip is decided.",
      "Routings compared | More than one way to reach the same place, priced side by side.",
      "Connections checked | Layovers long enough to make, and the visa rules that go with them.",
    ],
    catalogue: "destinations",
    catalogueHeading: "Where we send people",
    catalogueMore: "See every destination",
  },
  {
    key: "hotels",
    label: "Hotels & Stays",
    intro:
      "City hotels, desert camps, safari lodges and beach resorts, matched to the trip you are actually taking rather than to a star rating.",
    offerings: [
      "City hotels | In the district that suits the reason you are travelling.",
      "Desert camps | Nights out in the dunes, with the transfer arranged around them.",
      "Safari lodges | Inside or beside the reserve, chosen for the season you are going.",
      "Beach resorts | Coast and island stays, for the part of the trip that is meant to be still.",
    ],
    catalogue: "packages",
    catalogueHeading: "Trips your stay can sit inside",
    catalogueMore: "See every package",
  },
  {
    key: "transport",
    label: "Transport & Fleet",
    intro:
      "Airport transfers, private drivers and a fleet sized to your group, anywhere in the UAE — booked to the flight, not to the clock.",
    offerings: [
      "Airport transfers | Met on arrival, tracked against the flight so a delay is not your problem.",
      "Private drivers | For a day, an evening or the length of the trip.",
      "Group fleet | Sized to the party, from a car to a coach.",
    ],
    catalogue: "",
    catalogueHeading: "",
    catalogueMore: "",
  },
  {
    key: "concierge",
    label: "Concierge",
    intro:
      "One team on call through the whole trip, from the first idea to the journey home — the same people who planned it are the people who answer while you are away.",
    offerings: [
      "Planning | The itinerary built around what you actually want out of the trip.",
      "Bookings | Visas, flights, stays and transfers arranged together rather than piece by piece.",
      "While you are away | One number to reach a person when something changes mid-trip.",
    ],
    catalogue: "",
    catalogueHeading: "",
    catalogueMore: "",
  },
  {
    key: "activities",
    label: "Activities & Excursions",
    intro:
      "Desert, water, cultural and family experiences, booked around the rest of your itinerary so nothing collides with a flight or a check-in.",
    offerings: [
      "Desert | Dunes, camps and the drive out to them.",
      "Water | Coast and creek, from a dhow evening to a day on the water.",
      "Cultural | The parts of the city and the country worth slowing down for.",
      "Family | Days out that work for the age range you are actually travelling with.",
    ],
    catalogue: "activities",
    catalogueHeading: "Experiences we book",
    catalogueMore: "See every activity",
  },
];
