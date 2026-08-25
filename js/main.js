import { SCENE } from "../data/images.js?v=139";
import "./info-modal.js?v=139";
import { SCENES } from "../data/navigation.js?v=139";
import { findPackageBySlug } from "../data/packages.js?v=139";
import { icon } from "../data/icons.js?v=139";
import {
  buildCustomTripUrl,
  buildDestinationEnquiryUrl,
  buildPlanTripUrl,
  buildWhatsAppUrl,
  openWhatsApp,
  CONTACT_EMAIL,
  WHATSAPP_DISPLAY,
} from "../utils/whatsapp.js?v=139";
import { createNavigation } from "./navigation.js?v=139";
import { getCollection, subscribe } from "./store.js?v=139";
import { resolvePill } from "../data/home.js?v=139";
import { buildPrimaryNav } from "./nav-model.js?v=139";
import { createCarousel } from "./carousel.js?v=139";
import { openItem } from "./item-dialog.js?v=139";
import { createPackageDialog } from "./package-dialog.js?v=139";

const section = document.querySelector(".cinema-scroll");
const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

const rail = document.querySelector("#package-rail");
const track = document.querySelector("#package-track");
const railControls = document.querySelector("#rail-controls");
const railFilter = document.querySelector("#rail-filter");
const heroCopy = document.querySelector(".hero-copy");
const panels = {
  promise: document.querySelector(".panel-promise"),
  discovery: document.querySelector(".panel-discovery"),
  services: document.querySelector(".panel-services"),
};

let targetMouseX = 0;
let targetMouseY = 0;
let mouseX = 0;
let mouseY = 0;
let targetScroll = 0;
let smoothScroll = 0;
let initialized = false;
let rafPending = false;

/* ------------------------------------------------------------------ helpers */

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

const smoothstep = (e0, e1, v) => {
  const x = clamp((v - e0) / (e1 - e0));
  return x * x * (3 - 2 * x);
};

const lerp = (a, b, t) => a + (b - a) * t;

const segmentInOut = (s, a, b, c, d) => {
  const enter = smoothstep(a, b, s);
  const exit = smoothstep(c, d, s);
  return { enter, exit, active: enter * (1 - exit) };
};

const getScrollDistance = () =>
  clamp(-section.getBoundingClientRect().top, 0, section.offsetHeight - window.innerHeight);

/** Hide a faded-out region from the pointer, the tab order and screen readers. */
const setInert = (el, inert) => {
  if (!el) return;
  el.inert = inert;
  el.classList.toggle("is-interactive", !inert);
};

/* -------------------------------------------------------------- scene setup */

function paintScene() {
  const assign = (id, asset) => {
    const el = document.querySelector(id);
    if (!el) return;
    el.src = asset.src;
    el.alt = asset.alt;
  };
  assign("#layer-sky", SCENE.sky);
  assign("#layer-glow", SCENE.glow);
  assign("#layer-city", SCENE.city);
  assign("#layer-curtain-left", SCENE.curtainLeft);
  assign("#layer-curtain-right", SCENE.curtainRight);
  assign("#layer-portal", SCENE.portal);
  assign("#layer-reveal", SCENE.reveal);
}

function renderServices() {
  const list = document.querySelector("#service-list");
  // From the store, so a service added in the admin appears here too.
  list.innerHTML = getCollection("services").map(
    (service) => `
    <li class="service-card" data-service="${service.key}">
      <span class="service-card-icon" aria-hidden="true">${icon(service.icon)}</span>
      <span class="service-card-name">${service.label}</span>
      <p class="service-card-blurb">${service.blurb}</p>
    </li>`
  ).join("");
}

function selectService(key) {
  document.querySelectorAll(".service-card").forEach((card) => {
    card.dataset.active = String(card.dataset.service === key);
  });
}

/* ------------------------------------------------------------ scene routing */

function goToScene(name) {
  const offset = SCENES[name] ?? 0;
  window.scrollTo({
    top: section.offsetTop + offset,
    behavior: reduceMotion.matches ? "auto" : "smooth",
  });
  requestTick();
}

/* ------------------------------------------------------------- frame update */

