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
 */

/* Line art and desaturated stock read badly beside real travel photography. */
const REJECT = /black and white|monochrome|grayscale|greyscale|illustration|drawing|sketch/i;

const MAX_OPTIONS = 8;

export default async (request) => {
  const params = new URL(request.url).searchParams;
  const query = params.get("q");
  const count = Math.min(Number(params.get("count")) || 6, MAX_OPTIONS);

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        // A day is long enough to make re-opening the same record instant and
        // short enough that a better photograph can surface tomorrow.
        "cache-control": "public, max-age=86400",
      },
    });

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
