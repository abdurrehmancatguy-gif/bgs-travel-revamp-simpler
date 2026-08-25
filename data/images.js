import { PHOTOS } from "./photos.js?v=139";
/**
 * Every image URL used by the site lives here — swap a value and the whole
 * page follows. Nothing else in the codebase hardcodes an image address.
 *
 * Current sources are freely-licensed Wikimedia Commons files served through
 * Special:FilePath, which redirects to a width-scaled render. To move to BGS's
 * own photography, replace the `src` values with your CDN URLs; the `alt` text
 * and the layer contract (see SCENE below) are what the layout depends on.
 */

const commons = (file, width = 2400) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    file.replace(/ /g, "_")
  )}?width=${width}`;

/**
 * Cinematic scene layers, back to front.
 *
 * IMPORTANT — these are not interchangeable with ordinary photographs. The
 * composition depends on the alpha channel: `portal` is an arch cut out of a
 * transparent sky, and `curtainLeft`/`curtainRight` are transparent-edge
 * frames that part to open the scene. Dropping an opaque JPEG into those three
 * slots covers the whole stage. `sky`, `glow`, `city` and `reveal` are
 * full-bleed plates and will accept any landscape image.
 *
 * Replacing these with BGS artwork therefore needs transparent PNGs for the
 * portal and curtains; everything else is a straight URL swap.
 *
 * Only `sky` is fetched eagerly; the rest are lazy.
 */
/**
 * Served from this site, not the Figma preview these were exported from. The
 * originals were seven 4K PNGs totalling 32MB on first paint, which is why the
 * homepage took so long to show anything. Re-encoded to WebP at 2048px (1600px
 * for the framing layers, which never fill the viewport) they come to 0.95MB —
 * a 97% cut — with the alpha the composition depends on intact.
 *
 * `sky` is the exception: it is genuinely opaque, measured by sampling its
 * pixels rather than assumed, so it carries no alpha and is the smallest at
 * 42KB.
 */
const SCENE_BASE = "assets/scene";

/**
 * Bumped by hand, only when the artwork itself changes.
 *
 * Deliberately `?rev=` and not the site-wide `?v=`, which every code change
 * bumps: pairing these files with the code version would throw away a megabyte
 * of correctly-cached artwork in every returning visitor's browser each time a
 * stylesheet moved. The netlify.toml rule caches anything under /assets for a
 * year on the strength of this, so it has to change when the pixels do.
 */
const REV = "1";

/**
 * Each layer ships twice: AVIF for the browsers that take it, WebP for the rest.
 *
 * Measured rather than assumed — the seven layers come to 567KB as AVIF against
 * 979KB as WebP, a 43% cut, and the encode was checked pixel by pixel before
 * being accepted: transparency is identical to the decimal on every layer, and
 * 99% of visible pixels are within 9/255 of the original. Quality 40 saved
 * another 200KB but frayed the curtain edges, so it was rejected.
 */
/**
 * Each layer at two widths.
 *
 * A phone was being sent the 2048px plate and painting it about 400px wide.
 * Lighthouse put 136KB of that down as waste, and it showed in the number that
 * matters: largest contentful paint at 9.8s on a throttled mobile connection.
 * The 1024px set is 159KB against 567KB — 72% less — for artwork nobody can
 * tell apart at that size.
 *
 * Checked before accepting it, because these layers are alpha-dependent: the
 * transparent fraction of every one of the seven is identical at both widths,
 * to the decimal.
 */
const layer = (file) => ({
  src: `${SCENE_BASE}/${file}.webp?rev=${REV}`,
  avif: `${SCENE_BASE}/${file}.avif?rev=${REV}`,
  srcsetAvif: `${SCENE_BASE}/${file}-1024.avif?rev=${REV} 1024w, ` +
              `${SCENE_BASE}/${file}.avif?rev=${REV} 2048w`,
  srcsetWebp: `${SCENE_BASE}/${file}-1024.webp?rev=${REV} 1024w, ` +
              `${SCENE_BASE}/${file}.webp?rev=${REV} 2048w`,
});

/**
 * `eager` marks the layers inside the first viewport. They are written into the
 * HTML by build/build.mjs so the preload scanner can start them while the
 * parser is still working, rather than waiting for the module graph to load and
 * run — which is what the empty src attributes used to cost: 1.16s of an idle
 * connection before the first image byte was even requested.
 *
 * `priority` names the one the browser should fetch first. It is the measured
 * LCP element, not a guess.
 */
export const SCENE = {
  sky: {
    ...layer("sky"),
    alt: "", // decorative backdrop — the headline carries the meaning
    eager: true,
  },
  glow: {
    ...layer("glow"),
    alt: "",
    eager: true,
    priority: true,
  },
  city: {
    ...layer("city"),
    alt: "",
    eager: true,
  },
  curtainLeft: {
    ...layer("curtainLeft"),
    alt: "",
    eager: true,
  },
  curtainRight: {
    ...layer("curtainRight"),
    alt: "",
    eager: true,
  },
  portal: {
    ...layer("portal"),
    alt: "A stone arch bridge spanning a river gorge at golden hour",
    eager: true,
  },
  reveal: {
    ...layer("reveal"),
    alt: "",
    // Sits behind the curtains and is only uncovered once the scene opens, so
    // it is the one layer that genuinely does not need to be there on paint.
    eager: false,
  },
};

/** The DOM ids the scene layers occupy, paired with their SCENE key. */
export const SCENE_LAYER_IDS = {
  "layer-sky": "sky",
  "layer-glow": "glow",
  "layer-city": "city",
  "layer-curtain-left": "curtainLeft",
  "layer-curtain-right": "curtainRight",
  "layer-portal": "portal",
  "layer-reveal": "reveal",
};

/** Package photography — shown inside the detail dialog, loaded on demand. */
export const PACKAGE_IMAGES = {
  desertSafari: {
    src: PHOTOS.desertSafari,
    alt: "Four-wheel drives crossing the dunes on a Dubai desert safari",
  },
  dhowCruise: {
    src: PHOTOS.dhowCruise,
    alt: "A traditional wooden dhow moored on Dubai Creek",
  },
  helicopter: {
    src: PHOTOS.helicopter,
    alt: "Aerial view of the Palm Jumeirah island in Dubai",
  },
  dubaiFrame: {
    src: PHOTOS.dubaiFrame,
    alt: "The observation deck of the Dubai Frame looking out over the city",
  },
  hotAirBalloon: {
    src: PHOTOS.hotAirBalloon,
    alt: "A hot air balloon drifting low over desert dunes at sunrise",
  },
  familyDay: {
    src: PHOTOS.familyDay,
    alt: "The Dubai Fountain performing in front of the Burj Khalifa",
  },
  serengeti: {
    src: PHOTOS.serengeti,
    alt: "Wildebeest crossing the plains during the Serengeti migration",
  },
  gorilla: {
    src: PHOTOS.bwindi,
    alt: "A mountain gorilla feeding in dense forest undergrowth",
  },
  krugerCape: {
    src: PHOTOS.southAfrica,
    alt: "Table Mountain rising behind the city of Cape Town",
  },
  ethiopia: {
    src: PHOTOS.ethiopia,
    alt: "The rock-hewn Church of Saint George at Lalibela at sunset",
  },
  bali: {
    src: PHOTOS.bali,
    alt: "Terraced rice paddies stepping down a hillside in Bali",
  },
  rajasthan: {
    src: PHOTOS.rajasthan,
    alt: "The Taj Mahal reflected in its watercourse at Agra",
  },
};