function update() {
  rafPending = false;

  targetScroll = getScrollDistance();

  if (!initialized || reduceMotion.matches) {
    smoothScroll = targetScroll;
    initialized = true;
  } else {
    smoothScroll = lerp(smoothScroll, targetScroll, 0.14);
  }
  if (Math.abs(smoothScroll - targetScroll) < 0.08) smoothScroll = targetScroll;

  mouseX = lerp(mouseX, targetMouseX, 0.12);
  mouseY = lerp(mouseY, targetMouseY, 0.12);

  // `m` collapses every large zoom/parallax term for reduced-motion users. The
  // scenes still change — they cross-fade instead of travelling.
  const m = reduceMotion.matches ? 0 : 1;

  const portalSeg = segmentInOut(smoothScroll, 560, 900, 1300, 1620);
  const discoverySeg = segmentInOut(smoothScroll, 1760, 2140, 2540, 2700);
  const progress = clamp(smoothScroll / 2700);
  const introExit = smoothstep(90, 650, smoothScroll);
  // The row used to travel 2600 -> 3620, a 1020px entrance that only became
  // visible around 2998 and did not settle until 3620 — a lot of scrolling
  // spent watching nothing. Starting sooner and over a shorter distance brings
  // the first card on screen ~325px earlier and settles it ~520px earlier.
  // 2400 is as early as it can start: the cards clear the right edge at roughly
  // 2673, and the discovery copy above them is gone by 2700.
  const railEnterRaw = smoothstep(2400, 3100, smoothScroll);
  const railEnter = Math.pow(railEnterRaw, 1.15);
  // Controls track the cards rather than the settle point: the row is readable
  // from ~2750, and arriving there with no way to browse left or right is the
  // reason you'd otherwise have to scroll back out of the scene.
  const railControlsEnter = smoothstep(2750, 3000, smoothScroll);
  // Two things are balanced here. The exit and the services copy must not
  // overlap: .scene-panel sits above .package-rail, so when they ran together
  // the headline painted straight through the cards. And the gap between the
  // row settling (3100) and the exit starting must stay small, or scrolling
  // moves nothing and the row reads as stuck. 100px of rest is enough to
  // register the cards, and by 3650 the row is 97% gone before the copy starts.
  const railExit = smoothstep(3200, 3700, smoothScroll);
  const servicesEnter = smoothstep(3650, 4100, smoothScroll);

  const blurActive = clamp(portalSeg.active + discoverySeg.active);
  const revealOpacity = portalSeg.active * (1 - discoverySeg.enter);
  const splitDrift = Math.pow(portalSeg.enter, 1.5) * m;
  const panelPromiseOpacity = portalSeg.active * (1 - portalSeg.exit);
  const panelDiscoveryOpacity = discoverySeg.active * (1 - discoverySeg.exit);

  const depthScale = reduceMotion.matches
    ? 1
    : 0.76 +
      progress * 0.2 +
      portalSeg.enter * 0.18 +
      discoverySeg.enter * 0.16 +
      servicesEnter * 0.12;

  const sharedHeroY = progress * -74 * m;
  const sharedHeroScale = progress * 0.23 * m;
  // On a phone the category strip occupies the band under the header, so the
  // rail starts lower there to leave it room. Desktop is unchanged: the strip
  // is not rendered above 760px.
  const stripAllowance = window.innerWidth <= 760 ? 26 : 0;
  const railScreenTop =
    Math.min(220, Math.max(112, window.innerHeight * 0.19)) - 50 + stripAllowance;
  const railParentTop = window.innerHeight - (window.innerHeight - railScreenTop) / depthScale;

  const px = (v) => `${v.toFixed(2)}px`;

  root.style.setProperty("--mx", (reduceMotion.matches ? 0 : mouseX).toFixed(4));
  root.style.setProperty("--my", (reduceMotion.matches ? 0 : mouseY).toFixed(4));

  root.style.setProperty("--depth-opacity", (1 - portalSeg.active * 0.06).toFixed(4));
  root.style.setProperty("--depth-x", px(mouseX * -12));
  root.style.setProperty("--depth-y", px(mouseY * -4));
  root.style.setProperty("--depth-scale", depthScale.toFixed(4));
  root.style.setProperty("--glow-y", `${(10 + progress * 10 * m).toFixed(2)}vh`);
  root.style.setProperty("--glow-scale", (0.78 + progress * 0.16 * m).toFixed(4));
  root.style.setProperty("--city-y", `${(20 - progress * 8 * m).toFixed(2)}vh`);
  root.style.setProperty("--blur-px", `${(blurActive * 14).toFixed(2)}px`);
  root.style.setProperty("--depth-brightness", (1 - blurActive * 0.255).toFixed(4));
  root.style.setProperty("--city-blur-px", `${(portalSeg.active * 14).toFixed(2)}px`);
  root.style.setProperty(
    "--city-brightness",
    (1 - portalSeg.active * 0.255 - discoverySeg.active * 0.06).toFixed(4)
  );
  root.style.setProperty("--city-saturation", (1 + discoverySeg.active * 0.18).toFixed(4));
  root.style.setProperty("--shade-opacity", "1");
  root.style.setProperty("--shade-z", portalSeg.active > 0.02 ? "2" : "0");
  root.style.setProperty("--shade-top-alpha", (blurActive * 0.465).toFixed(4));
  root.style.setProperty("--shade-mid-alpha", (blurActive * 0.42).toFixed(4));
  root.style.setProperty("--shade-bottom-alpha", (blurActive * 0.51).toFixed(4));

  root.style.setProperty("--title-y", px(introExit * -210 * m));
  root.style.setProperty("--title-scale", (1 - introExit * 0.08 * m).toFixed(4));
  root.style.setProperty("--title-opacity", (1 - introExit).toFixed(4));

  root.style.setProperty("--portal-x", `calc(-50% + ${px(mouseX * 18)})`);
  root.style.setProperty(
    "--portal-y",
    px((mouseY * 8 + sharedHeroY - portalSeg.exit * 760) * (m || 0.12))
  );
  root.style.setProperty("--portal-bottom", `${(5 - portalSeg.enter * 13 * m).toFixed(2)}vh`);
  // The arch is bottom-anchored, so on a wide, short window its resting size
  // pushes its top edge up until there is nowhere left for the hero title — at
  // 2560x1080 the top sat at y=49. Capping the *resting* width by height fixes
  // that. The travel target stays 105vw so flying through it still fills the
  // screen edge to edge; only the starting size shrinks, and only past ~1.9:1.
  const portalRestVw = Math.min(67.2, (128 * window.innerHeight) / window.innerWidth);
  root.style.setProperty(
    "--portal-width",
    `${(portalRestVw + portalSeg.enter * (105 - portalRestVw) * m).toFixed(2)}vw`
  );
  root.style.setProperty("--portal-grow", (portalSeg.enter * m).toFixed(4));
  root.style.setProperty(
    "--portal-scale",
    (1.02 + sharedHeroScale + portalSeg.exit * 0.46 * m).toFixed(4)
  );
  // Under reduced motion the portal cross-fades out instead of flying past.
  root.style.setProperty(
    "--portal-opacity",
    reduceMotion.matches ? (1 - portalSeg.exit).toFixed(4) : "1"
  );

  root.style.setProperty(
    "--split-left-x",
    `calc(-50% + ${(-splitDrift * 46).toFixed(2)}vw + ${px(mouseX * 22)})`
  );
  root.style.setProperty("--split-left-y", px(mouseY * 10 + sharedHeroY - splitDrift * 180));
  root.style.setProperty(
    "--split-left-scale",
    (1 + sharedHeroScale + portalSeg.enter * 0.74 * m).toFixed(4)
  );
  root.style.setProperty(
    "--split-right-x",
    `calc(-50% + ${(splitDrift * 46).toFixed(2)}vw + ${px(mouseX * 22)})`
  );
  root.style.setProperty("--split-right-y", px(mouseY * 10 + sharedHeroY - splitDrift * 180));
  root.style.setProperty(
    "--split-right-scale",
    (1 + sharedHeroScale + portalSeg.enter * 0.74 * m).toFixed(4)
  );

  root.style.setProperty("--reveal-opacity", revealOpacity.toFixed(4));
  root.style.setProperty("--reveal-x", `calc(-50% + ${px(mouseX * 10)})`);
  root.style.setProperty(
    "--reveal-y",
    `calc(-50% + ${px((mouseY * 8 - portalSeg.exit * 150) * m)})`
  );
  root.style.setProperty(
    "--reveal-scale",
    (1.06 + (portalSeg.enter * 0.08 + portalSeg.exit * 0.08) * m).toFixed(4)
  );

  root.style.setProperty("--hero-copy-y", px(introExit * 90 * m));
  root.style.setProperty("--hero-copy-opacity", (1 - introExit).toFixed(4));
  // Clears well before the hero copy does — once you have started scrolling it
  // has served its purpose, and it should not linger into the next scene.
  root.style.setProperty(
    "--scroll-cue-opacity",
    (1 - smoothstep(40, 260, smoothScroll)).toFixed(4)
  );

  root.style.setProperty("--panel-promise-opacity", panelPromiseOpacity.toFixed(4));
  root.style.setProperty(
    "--panel-promise-y",
    `calc(-50% + ${px((-portalSeg.exit * 86 + (1 - portalSeg.enter) * 58) * m)})`
  );
  root.style.setProperty("--panel-discovery-opacity", panelDiscoveryOpacity.toFixed(4));
  root.style.setProperty(
    "--panel-discovery-y",
    `calc(-50% + ${px((-discoverySeg.exit * 86 + (1 - discoverySeg.enter) * 58) * m)})`
  );
  root.style.setProperty("--panel-services-opacity", servicesEnter.toFixed(4));
  root.style.setProperty(
    "--panel-services-y",
    `calc(-50% + ${px((1 - servicesEnter) * 58 * m)})`
  );

  const railVisible = railEnter > 0.01 && railExit < 0.99;
  root.style.setProperty(
    "--rail-controls-opacity",
    (railControlsEnter * (1 - railExit)).toFixed(4)
  );
  railControls.classList.toggle(
    "is-ready",
    railControlsEnter > 0.35 && railExit < 0.02
  );
  root.style.setProperty("--rail-visibility", railVisible ? "visible" : "hidden");
  // Drives the CSS that keeps the preceding set out of the entrance.
  rail.dataset.entering = String(railEnter < 0.999);
  root.style.setProperty("--rail-y", "0px");
  root.style.setProperty(
    "--rail-enter-x",
    `${(((1 - railEnter) * 150 - railExit * 150) * m).toFixed(3)}vw`
  );
  // The row leaves by sliding, not by blinking out — so this holds at 1 for most
  // of the exit and only fades over the last stretch, once it is already mostly
  // off-screen. That covers the moment visibility flips off at railExit 0.99,
  // which on its own read as the row vanishing mid-travel.
  root.style.setProperty(
    "--rail-opacity",
    reduceMotion.matches
      ? (railEnter * (1 - railExit)).toFixed(4)
      : (1 - smoothstep(0.62, 1, railExit)).toFixed(4)
  );
  root.style.setProperty("--rail-scale", (1 / depthScale).toFixed(4));
  root.style.setProperty("--rail-top", px(railParentTop));
  root.style.setProperty("--rail-screen-top", px(railScreenTop));

  /* Keep hidden regions out of the tab order and away from the pointer. */
  setInert(heroCopy, introExit > 0.6);
  setInert(panels.promise, panelPromiseOpacity < 0.4);
  setInert(panels.discovery, panelDiscoveryOpacity < 0.4);
  setInert(panels.services, servicesEnter < 0.4);
  // Gate interactivity on being *visible*, not on being settled. The row is
  // on screen and readable long before the entrance finishes, and cards you
  // can read but not click are worse than cards that aren't there yet.
  setInert(rail, !railVisible || railEnter < 0.06);
  setInert(railControls, railControlsEnter < 0.35 || railExit > 0.1);

  if (
    Math.abs(smoothScroll - targetScroll) > 0.08 ||
    Math.abs(mouseX - targetMouseX) > 0.001 ||
    Math.abs(mouseY - targetMouseY) > 0.001
  ) {
    requestTick();
  }
}

