/**
 * The content, at build time.
 *
 * Firestore is the source of truth for the live site, and its read rule is
 * public, so the build can fetch it over REST with no credentials and no SDK.
 * If that call fails — offline, outage, project not reachable — the build falls
 * back to the shipped data files rather than emitting empty pages, because a
 * page with no content is worse than a page with slightly stale content.
 */
import { FIREBASE_CONFIG, CONTENT_COLLECTION } from "../js/firebase-config.js";

const REST = (project, collection) =>
  `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}`;

/** Firestore's REST shape is typed values; unwrap it back to plain JSON. */
function decode(value) {
  if (value === null || value === undefined) return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decode);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([k, v]) => [k, decode(v)])
    );
  }
  return null;
}

async function fromFirestore() {
  const url = REST(FIREBASE_CONFIG.projectId, CONTENT_COLLECTION);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore returned ${res.status}`);
  const { documents = [] } = await res.json();
  const out = {};
  for (const doc of documents) {
    const name = doc.name.split("/").pop();
    const data = decode(doc.fields?.data);
    if (data !== null) out[name] = data;
  }
  if (!Object.keys(out).length) throw new Error("Firestore holds no content documents");
  return out;
}

async function fromFiles() {
  const [{ ACTIVITIES, PACKAGES }, { DESTINATIONS, VISA_TYPES, PAGE_COPY },
         { MICE_SECTIONS }, { SERVICES }, { HOME_PILLS, HOME_CARDS, HOME_COPY }] = await Promise.all([
    import("../data/packages.js"), import("../data/content.js"),
    import("../data/mice.js"), import("../data/navigation.js"),
    import("../data/home.js"),
  ]);
  return {
    activities: ACTIVITIES, packages: PACKAGES, destinations: DESTINATIONS,
    services: SERVICES, visa: VISA_TYPES, mice: MICE_SECTIONS,
    homePills: HOME_PILLS, homeCards: HOME_CARDS, homeCopy: HOME_COPY, copy: PAGE_COPY,
  };
}

export async function loadContent() {
  try {
    const remote = await fromFirestore();
    const local = await fromFiles();
    // Firestore wins per collection, exactly as the browser store treats it,
    // so a collection nobody has edited still comes from the files.
    console.log(`  content: Firestore (${Object.keys(remote).join(", ")})`);
    const merged = { ...local, ...remote };
    // homeCopy is an object of named fields: a store saved before a field
    // existed must not blank it, so the defaults sit underneath.
    if (remote.homeCopy) merged.homeCopy = { ...local.homeCopy, ...remote.homeCopy };
    return merged;
  } catch (error) {
    console.warn(`  content: falling back to data files — ${error.message}`);
    return fromFiles();
  }
}
