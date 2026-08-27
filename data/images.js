import { PHOTOS } from "./photos.js?v=200";
/**
 * Image sources for the catalogue.
 *
 * The old cinematic homepage's scene plates (SCENE, SCENE_LAYER_IDS, the REV
 * token and the Wikimedia helper) lived here until the homepage was rebuilt;
 * they were removed with it. The arch on the new homepage references
 * assets/scene/sky.* and city.* directly in index.html with a hand-written
 * ?rev=1 — if that artwork is ever replaced, bump the token there.
 */

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