function requestTick() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(update);
}

/* ------------------------------------------------------------------- wiring */

paintScene();
renderServices();

const dialog = createPackageDialog({
  dialog: document.querySelector("#package-dialog"),
});

const carousel = createCarousel({
  rail,
  track,
  controls: railControls,
  filterLabel: railFilter,
  // The row is mixed, so the click routes by what the record actually is: a
  // package opens the package dialog, anything else opens the shared item
  // panel — the same one its own category page uses, so a visa on the homepage
  // shows the requirements and processing time it shows everywhere else.
  onOpenPackage: (record, card) => {
    const kind = record.__collection ?? "packages";
    if (kind === "packages") return dialog.open(record, card);
    openItem(record, kind);
  },
});

/* --- "Browse all packages", beside the rail arrows --- */

const browseAll = document.querySelector("#rail-browse-all");

/** Pointless once the whole catalogue is already on the row. */
const showBrowseAll = (show) => {
  if (browseAll) browseAll.hidden = !show;
};

browseAll?.addEventListener("click", () => {
  window.location.href = "packages.html";
});

function handleAction(action) {
  if (!action) return;
  // Every dropdown item now opens its category page with the search pre-filled.
  if (action.kind === "page") {
    // `open` asks the destination page to show that record's panel on arrival.
    const params = new URLSearchParams();
    if (action.q) params.set("q", action.q);
    if (action.open) params.set("open", "1");
    const query = params.toString();
    location.href = query ? `${action.page}.html?${query}` : `${action.page}.html`;
    return;
  }
  if (action.kind === "filter") {
    const matched = carousel.setFilter(action.filter, action.label);
    if (matched > 0) goToScene("packages");
    else openWhatsApp(buildDestinationEnquiryUrl(action.label));
    if (matched > 0) showBrowseAll(action.filter?.type !== "all");
    return;
  }
  if (action.kind === "scene") {
    goToScene(action.scene);
    return;
  }
  if (action.kind === "service") {
    goToScene("services");
    selectService(action.service);
    return;
  }
  if (action.kind === "whatsapp") {
    openWhatsApp(buildWhatsAppUrl(action.message));
  }
}

