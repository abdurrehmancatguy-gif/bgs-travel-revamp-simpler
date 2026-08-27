import { getCollection, subscribe, isCloudEnabled, cloudHas } from "./store.js?v=205";
import "./info-modal.js?v=205";
import { createNavigation } from "./navigation.js?v=205";
import { icon } from "../data/icons.js?v=205";
import { priceLabel } from "../data/packages.js?v=205";
import { openWhatsApp, buildWhatsAppUrl } from "../utils/whatsapp.js?v=205";
import { MICE_SERVICES } from "../data/mice.js?v=205";
import { openItem, itemTitle } from "./item-dialog.js?v=205";
// The same wheel glide the homepage has — the card lists are the longest
// scrolls on the site, so they benefit most.
import "./smooth-scroll.js?v=205";
import { enableTilt } from "./tilt.js?v=205";
import { buildPrimaryNav } from "./nav-model.js?v=205";
import { track } from "./analytics.js?v=205";
import { contactStripMarkup, openInfo } from "./info-modal.js?v=205";

/**
 * Every category page runs this one module. The page declares which collection
 * it shows with `data-collection` on <body>; everything else — the header, the
 * search box, the chips, the cards, the live re-render when the admin saves —
 * is identical, so a new category page is an HTML file and nothing more.
 *
 * The search box is pre-filled from `?q=`, which is how the dropdown deep links
 * work: picking "Desert" under Activities lands here with "Desert" searched and
 * the list already filtered.
 */

const page = document.body.dataset.collection;
const grid = document.querySelector("#card-grid");
const input = document.querySelector("#page-search-input");
const clearBtn = document.querySelector("#page-search-clear");
const chipRow = document.querySelector("#page-chips");
const countEl = document.querySelector("#page-count");

/* ------------------------------------------------------ per-collection shape */

/**
 * Where a record's generated page lives. Must agree with build/render.mjs — the
 * pre-rendered card and this one point at the same URL, or the crawler and the
 * visitor disagree about where a thing is.
 */
const slugify = (value) => {
  const text = String(value ?? "");
  const out = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (out) return out;
  // Must match slug() in build/render.mjs exactly: the card links here and the
  // directories the build writes have to agree on where a record lives, and a
  // title with no ASCII letters (e.g. "日本ビザ") has no natural slug.
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return `item-${h.toString(36)}`;
};

const hrefFor = (title) => `/${page}/${slugify(title)}/`;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * What each collection puts on a card, what its filter chips are, and which of
 * its fields the search box looks at. Adding a category page means adding an
 * entry here.
 */
/**
 * Services that ARE one of the site's own categories go to that category's
 * page — a card called Visa Services opening a small dialog about visas,
 * beside a nav item that opens the actual catalogue, was two doors with one
 * label. Keyed on the record's `key`, so renaming the label cannot break it;
 * services without a page of their own (flights, hotels, concierge…) keep
 * their detail panel.
 */
const SERVICE_PAGE = { visa: "visa", activities: "activities", flights: "destinations" };

