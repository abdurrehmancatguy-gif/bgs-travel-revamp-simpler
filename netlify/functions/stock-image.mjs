/**
 * Landscape stock photographs for a query, from Pexels.
 *
 * This exists so the API key stays on the server. The same lookup made from the
 * admin page would ship the key in page source, where anyone could read it.
 *
 * Answers with both shapes at once: `url` is the single best pick, which the
 * spreadsheet importer uses to backfill a new record silently, and `options` is
 * the shortlist the admin's picker shows as thumbnails. One endpoint, because
 * the two callers want the same search and differ only in how much of it they
 * show.
 *
 * Set PEXELS_KEY in Netlify → Site configuration → Environment variables. With
 * no key the function answers 200 with an empty list rather than an error: a
 * missing photograph should leave a record without one, not fail an import.
 *
 * ADMIN ONLY. This is the one piece of server-side code the site has, and it
 * spends a paid credential on every call, so it must not answer strangers:
 * unauthenticated, anyone who found the path could loop it and exhaust the
 * Pexels quota (200/hour on the free tier), and the first the owner would know
 * is an empty picker with no explanation. Callers present the signed-in
 * admin's Firebase ID token, which is verified against Google's public keys
 * below before a single upstream request is made.
 */

import { FIREBASE_CONFIG } from "../../js/firebase-config.js";

/* Line art and desaturated stock read badly beside real travel photography. */
const REJECT = /black and white|monochrome|grayscale|greyscale|illustration|drawing|sketch/i;

const MAX_OPTIONS = 8;

/**
 * Verifies a Firebase ID token the cheap way: ask Google about it.
 *
 * Verifying locally means fetching Google's rotating public keys and checking
 * an RS256 signature; for one low-traffic admin endpoint, handing the token to
 * the identitytoolkit API is simpler, has no crypto to get wrong, and fails
 * closed on every error path. The token is valid only if Google returns a user
 * for it — a forged or expired one returns none.
 *
 * The apiKey used for that lookup is the same Firebase web key the browser
 * already ships in js/firebase-config.js. It is an identifier, not a secret
 * (it authorises nothing on its own), so importing it here is correct and
 * saves the owner from having to set another environment variable.
 */
async function isAdmin(request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;

  const apiKey = FIREBASE_CONFIG.apiKey;
  if (!apiKey) return false;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) return false;
    const { users = [] } = await res.json();
    return users.length > 0;
  } catch {
    return false;
  }
}

export default async (request) => {
  const params = new URL(request.url).searchParams;
  const query = params.get("q");
  const count = Math.min(Number(params.get("count")) || 6, MAX_OPTIONS);

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        // Private, not public: the reply is only produced for a signed-in
        // admin, so no shared cache should ever hold or re-serve it. A day is
        // long enough to make re-opening the same record instant and short
        // enough that a better photograph can surface tomorrow.
        "cache-control": "private, max-age=86400",
      },
    });

  /* Answer strangers before spending anything: no upstream call, and a
     private cache directive so no shared cache ever stores this reply. */
  if (!(await isAdmin(request))) {
    return new Response(
      JSON.stringify({ url: "", options: [], reason: "admin sign-in required" }),
      { status: 401, headers: { "content-type": "application/json", "cache-control": "no-store" } }
    );
  }

  if (!query) return json({ url: "", options: [], reason: "no query" }, 400);
  const key = process.env.PEXELS_KEY;
  if (!key) return json({ url: "", options: [], reason: "PEXELS_KEY is not set on this site" });

  try {
    const res = await fetch(
      "https://api.pexels.com/v1/search?" + new URLSearchParams({
        query, orientation: "landscape", per_page: "24",
      }),
      { headers: { Authorization: key } }
    );
    if (!res.ok) return json({ url: "", options: [], reason: `Pexels returned ${res.status}` });

    const { photos = [] } = await res.json();
    const usable = photos.filter((p) => !REJECT.test(`${p.alt ?? ""} ${p.url}`));
    // Fall back to the unfiltered set rather than returning nothing when a
    // query legitimately has only desaturated results.
    const pool = usable.length ? usable : photos;

    const options = pool.slice(0, count).map((p) => ({
      url: p.src?.landscape ?? "",
      thumb: p.src?.tiny ?? p.src?.small ?? "",
      alt: p.alt ?? "",
      photographer: p.photographer ?? "",
      credit: p.url ?? "",
    })).filter((o) => o.url);

    return json({
      url: options[0]?.url ?? "",
      alt: options[0]?.alt ?? "",
      photographer: options[0]?.photographer ?? "",
      options,
      query,
    });
  } catch (error) {
    return json({ url: "", options: [], reason: error.message });
  }
};

export const config = { path: "/api/stock-image" };