createNavigation({
  nav: document.querySelector("#site-nav"),
  drawer: document.querySelector("#nav-drawer"),
  drawerBody: document.querySelector("#nav-drawer-body"),
  toggle: document.querySelector("#nav-toggle"),
  onAction: handleAction,
});

/* The homepage reads the same store as the category pages, so a service edited
   in the admin re-renders here too. */
subscribe(renderServices);

/* --- category strip, phones only ---
   The header on a phone is one row: wordmark and the menu icon, with the
   categories behind that icon. The band beneath it is empty sky, which is
   enough room for the categories to be one tap away instead of two. Built from
   the same menus the header and drawer use, so it cannot list a category that
   no longer exists. */
function renderHeroCategories() {
  const strip = document.querySelector("#hero-categories");
  if (!strip) return;
  strip.innerHTML = buildPrimaryNav()
    .map((menu) => `<a class="hero-category" href="${menu.page}.html">${menu.label}</a>`)
    .join("");
}
/* The header is absolutely positioned, so the strip cannot simply follow it in
   flow — it is told where the header actually ends, remeasured on resize. */
function placeHeroCategories() {
  const header = document.querySelector(".site-header");
  const strip = document.querySelector("#hero-categories");
  if (!header || !strip) return;
  document.documentElement.style.setProperty(
    "--hero-cat-top", `${Math.round(header.getBoundingClientRect().bottom) + 8}px`
  );
}