const SHAPES = {
  activities: {
    chips: (items) => [...new Set(items.flatMap((i) => i.tags ?? []))].sort(),
    search: (i) => [i.title, i.category, i.destination, ...(i.tags ?? [])],
    card: (i) => cardMarkup({
      image: i.image, alt: i.title, iconName: i.icon, kicker: i.category,
      title: i.title, itemHref: hrefFor(i.title), body: i.shortDescription,
      meta: [i.duration, priceLabel(i), i.rating ? `${Number(i.rating).toFixed(1)} ★` : ""],
    }),
  },
  packages: {
    chips: (items) =>
      [...new Set(items.flatMap((i) => [i.region, ...(i.tags ?? [])]))].sort(),
    search: (i) => [i.title, i.category, i.region, i.destination, ...(i.tags ?? [])],
    card: (i) => cardMarkup({
      image: i.image, alt: i.title, iconName: i.icon, kicker: i.category,
      title: i.title, itemHref: hrefFor(i.title), body: i.shortDescription,
      meta: [i.duration, priceLabel(i), i.rating ? `${Number(i.rating).toFixed(1)} ★` : ""],
    }),
  },
  destinations: {
    chips: (items) => [...new Set(items.map((i) => i.region))],
    search: (i) => [i.name, i.region],
    card: (i) => cardMarkup({
      image: i.image, alt: i.name, kicker: i.region, title: i.name,
      itemHref: hrefFor(i.name), body: i.blurb, meta: [`Best time: ${i.bestTime}`],
    }),
  },
  services: {
    chips: () => [],
    search: (i) => [i.label, i.blurb],
    card: (i) => cardMarkup({
      image: i.image, alt: i.label, iconName: i.icon, kicker: "Service",
      title: i.label,
      itemHref: SERVICE_PAGE[i.key] ? `${SERVICE_PAGE[i.key]}.html` : hrefFor(i.label),
      body: i.blurb, meta: [],
    }),
  },
  mice: {
    chips: (items) => items.map((i) => i.name),
    // Every item name is searchable, so "Gala" finds Corporate Events even
    // though the section is not called that.
    search: (i) => [i.name, ...(i.items ?? [])],
    card: (i) => cardMarkup({
      image: i.image, alt: i.name, iconName: i.icon, kicker: "MICE",
      title: i.name, itemHref: hrefFor(i.name), body: i.blurb, list: i.items,
    }),
  },
  visa: {
    chips: (items) => [...new Set(items.map((i) => i.country))],
    search: (i) => [i.name, i.country],
    card: (i) => cardMarkup({
      image: i.image, alt: i.name, iconName: "visa", kicker: i.country,
      title: i.name, itemHref: hrefFor(i.name), body: i.blurb,
      // Labelled: two bare durations side by side ("3 to 5 working days",
      // "60 days from issue") don't say which is processing and which validity.
      meta: [
        i.processing && `Processing: ${i.processing}`,
        i.validity && `Valid: ${i.validity}`,
        priceLabel(i),
      ],
    }),
  },
};

/**
 * Cards display at roughly 380px while these URLs are 2400-3840px renditions —
 * six times the pixels needed. Rewriting the width in the path does NOT work:
 * Wikimedia serves only the exact rendition its API generated, and 640, 800 and
 * 1024 all 404 for a file whose 3840 loads fine. The fix is to request the
 * smaller size at resolve time (iiurlwidth) and store both, which is a change to
 * data/photos.js rather than something this renderer can do.
 */
/** Cards render at ~380px; Pexels serves whatever size the URL asks for, so
 *  ask for card-sized (800w covers 2x DPR) instead of the stored 1200w. */
const cardSized = (url) =>
  typeof url === "string" && url.includes("images.pexels.com")
    ? url.replace(/([?&])h=\d+/, "$1h=500").replace(/([?&])w=\d+/, "$1w=800")
    : url;

