/**
 * One place that decides how big a photograph is fetched.
 *
 * Two hosts supply the catalogue's photography and each resizes differently:
 *
 * - Pexels resizes on demand: the width and height live in the query string,
 *   so any size can be asked for.
 * - Wikimedia Commons does NOT. Since 2025 it serves only a fixed list of
 *   thumbnail widths and rejects anything else outright with a 400 ("Use
 *   thumbnail sizes listed on https://w.wiki/GHai"), which is why an
 *   arbitrary rewrite to 640px returns an error page rather than a picture.
 *   The permitted widths are WIKI_WIDTHS below; a request is rounded UP to
 *   the next one so a photo is never upscaled into blur.
 *
 * The transform happens here, at render time, on whatever URL a record
 * carries — not in the data files. That is deliberate: the live catalogue
 * comes from Firestore, whose records hold the URLs that were saved when the
 * photo was picked. A size baked into data/photos.js would never reach them.
 */

/** Widths Wikimedia production actually serves. Anything else 400s. */
const WIKI_WIDTHS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];

const WIKI_HOST = "upload.wikimedia.org";
const PEXELS_HOST = "images.pexels.com";

/** Masters that are not JPEG gain an extension when thumbed (…​.webp.png). */
const NEEDS_PNG_SUFFIX = /\.(webp|tiff?|svg)$/i;

const nextWikiWidth = (want) =>
  WIKI_WIDTHS.find((w) => w >= want) ?? WIKI_WIDTHS[WIKI_WIDTHS.length - 1];

/**
 * The same photograph at (at least) `want` pixels wide.
 *
 * `ratio` is height ÷ width, and only Pexels can honour it — it crops on
 * demand. Pass the display box's ratio when the slot has a fixed shape (the
 * cards are 16:10), and leave it off to keep whatever crop the photo was
 * chosen with, which is what the dialog and the social tags want.
 *
 * Returns the URL unchanged when the host is not one we can resize.
 */
export function photoSrc(url, want, ratio) {
  if (typeof url !== "string" || !url) return url;

  if (url.includes(PEXELS_HOST)) {
    const storedW = Number(url.match(/[?&]w=(\d+)/)?.[1]) || 0;
    const storedH = Number(url.match(/[?&]h=(\d+)/)?.[1]) || 0;
    // Never ask for more than the record already asked for: widening a stored
    // 1200px crop to 1280 buys nothing visible and costs bytes.
    const width = storedW ? Math.min(want, storedW) : want;
    const shape = ratio ?? (storedW && storedH ? storedH / storedW : 0);
    const height = shape ? Math.round(width * shape) : storedH;
    const sized = url.replace(/([?&])w=\d+/, `$1w=${width}`);
    return height ? sized.replace(/([?&])h=\d+/, `$1h=${height}`) : sized;
  }

  if (!url.includes(WIKI_HOST)) return url;

  const width = nextWikiWidth(want);
  // The utm_* parameters Commons appends are attribution tracking; the
  // derived URL is a different rendition, so they are dropped rather than
  // carried over to describe a file they no longer point at.
  const clean = url.split("?")[0];

  // Already a thumbnail: swap the width segment.
  if (clean.includes("/thumb/")) return clean.replace(/\/\d+px-/, `/${width}px-`);

  // An unscaled original — /commons/a/ab/File.jpg. These are the full
  // uploads, several megabytes each, and were being sent straight to phones.
  const m = clean.match(
    /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[a-z]+)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/
  );
  if (!m) return url;
  const [, base, a, ab, file] = m;
  const thumbName = NEEDS_PNG_SUFFIX.test(file) ? `${file}.png` : file;
  return `${base}/thumb/${a}/${ab}/${file}/${width}px-${thumbName}`;
}

/* ------------------------------------------------------- the site's two slots */

/**
 * Card media is a 16:10 box and cards are ~360-400 CSS px wide in every
 * layout the site has, so 500px covers a 1x screen outright and lands at
 * ~1.4x on a phone — a thumbnail, deliberately, not a full photograph.
 *
 * The alternative was a srcset offering 960 as well, which keeps 2x screens
 * pixel-perfect. Measured on the built site (Lighthouse, mobile, slow 4G):
 * that costs 1.2-1.5s of largest-contentful-paint and roughly doubles page
 * weight (visa 646KB -> 1109KB, destinations 715KB -> 1337KB) for extra
 * sharpness in a 356px-wide card. Opening an item still loads the large
 * rendition below, which is where the photograph is actually looked at.
 * To buy that sharpness back, add 960 as a second width here and give the
 * card <img> a srcset built from the pair.
 */
const CARD_WIDTH = 500;
const CARD_RATIO = 5 / 8;

/** One large photo: the item dialog, the item page, and the social tags.
 *  1200 is the width social scrapers expect, and Wikimedia rounds it to its
 *  own 1280 — while a Pexels URL stored at 1200 comes back untouched. */
const FULL_WIDTH = 1200;

/** A card's photograph, at thumbnail size. */
export const cardSrc = (url) => photoSrc(url, CARD_WIDTH, CARD_RATIO);

/** The large rendition. */
export const fullSrc = (url) => photoSrc(url, FULL_WIDTH);
