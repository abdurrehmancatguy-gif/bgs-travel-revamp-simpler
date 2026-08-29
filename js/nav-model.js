import { getCollection } from "./store.js?v=219";
import { UTILITY_NAV } from "../data/navigation.js?v=219";

/**
 * The menus, built from the content rather than written alongside it.
 *
 * Every dropdown here is derived from the same collections the pages render,
 * so anything added in the admin — a new visa type, another MICE section, a
 * destination in a region that did not exist before — appears in the header and
 * the drawer without anybody editing a second list. That was the actual bug in
 * the hand-written version: Packages offered Europe, Luxury and Family, none of
 * which matched a single package, because the filter list and the catalogue had
 * drifted apart with nothing to hold them together.
 *
 * This module reads the store, so it must not live in data/navigation.js —
 * store.js imports that file for its shipped defaults, and the two importing
 * each other is a cycle.
 */

/**
 * `open` marks an item that names one record rather than a filter. Those land
 * on the page with that record's panel already open; "All Packages" or "Luxury"
 * match many records and cannot, so they only pre-fill the search.
 */
const toPage = (page, q = "", open = false) => ({ kind: "page", page, q, open });

/** Groups records under a field, keeping the order the records arrived in. */
function groupBy(items, field) {
  const order = [];
  const buckets = new Map();
  for (const item of items) {
    const key = item[field] || "Other";
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key).push(item);
  }
  return order.map((label) => ({ label, items: buckets.get(label) }));
}

export function buildPrimaryNav() {
  const visa = getCollection("visa");
  const mice = getCollection("mice");
  const packages = getCollection("packages");
  const activities = getCollection("activities");
  const destinations = getCollection("destinations");
  const services = getCollection("services");

  return [
    {
      id: "visa",
      label: "Visa",
      kind: "list",
      page: "visa",
      items: [
        { label: "All Visa Services", action: toPage("visa") },
        ...visa.map((v) => ({ label: v.name, action: toPage("visa", v.name, true) })),
      ],
    },
    {
      id: "mice",
      label: "MICE",
      kind: "list",
      page: "mice",
      items: [
        { label: "All MICE Services", action: toPage("mice") },
        ...mice.map((m) => ({ label: m.name, action: toPage("mice", m.name, true) })),
      ],
    },
    {
      id: "packages",
      label: "Packages",
      kind: "groups",
      page: "packages",
      // Grouped by region rather than listed flat: it keeps the regional entry
      // points the old filter list gave, while every leaf is now a real package
      // that opens its own panel. The themes it used to offer are chips on the
      // page, so nothing is lost by dropping them from here.
      groups: groupBy(packages, "region").map((group) => ({
        label: group.label,
        items: group.items.map((p) => ({
          label: p.title,
          action: toPage("packages", p.title, true),
        })),
      })),
    },
    {
      id: "activities",
      label: "Activities",
      kind: "list",
      page: "activities",
      // Flat, not grouped: there are about as many categories as activities, so
      // grouping would produce a column of one-item headings.
      items: [
        { label: "All Activities", action: toPage("activities") },
        ...activities.map((a) => ({
          label: a.title,
          action: toPage("activities", a.title, true),
        })),
      ],
    },
    {
      id: "services",
      label: "Services",
      kind: "services",
      page: "services",
      // Visa has its own menu and Activities its own page, so neither belongs
      // in this list. Matched by key, so reordering the collection cannot
      // quietly change which ones appear.
      items: services
        .filter((s) => s.key !== "visa" && s.key !== "activities")
        .map((s) => ({
          label: s.label,
          icon: s.icon,
          action: toPage("services", s.label, true),
        })),
    },
    {
      id: "destinations",
      label: "Destinations",
      kind: "groups",
      page: "destinations",
      groups: groupBy(destinations, "region").map((group) => ({
        label: group.label,
        // Destinations search by place name, so the label is the query.
        items: group.items.map((d) => ({
          label: d.name,
          action: toPage("destinations", d.name, true),
        })),
      })),
    },
  ];
}

/**
 * Everything, because below 760px the header row is gone and the icon is the
 * only way to the categories.
 */
export const buildDrawerMenus = () => [...buildPrimaryNav(), UTILITY_NAV];