function cardMarkup({ image, alt, iconName, kicker, title, body, meta = [], list = [], itemHref = "" }) {
  // Package photography is stored as { src, alt } while destination and visa
  // images are plain strings, so accept either rather than forcing one shape.
  const src = typeof image === "string" ? image : image?.src;
  const altText = (typeof image === "object" && image?.alt) || alt || title;
  image = src;
  alt = altText;
  // The card is a plain list item: the h3 link inside is the one tab stop and
  // carries the name from its visible text. A role="button" wrapper would
  // flatten the heading/list out of the accessibility tree and cost keyboard
  // users two stops per card.
  return `
    <li class="item-card reveal" data-title="${esc(title)}">
      ${image ? `<div class="item-card-media">
        <img src="${esc(cardSized(image))}" alt="${esc(alt || title)}" loading="lazy" />
        ${iconName ? `<span class="item-card-icon" aria-hidden="true">${icon(iconName)}</span>` : ""}
      </div>` : ""}
      <div class="item-card-inner">
        ${kicker ? `<p class="item-card-kicker">${esc(kicker)}</p>` : ""}
        <h3><a class="item-card-link" href="${esc(itemHref)}">${esc(title)}</a></h3>
        <p>${esc(body ?? "")}</p>
        ${list.length ? `<ul class="item-card-list">
          ${list.map((entry) => `<li>${esc(entry)}</li>`).join("")}
        </ul>` : ""}
        ${meta.filter(Boolean).length ? `<p class="item-card-meta">
          ${meta.filter(Boolean).map((m, n) => `<span class="${
            n === 0 ? "item-card-duration" : n === meta.length - 1 && meta.length > 2
              ? "item-card-rating" : "item-card-price"
          }">${esc(m)}</span>`).join("")}
        </p>` : ""}
      </div>
    </li>`;
}

/* -------------------------------------------------------------- filtering */

const shape = SHAPES[page];
let items = getCollection(page);
/* What is on screen right now, in DOM order. The click handler indexes into
   this rather than searching by title — two records may share a title, and the
   filtered order is the only thing the grid and this array agree on. */
let visibleItems = [];
let query = new URLSearchParams(location.search).get("q") || "";

const matches = (item, q) => {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return shape
    .search(item)
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle));
};

/* The markup the grid is currently showing.
 *
 * Seeded from what the build already wrote into the page, which is what stops
 * the cards appearing twice. Three things want to draw this grid on a first
 * load — the pre-rendered HTML, the first render() as the module runs, and the
 * Firestore snapshot arriving a moment later — and until now each one replaced
 * innerHTML unconditionally. Replacing identical markup still throws away every
 * <img> and fetches it again, so the cards visibly blinked out and came back.
 *
 * Comparing the string is cheap next to what a needless re-render costs. */
let lastMarkup = grid.innerHTML;
/* True while the grid still holds the build's server-rendered cards — the
   version with the eager, high-priority first images the largest paint
   depends on. Flips off at the first rebuild or adoption. */
let serverGrid = grid.querySelectorAll(".item-card").length > 0;

function render() {
  const visible = items.filter((item) => matches(item, query));
  visibleItems = visible;

  const markup = visible.length ? visible.map(shape.card).join("") : "";
  if (markup !== lastMarkup) {
    if (serverGrid && !query) {
      const existing = [...grid.querySelectorAll(".item-card")];
      /* Adopt the pre-rendered grid instead of rebuilding it when it matches
         the store, card for card. Replacing it with lazy runtime cards re-hid
         painted content and pushed the largest paint from ~2.5s to ~7.5s on a
         slow connection. data-title per card is the fingerprint — titles
         aligning by index is what makes dataset.idx safe. */
      if (existing.length === visible.length &&
          existing.every((el, i) => el.dataset.title === itemTitle(visible[i], page))) {
        serverGrid = false;
        lastMarkup = markup;
        grid.querySelectorAll(".item-card").forEach((el, i) => { el.dataset.idx = i; });
        return finishRender(visible);
      }
      /* Mismatch before any snapshot: the build baked live cloud content and
         the shipped defaults can be far behind it (2 visas vs 28) — tearing
         the richer grid down to the defaults for a second or two, then
         rebuilding when the snapshot lands, is exactly the flash this branch
         exists to prevent. Hold the server DOM; clicks resolve by title or
         follow the card's own link; the snapshot re-enters here. */
      if (!cloudHas(page) && isCloudEnabled() && existing.length > visible.length) {
        countEl.textContent = `${existing.length} results`;
        return;
      }
    }
    serverGrid = false;
    grid.innerHTML = markup;
    /* Cards already on screen are born shown — re-hiding painted content
       behind the reveal fade flashes it out. The fade stays for cards
       scrolled to later. */
    const fold = window.innerHeight + 120;
    grid.querySelectorAll(".item-card.reveal:not([data-shown])").forEach((el) => {
      if (el.getBoundingClientRect().top < fold) el.dataset.shown = "true";
    });
    lastMarkup = markup;
    // Stamped after render rather than woven through every shape's card builder.
    grid.querySelectorAll(".item-card").forEach((el, i) => { el.dataset.idx = i; });
  }
  finishRender(visible);
}