renderHeroCategories();
placeHeroCategories();
subscribe(renderHeroCategories);
window.addEventListener("resize", placeHeroCategories);

/* --- hero pills ---
   Each pill declares its own destination in the markup, so changing what they
   point at is an HTML edit rather than a branch in here. A pill with no page
   opens a tailor-made enquiry. */
/* Pill text is admin-editable, so it is untrusted the same way catalogue text
   is: it goes into markup and has to be escaped on the way. */
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderHeroPills() {
  const wrap = document.querySelector(".hero-pills");
  if (!wrap) return;
  const pills = getCollection("homePills");
  // Only rewrite when there is something to render. The build writes these into
  // the HTML so a crawler and the preload scanner see real buttons; replacing
  // them with nothing on an empty collection would blank the hero.
  if (!pills.length) return;
  wrap.innerHTML = pills.map((pill) => {
    const t = resolvePill(pill, (c) => getCollection(c));
    if (!t || !t.label) return "";
    return `
    <button class="hero-pill" type="button"
            data-page="${esc(t.page)}"
            data-query="${esc(t.query)}"
            data-open="${t.open ? "1" : ""}">${esc(t.label)}</button>`;
  }).join("");
}

renderHeroPills();
subscribe(renderHeroPills);

/* The carousel was built once and only ever recalculated on resize, so it was
   the one grid on the site that ignored an admin edit. */
