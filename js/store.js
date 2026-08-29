import { ACTIVITIES, PACKAGES } from "../data/packages.js?v=218";
import { DESTINATIONS, VISA_TYPES, PAGE_COPY } from "../data/content.js?v=218";
import { MICE_SECTIONS } from "../data/mice.js?v=218";
import { SERVICES } from "../data/navigation.js?v=218";
import { HOME_PILLS, HOME_CARDS, HOME_COPY } from "../data/home.js?v=218";
import { SERVICE_PAGES } from "../data/service-pages.js?v=218";
import { dedashDeep } from "../utils/text.js?v=218";
import { cloudEnabled, watchContent, pushCollection, removeCollection } from "./cloud.js?v=218";

/**
 * The single door between the site's content and where that content lives.
 *
 * Content is the bundled `data/*.js` files with any edits layered over them.
 * Those edits live in localStorage and, once a Firebase project is configured,
 * in Firestore as well.
 *
 * localStorage is not bypassed when the cloud is on — it becomes the cache the
 * page renders from. That is what keeps getCollection() synchronous: a page
 * paints immediately from the last known content instead of waiting on a
 * network round trip, and the Firestore snapshot writes through the same
 * overlay a moment later, firing the same subscribers an admin save does. A
 * page therefore does not know or care where its content came from.
 *
 * Edits are stored as a full replacement list per collection, not as a diff.
 * Diffs are smaller but they rot the moment the shipped defaults change, and a
 * travel catalogue is small enough that clarity wins.
 */

const STORAGE_KEY = "bgs.content.v1";

/** The shipped content. Restoring a collection means coming back to this. */
const DEFAULTS = {
  activities: ACTIVITIES,
  packages: PACKAGES,
  destinations: DESTINATIONS,
  services: SERVICES,
  servicePages: SERVICE_PAGES,
  visa: VISA_TYPES,
  mice: MICE_SECTIONS,
  homePills: HOME_PILLS,
  homeCards: HOME_CARDS,
  homeCopy: HOME_COPY,
  copy: PAGE_COPY,
};

export const COLLECTIONS = Object.keys(DEFAULTS);

const listeners = new Set();

/**
 * Told when a write reaches localStorage but is refused by Firestore.
 *
 * This needs saying out loud, because the failure does not look like one. The
 * SDK applies a write to its local cache immediately, so the edit lands and the
 * page re-renders with it; the server then rejects it and the rollback arrives
 * as an ordinary snapshot, which this store applies as faithfully as any other.
 * The edit therefore appears, holds for a second or so, and vanishes — which
 * reads as a button that does not work rather than as a permission problem.
 *
 * Nearly always an expired sign-in: the rules require an authenticated admin.
 */
const syncFailureListeners = new Set();

export function subscribeSyncFailure(fn) {
  syncFailureListeners.add(fn);
  return () => syncFailureListeners.delete(fn);
}

function reportSyncFailure(name, error) {
  syncFailureListeners.forEach((fn) => fn(name, error));
}

function readOverlay() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    // A corrupt blob should degrade to the shipped content, not a blank site.
    console.warn("store: overlay unreadable, falling back to defaults");
    return {};
  }
}

function writeOverlay(overlay) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  listeners.forEach((fn) => fn());
}

/**
 * Applies a document that arrived from Firestore. Identical payloads are
 * dropped rather than written: a local save echoes back through the snapshot
 * listener, and re-rendering every open page for content it already has is
 * wasted work at best and a flicker at worst.
 */
/** Collections the cloud has spoken for this session — even when what it
 *  said matched what we had. Distinguishes "defaults because no snapshot
 *  yet" from "the cloud really says this". */
const remoteSeen = new Set();

export const cloudHas = (name) => remoteSeen.has(name);

function applyRemote(name, data) {
  if (!Object.hasOwn(DEFAULTS, name)) return;
  remoteSeen.add(name);
  const overlay = readOverlay();
  const incoming = data === null ? undefined : data;
  if (JSON.stringify(overlay[name]) === JSON.stringify(incoming)) return;
  if (incoming === undefined) delete overlay[name];
  else overlay[name] = incoming;
  writeOverlay(overlay);
}

/* The admin needs the snapshot immediately — it edits live data. The public
   pages are pre-rendered and correct already, so their watch waits for the
   first idle moment: the Firestore SDK (~117KB) must not race the catalogue
   photography for bandwidth while the page is still painting. */
if (cloudEnabled()) {
  const start = () => watchContent(applyRemote);
  if (document.body?.classList.contains("admin")) start();
  else if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 2500 });
  else setTimeout(start, 1200);
}

export const isCloudEnabled = cloudEnabled;

/** Deep clone so callers cannot mutate the defaults by accident. */
const clone = (value) => JSON.parse(JSON.stringify(value));

/* ------------------------------------------------------------------ reads */

export function getCollection(name) {
  if (!Object.hasOwn(DEFAULTS, name)) throw new Error(`store: unknown collection "${name}"`);
  const overlay = readOverlay();
  /* Records saved before the site dropped the em dash still carry them, and
     the cloud copy is what the live pages render — so the rule is applied on
     the way out rather than left waiting for someone to re-save 21 strings. */
  return dedashDeep(clone(overlay[name] ?? DEFAULTS[name]));
}

export function isCustomised(name) {
  return name in readOverlay();
}

/** Fires whenever anything is saved — this is what makes edits sync live. */
export function subscribe(fn) {
  listeners.add(fn);
  // Another tab writing to localStorage fires `storage` here, not in the tab
  // that wrote it. That is what lets the admin tab update an open site tab.
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/* ----------------------------------------------------------------- writes */

export function saveCollection(name, items) {
  if (!Object.hasOwn(DEFAULTS, name)) throw new Error(`store: unknown collection "${name}"`);
  const overlay = readOverlay();
  overlay[name] = items;
  writeOverlay(overlay);
  // Local first, cloud after: the editor sees the change instantly and a failed
  // write surfaces as a warning rather than as lost typing.
  if (cloudEnabled()) {
    pushCollection(name, items).catch((error) => {
      console.warn(`store: could not sync "${name}" —`, error.message);
      reportSyncFailure(name, error);
    });
  }
}

export function resetCollection(name) {
  const overlay = readOverlay();
  delete overlay[name];
  writeOverlay(overlay);
  if (cloudEnabled()) {
    removeCollection(name).catch((error) => {
      console.warn(`store: could not clear "${name}" —`, error.message);
      reportSyncFailure(name, error);
    });
  }
}

export function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((fn) => fn());
  if (cloudEnabled()) {
    COLLECTIONS.forEach((name) =>
      removeCollection(name).catch((error) =>
        console.warn(`store: could not clear "${name}" —`, error.message)
      )
    );
  }
}

/** Everything the admin has changed, for backup before a risky edit. */
export function exportAll() {
  const overlay = readOverlay();
  return JSON.stringify(
    Object.fromEntries(COLLECTIONS.map((c) => [c, overlay[c] ?? DEFAULTS[c]])),
    null,
    2
  );
}

export function importAll(json) {
  const parsed = JSON.parse(json);
  const unknown = Object.keys(parsed).filter((k) => !Object.hasOwn(DEFAULTS, k));
  if (unknown.length) throw new Error(`unknown collections: ${unknown.join(", ")}`);
  writeOverlay(parsed);
  if (cloudEnabled()) {
    Object.entries(parsed).forEach(([name, items]) =>
      pushCollection(name, items).catch((error) =>
        console.warn(`store: could not sync "${name}" —`, error.message)
      )
    );
  }
}