function finishRender(visible) {

  const empty = document.querySelector("#page-empty");
  empty.hidden = visible.length > 0;
  if (!visible.length) {
    empty.querySelector("[data-empty-query]").textContent = query;
  }

  countEl.textContent = query
    ? `${visible.length} of ${items.length} matching “${query}”`
    : `${items.length} ${items.length === 1 ? "result" : "results"}`;

  chipRow.querySelectorAll(".page-chip").forEach((chip) => {
    chip.dataset.active = String(
      chip.dataset.value.toLowerCase() === query.trim().toLowerCase()
    );
  });

  clearBtn.hidden = !query;
  revealCards();
}

/** Headline and intro are editable too, so they come from the store as well. */
function renderCopy() {
  const copy = getCollection("copy")[page];
  if (!copy) return;
  const title = document.querySelector("#page-title");
  const intro = document.querySelector("#page-intro");
  if (copy.title) title.textContent = copy.title;
  if (copy.intro) intro.textContent = copy.intro;
}

function renderChips() {
  const values = shape.chips(items);
  const html = values
    .map((v) => `<button class="page-chip" type="button" data-value="${esc(v)}">${esc(v)}</button>`)
    .join("");
  // Skip identical rebuilds: a snapshot that changed nothing must not wipe
  // the chip row out from under keyboard focus.
  if (chipRow.__lastMarkup === html) return;
  chipRow.__lastMarkup = html;
  chipRow.innerHTML = html;
}

/** Keeps the URL shareable: the search you see is the search you can send. */
function setQuery(next, { push = true } = {}) {
  query = next;
  if (input.value !== next) input.value = next;
  if (push) {
    const url = new URL(location.href);
    if (next) url.searchParams.set("q", next);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  }
  render();
}

/* --------------------------------------------------------- scroll reveal */

let revealObserver = null;

function revealCards() {
  if (!revealObserver) return;
  document.querySelectorAll(".reveal:not([data-shown])").forEach((el) => {
    revealObserver.observe(el);
  });
}

function setupReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Only hide things once we know we can bring them back.
  document.body.classList.add("reveal-ready");
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        // Stagger within a batch so a grid row arrives as a wave, not a flash.
        const delay = Math.min(i * 70, 350);
        setTimeout(() => { entry.target.dataset.shown = "true"; }, delay);
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
}

/* ------------------------------------------------------------------ wiring */

export function routeAction(action) {
  if (!action) return;
  if (action.kind === "page") {
    // `open` asks the destination page to show that record's panel on arrival.
    const params = new URLSearchParams();
    if (action.q) params.set("q", action.q);
    if (action.open) params.set("open", "1");
    const query = params.toString();
    location.href = query ? `${action.page}.html?${query}` : `${action.page}.html`;
    return;
  }
  if (action.kind === "home") { location.href = "index.html"; return; }
  if (action.kind === "contact") { openInfo("contact"); return; }
  // Legacy: scene actions targeted anchors inside the old homepage, which no
  // longer exist. Anything still emitting one lands on the homepage proper.
  if (action.kind === "scene") { location.href = "index.html"; return; }
  if (action.kind === "service") { location.href = "services.html"; return; }
  if (action.kind === "whatsapp") openWhatsApp(buildWhatsAppUrl(action.intent));
}

createNavigation({
  nav: document.querySelector("#site-nav"),
  drawer: document.querySelector("#nav-drawer"),
  drawerBody: document.querySelector("#nav-drawer-body"),
  toggle: document.querySelector("#nav-toggle"),
  onAction: routeAction,
});