subscribe(() => carousel.reload());

/* Delegated, because renderHeroPills replaces the buttons whenever the store
   changes and listeners bound to the old nodes would go with them. */
document.querySelector(".hero-pills")?.addEventListener("click", (event) => {
  const pill = event.target.closest(".hero-pill");
  if (!pill) return;
  const { page, query } = pill.dataset;
  if (!page) { openWhatsApp(buildCustomTripUrl()); return; }
  // open=1 is the same signal the dropdown menus use: it asks the category page
  // to open the panel for the record whose title matches, so a pill named after
  // one visa lands on that visa rather than on a filtered list of one.
  const open = pill.dataset.open === "1";
  window.location.href = query
    ? `${page}.html?q=${encodeURIComponent(query)}${open ? "&open=1" : ""}`
    : `${page}.html`;
});

/* --- scene CTAs --- */
document.querySelector("#explore-packages").addEventListener("click", () => {
  window.location.href = "packages.html";
});

document.querySelector("#plan-trip").addEventListener("click", () => {
  openWhatsApp(buildPlanTripUrl());
});

document.querySelector("#view-all-packages").addEventListener("click", () => {
  window.location.href = "packages.html";
});

/* --- logo returns to scene one --- */
document.querySelector("[data-scene-link]").addEventListener("click", (event) => {
  event.preventDefault();
  goToScene("intro");
});

/* --- contact links --- */
const waHref = buildWhatsAppUrl(
  "Hi BGS Travel & Tourism, I'd like help planning a trip."
);
document.querySelectorAll("#contact-whatsapp, #drawer-whatsapp").forEach((el) => {
  el.href = waHref;
  el.target = "_blank";
  el.rel = "noopener noreferrer";
  el.textContent = `WhatsApp ${WHATSAPP_DISPLAY}`;
});
document.querySelectorAll("#contact-email").forEach((el) => {
  el.href = `mailto:${CONTACT_EMAIL}`;
  el.textContent = CONTACT_EMAIL;
});

/* --- service cards open the page that covers them --- */

/**
 * Visa and Activities have pages of their own; everything else is a section of
 * the Services page, reached with its name already searched.
 */
const SERVICE_PAGE = {
  visa: "visa.html",
  activities: "activities.html",
};

document.querySelector("#service-list").addEventListener("click", (event) => {
  const card = event.target.closest(".service-card");
  if (!card) return;
  const key = card.dataset.service;
  selectService(key);
  const name = card.querySelector(".service-card-name")?.textContent.trim() ?? "";
  window.location.href =
    SERVICE_PAGE[key] || `services.html?q=${encodeURIComponent(name)}`;
});

/* ---------------------------------------------------------------- listeners */

window.addEventListener("scroll", requestTick, { passive: true });

window.addEventListener("resize", () => {
  carousel.refresh();
  requestTick();
});

window.addEventListener(
  "pointermove",
  (event) => {
    // On touch, pointermove fires throughout a scroll drag, so the parallax
    // would yank the layers around under the finger. Hover pointers only.
    if (!finePointer.matches) return;
    targetMouseX = event.clientX / window.innerWidth - 0.5;
    targetMouseY = event.clientY / window.innerHeight - 0.5;
    requestTick();
  },
  { passive: true }
);

reduceMotion.addEventListener("change", requestTick);

/* --- client-side deep link: #package=<slug> --- */
const hash = window.location.hash.match(/^#package=(.+)$/);
if (hash) {
  const pkg = findPackageBySlug(hash[1]);
  if (pkg) {
    goToScene("packages");
    window.setTimeout(() => carousel.openBySlug(pkg.slug), 400);
  }
}

requestTick();