/* The MICE page carries a strip of what is handled on any booking. Rendered
   here rather than hardcoded so the list lives with the rest of the data. */
const miceServices = document.querySelector("#mice-services-list");
if (miceServices) {
  miceServices.innerHTML = MICE_SERVICES.map((s) => `<li>${esc(s)}</li>`).join("");
}

/* ------------------------------------------------------- couldn't-find CTA */

/**
 * The last thing on every catalogue page: an admission that the list is not
 * the whole world, and a door. The noun changes with the page; the admin can
 * replace the whole line per page under Page copy.
 */
const NOT_FOUND_NOUN = {
  visa: "visa", packages: "package", activities: "activity",
  destinations: "destination", services: "service", mice: "MICE service",
};

(function renderNotFound() {
  const footer = document.querySelector(".page-footer");
  if (!footer) return;
  const noun = NOT_FOUND_NOUN[page] ?? "trip";
  // Stored copy may predate this field; the default steps in underneath.
  const line = getCollection("copy")[page]?.notFound
    || `Couldn\u2019t find your desired ${noun}?`;
  const block = document.createElement("section");
  block.className = "page-notfound";
  block.setAttribute("aria-label", "Contact us");
  block.innerHTML = `
    <p class="page-notfound-line">${esc(line)}</p>
    <button class="page-notfound-btn" type="button">Contact us on WhatsApp — we\u2019ll check for you</button>`;
  block.querySelector("button").addEventListener("click", () => {
    track("not_found_contact", { collection: page });
    openWhatsApp(buildWhatsAppUrl(
      `Hi BGS Travel & Tourism, I couldn't find the ${noun} I'm looking for on the site — can you help?`
    ));
  });
  footer.before(block);
})();

const footerContact = document.querySelector("#footer-contact");
if (footerContact) footerContact.innerHTML = contactStripMarkup();

setupReveal();
// Observe the cards that are already on the page. Without this, the initial
// render — which happens before the observer exists — was never watched, so
// the first paint's cards only animated after the Firestore snapshot forced a
// re-render, and sat at opacity 0 until it arrived.
revealCards();

/* A timer sweep behind the observer, same reasoning as the homepage engine:
   IntersectionObserver delivery is suspended in hidden and heavily throttled
   documents, and a card that starts at opacity 0 with nobody watching for it
   stays invisible. Timers are the one thing such renderers still run. The
   sweep shows whatever is inside the viewport, staggers it like the observer
   would, and retires after ~10 seconds — scrolling in a live document keeps
   the observer path in charge. */
(function sweepReveals() {
  let ticks = 0;
  const sweep = setInterval(() => {
    const vh = innerHeight || document.documentElement.clientHeight || 900;
    let i = 0;
    document.querySelectorAll(".reveal:not([data-shown])").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.95 && r.bottom > 0) {
        const delay = Math.min(i++ * 70, 350);
        setTimeout(() => { el.dataset.shown = "true"; }, delay);
      }
    });
    ticks += 1;
    if (ticks > 14 || !document.querySelector(".reveal:not([data-shown])")) {
      clearInterval(sweep);
    }
  }, 700);
})();
renderCopy();
renderChips();
setQuery(query, { push: false });

/**
 * A dropdown item that names one record asks for its panel on arrival. Matched
 * on the record's own title rather than on the result count, so a search that
 * happens to return one row does not pop a panel at somebody typing — and it
 * runs once, here, rather than on every re-render.
 */
if (new URLSearchParams(location.search).get("open") === "1") {
  const wanted = query.trim().toLowerCase();
  const match = visibleItems.find(
    (item) => itemTitle(item, page).trim().toLowerCase() === wanted
  );
  if (match) openItem(match, page);
}

let searchTimer = null;
input.addEventListener("input", () => {
  setQuery(input.value);
  // Debounced, because one row per keystroke is noise, not data.
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const term = input.value.trim();
    if (term.length > 2) {
      /* The term itself stays on this machine. A search box is free text and
         people type things about themselves into it; what is actually useful
         to know is that a search happened and whether it found anything. */
      track("search", {
        collection: page,
        length: term.length,
        results: visibleItems.length,
        found: visibleItems.length > 0,
      });
    }
  }, 900);
});
clearBtn.addEventListener("click", () => { setQuery(""); input.focus(); });

chipRow.addEventListener("click", (event) => {
  const chip = event.target.closest(".page-chip");
  if (!chip) return;
  // Clicking the active chip clears it, so chips toggle rather than trap.
  setQuery(chip.dataset.active === "true" ? "" : chip.dataset.value);
});

/* A card opens its detail panel. The WhatsApp enquiry moved inside that panel,
   so it happens after someone has read the detail rather than instead of it. */
/* Every card leans toward the cursor — the same engine the homepage uses. */
enableTilt(grid, ".item-card");

grid.addEventListener("click", (event) => {
  const card = event.target.closest(".item-card");
  if (!card) return;
  if (event.target.closest(".item-card-link")) event.preventDefault();
  /* A held server card carries no idx (the local model was staler than the
     DOM). Resolve it by title; a record the model doesn't know yet falls
     through to the card's own item-page link. */
  const item = card.dataset.idx !== undefined
    ? visibleItems[Number(card.dataset.idx)]
    : items.find((i) => itemTitle(i, page) === card.dataset.title);
  if (!item) {
    const link = card.querySelector(".item-card-link");
    if (link) window.location.href = link.href;
    return;
  }
  track("item_opened", { collection: page, item: itemTitle(item, page) });
  if (page === "services" && SERVICE_PAGE[item.key]) {
    location.href = `${SERVICE_PAGE[item.key]}.html`;
    return;
  }
  openItem(item, page);
});

/* No grid keydown handler: keyboard activation is the inner link's native
   Enter, which fires a click that the delegated handler above intercepts. */

// The admin saves to the same store; this is what makes an edit appear on an
// open page without a refresh.
subscribe(() => {
  items = getCollection(page);
  renderCopy();
  renderChips();
  render();
});


/* ---------------------------------------------------- mobile category strip */

/**
 * The categories, on a phone, on every page.
 *
 * Above 760px the header row lists them already. Below it the row is gone and
 * the only way across the site is the menu icon, so reaching Packages from Visa
 * costs two taps and a read. This is the same strip the homepage carries,
 * brought to the pages where somebody is actually browsing.
 *
 * Built from buildPrimaryNav, like the header and the drawer, so it cannot
 * offer a category that no longer exists.
 */
function renderPageCategories() {
  const strip = document.querySelector("#page-categories");
  if (!strip) return;
  strip.innerHTML = buildPrimaryNav()
    .map((menu) => {
      // The page you are on is marked rather than removed: a gap where one
      // category should be is harder to read than a highlighted one, and it
      // keeps the strip the same width on every page.
      const here = menu.page === page;
      return `<a class="page-category" href="${menu.page}.html"${
        here ? ' data-here="true" aria-current="page"' : ""}>${menu.label}</a>`;
    })
    .join("");
}

/* The header is sticky, so the strip has to know how tall it is to sit under
   it rather than behind it. Remeasured on resize because the pill wraps at
   narrow widths. */
function placePageCategories() {
  const header = document.querySelector(".site-header");
  const strip = document.querySelector("#page-categories");
  if (!header || !strip) return;
  document.documentElement.style.setProperty(
    "--page-cat-top", `${Math.round(header.getBoundingClientRect().height) + 12}px`
  );
}

renderPageCategories();
placePageCategories();
subscribe(renderPageCategories);
window.addEventListener("resize", placePageCategories);
