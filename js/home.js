import { getCollection, subscribe } from "./store.js?v=225";
import "./info-modal.js?v=225";
import { contactStripMarkup, openInfo } from "./info-modal.js?v=225";
import { createNavigation } from "./navigation.js?v=225";
import { buildPrimaryNav } from "./nav-model.js?v=225";
import { resolvePill, HOME_COPY } from "../data/home.js?v=225";
import { resolveHomeCards, withSlugs, CARD_TITLE_KEY, priceFacts } from "../data/packages.js?v=225";
import { icon } from "../data/icons.js?v=225";
import { openItem } from "./item-dialog.js?v=225";
import { openWhatsApp, buildCustomTripUrl, buildWhatsAppUrl, WHATSAPP_DISPLAY } from "../utils/whatsapp.js?v=225";
import "./smooth-scroll.js?v=225";
import { enableTilt } from "./tilt.js?v=225";
import { cardSrc } from "../utils/images.js?v=225";
import { stripIndex } from "../utils/text.js?v=225";
import { enableCategoryRail } from "./category-rail.js?v=225";

/**
 * The homepage. Everything on it renders from the store, so an edit made in
 * the admin — a pill, a card, a service, a new destination — appears here
 * without anyone touching this file.
 *
 * Motion policy: reveals and the counters run once, driven by
 * IntersectionObserver; the arch parallax is one transform on one element per
 * frame; the wheel smoothing lives in smooth-scroll.js. Nothing loops forever
 * except the marquee, which is CSS and pausable by prefers-reduced-motion.
 */

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

/* Reveal styling only exists once this class is present, so a visitor without
   JavaScript gets the finished page rather than one stuck at opacity 0. */
document.documentElement.classList.add("hm-js");

/* ---------------------------------------------------------------- routing */

function routeAction(action) {
  if (!action) return;
  if (action.kind === "page") {
    const params = new URLSearchParams();
    if (action.q) params.set("q", action.q);
    if (action.open) params.set("open", "1");
    const query = params.toString();
    location.href = query ? `${action.page}.html?${query}` : `${action.page}.html`;
    return;
  }
  if (action.kind === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  if (action.kind === "contact") { openInfo("contact"); return; }
  // Legacy scene actions from anything not yet updated land on the journeys.
  if (action.kind === "scene") { location.href = "#journeys"; return; }
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

/* ------------------------------------------------------------ low power */

/**
 * A phone with four cores or 4GB is not a laptop, and the browser will tell
 * us. Decoration that costs a frame — the glass blurs, the deep shadows, the
 * scroll parallax, the hover tilt — comes off on that hardware rather than
 * being paid for on the devices least able to afford it.
 *
 * deviceMemory is Chromium-only and hardwareConcurrency is not a benchmark,
 * so this is a hint, not a verdict: everything it disables is decorative and
 * the page is complete without any of it.
 */
const lowPower =
  (navigator.hardwareConcurrency ?? 8) <= 4 ||
  (navigator.deviceMemory ?? 8) <= 4;
if (lowPower) document.documentElement.classList.add("low-power");

/* ------------------------------------------------- mobile category strip */

function renderPageCategories() {
  const strip = document.querySelector("#page-categories");
  if (!strip) return;
  strip.innerHTML = buildPrimaryNav()
    .map((menu) => `<a class="page-category" href="${menu.page}.html">${esc(menu.label)}</a>`)
    .join("");
}

function placePageCategories() {
  const header = document.querySelector(".site-header");
  const strip = document.querySelector("#page-categories");
  if (!header || !strip) return;
  document.documentElement.style.setProperty(
    "--page-cat-top", `${Math.round(header.getBoundingClientRect().height) + 12}px`
  );
}

/* ------------------------------------------------------------ hero pills */

/**
 * Replace a container's markup only when it actually changed. The Firestore
 * snapshot fires right after every page load and again on every admin save;
 * rebuilding identical DOM would throw keyboard focus (and any open state)
 * out of the region for nothing.
 */
function setIfChanged(el, html) {
  if (el.__lastMarkup === html) return false;
  el.__lastMarkup = html;
  el.innerHTML = html;
  return true;
}

function renderHeroPills() {
  const wrap = document.querySelector(".hero-pills");
  if (!wrap) return;
  const pills = getCollection("homePills");
  if (!pills.length) return;   // keep the pre-rendered buttons over a blank row
  setIfChanged(wrap, pills.map((pill) => {
    const t = resolvePill(pill, (c) => getCollection(c));
    if (!t || !t.label) return "";
    // "MICE" is trade jargon; the pill is where most visitors first meet it,
    // so the pill itself carries the expansion (visible label kept first).
    const mice = /\bMICE\b/.test(t.label)
      ? ` title="MICE: Meetings, Incentives, Conferences and Exhibitions"
          aria-label="${esc(t.label)}: Meetings, Incentives, Conferences and Exhibitions"`
      : "";
    return `<button class="hero-pill" type="button"
            data-page="${esc(t.page)}" data-query="${esc(t.query)}"
            data-open="${t.open ? "1" : ""}"${mice}>${esc(t.label)}</button>`;
  }).join(""));
}

document.querySelector(".hero-pills")?.addEventListener("click", (event) => {
  const pill = event.target.closest(".hero-pill");
  if (!pill) return;
  const { page, query, open } = pill.dataset;
  if (!page) { openWhatsApp(buildCustomTripUrl()); return; }
  // The page name comes from the store, which the admin writes — treat it as
  // data. Only a plain page word may reach location.href; anything else (a
  // path, a scheme, a stray URL someone pasted into the admin) is refused.
  if (!/^[a-z][a-z-]*$/.test(page)) return;
  location.href = query
    ? `${page}.html?q=${encodeURIComponent(query)}${open === "1" ? "&open=1" : ""}`
    : `${page}.html`;
});

/* ----------------------------------------------------------------- cards */

/** One line of fact per card: a visa shows its validity, a package its
 *  length — the same choice the old carousel settled on, kept because it is
 *  the short fact a browser actually compares. */
function cardMeta(record, kind) {
  if (kind === "visa") {
    const validity = record.validity;
    return validity && !/^n\/?a$/i.test(String(validity).trim()) ? validity : "";
  }
  const price = priceFacts(record)[0]?.[1];
  return [record.duration, price ? `From ${price}` : ""].filter(Boolean).join(" · ");
}

let homeCards = [];

function renderCards() {
  const rail = document.querySelector("#hm-cards");
  if (!rail) return;
  homeCards = withSlugs(resolveHomeCards(getCollection("homeCards"), (c) => getCollection(c)));

  const cards = homeCards.map((record, i) => {
    const kind = record.__collection ?? "packages";
    const title = record[CARD_TITLE_KEY[kind] ?? "title"] ?? "";
    const image = typeof record.image === "string" ? record.image : record.image?.src;
    const kicker = record.category || record.country || record.region || "";
    const meta = cardMeta(record, kind);
    return `
      <button class="hm-card hm-reveal" type="button" data-idx="${i}"
              style="--d:${Math.min(i * 80, 480)}ms"
              aria-label="${esc(title)}, open details">
        ${image ? `<span class="hm-card-media"><img src="${esc(cardSrc(image))}" alt=""
            loading="${i < 2 ? "eager" : "lazy"}" decoding="async" /></span>` : ""}
        <span class="hm-card-body">
          ${kicker ? `<span class="hm-card-kicker">${esc(kicker)}</span>` : ""}
          <span class="hm-card-title">${esc(title)}</span>
          ${meta ? `<span class="hm-card-meta">${esc(meta)}</span>` : ""}
        </span>
      </button>`;
  }).join("");

  /* The end of the rail is a door, not a wall: scrolling past the last
     journey lands on somewhere to go rather than on empty track. */
  const endLabel = homeCopy().journeysEndLabel || "View all";
  const end = `
    <a class="hm-card hm-card-all hm-reveal" href="destinations.html"
       style="--d:${Math.min(homeCards.length * 80, 480)}ms">
      <span class="hm-card-all-inner">
        <span class="hm-card-all-label">${esc(endLabel)}</span>
        <span class="hm-card-all-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </span>
    </a>`;

  if (setIfChanged(rail, cards + end)) observeReveals(rail);
}

/* ------------------------------------------------- rail arrows and the loop */

(() => {
  const rail = document.querySelector("#hm-cards");
  if (!rail) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const step = () => {
    const card = rail.querySelector(".hm-card");
    return card ? card.getBoundingClientRect().width + 18 : 320;
  };
  const nudge = (dir) =>
    rail.scrollBy({
      left: dir * step(),
      behavior: reduceMotion.matches ? "auto" : "smooth",
    });
  const prev = document.querySelector("#hm-cards-prev");
  const next = document.querySelector("#hm-cards-next");
  prev?.addEventListener("click", () => nudge(-1));
  next?.addEventListener("click", () => nudge(1));

  /* The rail runs out at both ends now, so an arrow that cannot move says
     so — disabled rather than hidden, because a control that vanishes and
     returns as you scroll is harder to aim at than one that greys out. */
  const syncArrows = () => {
    const room = rail.scrollWidth - rail.clientWidth;
    /* Scroll snapping parks the rail a few pixels off a true zero, so "at the
       start" needs a tolerance — well under a card width, which is the
       smallest real move either arrow can make. */
    const EDGE = 12;
    if (prev) prev.disabled = room < EDGE || rail.scrollLeft <= EDGE;
    if (next) next.disabled = room < EDGE || rail.scrollLeft >= room - EDGE;
  };
  rail.addEventListener("scroll", syncArrows, { passive: true });
  window.addEventListener("resize", syncArrows);
  new MutationObserver(syncArrows).observe(rail, { childList: true });
  syncArrows();
})();

document.querySelector("#hm-cards")?.addEventListener("click", (event) => {
  const card = event.target.closest(".hm-card");
  if (!card) return;
  const record = homeCards[Number(card.dataset.idx)];
  if (record) openItem(record, record.__collection ?? "packages");
});

/* ------------------------------------------------------------------ tilt */

enableTilt(document.querySelector("#hm-cards"), ".hm-card");
enableTilt(document.querySelector("#hm-services"), ".hm-service");

/* -------------------------------------------------------------- services */

/* Each tile opens that service's master page — see servicePath in
   js/category-page.js for why all six go to the same kind of place. */
const servicePath = (key) => `/services/${key}/`;

function renderServices() {
  const list = document.querySelector("#hm-services");
  if (!list) return;
  const changed = setIfChanged(list, getCollection("services").map((service, i) => `
    <li class="hm-service hm-reveal" style="--d:${Math.min(i * 70, 420)}ms">
      <a class="hm-service-cover"
         href="${service.key ? servicePath(service.key) : "/services.html"}"
         aria-label="${esc(service.label)}"></a>
      <span class="hm-service-icon" aria-hidden="true">${icon(service.icon)}</span>
      <h3>${esc(service.label)}</h3>
      <p>${esc(service.blurb ?? "")}</p>
    </li>`).join(""));
  if (changed) observeReveals(list);
}

/* ------------------------------------------------------------------- faq */

/** "Question | Answer" lines from the editable copy, as native disclosure
 *  widgets. A line without a pipe is skipped rather than shown half-made. */
function renderFaq() {
  const wrap = document.querySelector("#hm-faq");
  if (!wrap) return;
  const items = (homeCopy().faq ?? [])
    .map((line) => {
      const [q, ...rest] = String(line).split("|");
      const a = rest.join("|").trim();
      return q.trim() && a ? [q.trim(), a] : null;
    })
    .filter(Boolean);
  wrap.closest("section")?.toggleAttribute("hidden", !items.length);
  const changed = setIfChanged(wrap, items.map(([q, a], i) => `
    <details class="hm-faq-item hm-reveal" style="--d:${Math.min(i * 60, 300)}ms">
      <summary>${esc(q)}<span class="hm-faq-mark" aria-hidden="true"></span></summary>
      <p>${esc(a)}</p>
    </details>`).join(""));
  if (changed) observeReveals(wrap);
}

/* -------------------------------------------------------------- ask form */

document.querySelector("#hm-cform")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#hm-cform-name");
  const msg = document.querySelector("#hm-cform-msg");
  const note = document.querySelector("#hm-cform-note");
  const missing = [name, msg].filter((el) => !el.value.trim());
  missing.forEach((el) => el.setAttribute("aria-invalid", "true"));
  [name, msg].filter((el) => el.value.trim()).forEach((el) => el.removeAttribute("aria-invalid"));
  if (missing.length) {
    note.textContent = "Your name and a line about what you need. That's all.";
    note.dataset.error = "true";
    missing[0].focus();
    return;
  }
  note.textContent = `Opening WhatsApp (${WHATSAPP_DISPLAY})…`;
  delete note.dataset.error;
  openWhatsApp(buildWhatsAppUrl(
    `Hi BGS Travel & Tourism, I'm ${name.value.trim()}. ${msg.value.trim()}`
  ), "ask_form");
});

/* --------------------------------------------------------------- marquee */

function renderMarquee() {
  const track = document.querySelector("#hm-marquee-track");
  if (!track) return;
  // Typed names win; an empty list means the catalogue speaks for itself.
  const typed = (homeCopy().marqueeNames ?? []).filter(Boolean);
  const names = typed.length
    ? typed
    : getCollection("destinations").map((d) => d.name).filter(Boolean);
  const wrap = track.closest(".hm-marquee");
  if (!names.length) { wrap?.setAttribute("hidden", ""); return; }
  // Cleared as well as set: an admin emptying and refilling the destinations
  // would otherwise leave the strip hidden forever.
  wrap?.removeAttribute("hidden");
  loopTrack(track, names.map((n) => `<span>${esc(n)}</span><i>✦</i>`).join(""), 70);
}

/* --------------------------------------------------------------- reveals */

/**
 * Scroll-driven, not IntersectionObserver. IO is the fashionable tool here,
 * but its delivery is suspended whenever the document is hidden or throttled
 * — which left every section below the fold at opacity 0 in exactly the
 * renderers that can't recover from it. A rect check on scroll is boring,
 * cheap (one pass, rAF-batched, elements leave the list once shown), and
 * cannot fail to run wherever scrolling itself runs.
 */
function checkReveals() {
  const vh = innerHeight || document.documentElement.clientHeight || 900;
  document.querySelectorAll(".hm-reveal:not(.is-in)").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92 && r.bottom > 0) {
      el.classList.add("is-in");
    }
  });
}

/* Directly, not batched through requestAnimationFrame: frames stop whenever
   the document is hidden or throttled, and a reveal check that waits for one
   inherits every failure the IntersectionObserver version had. The pass is a
   handful of rect reads over elements that leave the list once shown — cheap
   enough to run as the events arrive. */
window.addEventListener("scroll", checkReveals, { passive: true });
window.addEventListener("resize", checkReveals);

/* And a slow timer sweep behind the events. Some renderers — backgrounded
   panes, certain headless browsers — move the scroll position without ever
   dispatching a scroll event or an animation frame; timers are the one thing
   they all still run. The sweep retires itself once everything is shown and
   is restarted by any render that adds new elements. */
let revealSweep = null;
let sweepTicks = 0;

function startRevealSweep() {
  if (revealSweep !== null) return;
  sweepTicks = 0;
  revealSweep = setInterval(() => {
    checkReveals();
    sweepTicks += 1;
    // Retire when everything is shown — or after ~10 seconds regardless. The
    // sweep exists for renderers that deliver no events at all, and those
    // only ever see the first viewport; polling layout forever on behalf of
    // sections a real visitor will scroll to anyway is pure waste.
    if (sweepTicks > 14 || !document.querySelector(".hm-reveal:not(.is-in)")) {
      clearInterval(revealSweep);
      revealSweep = null;
    }
  }, 700);
}

/* Renders call this after writing new .hm-reveal elements. */
function observeReveals() { checkReveals(); startRevealSweep(); }

startRevealSweep();

/**
 * The stored homeCopy with the shipped defaults underneath it. An admin who
 * saved before a field existed has a stored object without it, and letting
 * that object replace the defaults wholesale silently blanks every newer
 * feature — which is exactly how the stats band vanished the day it became
 * editable.
 */
const homeCopy = () => {
  const copy = { ...HOME_COPY, ...getCollection("homeCopy") };
  /* Section labels are not numbered. The saved copy still carries the old
     "01 …" prefixes, and saved copy wins over defaults, so the rule is
     applied on read rather than left waiting for six fields to be re-typed. */
  for (const key of Object.keys(copy)) {
    if (key.endsWith("Eyebrow")) copy[key] = stripIndex(copy[key]);
  }
  return copy;
};

/* ----------------------------------------------------------------- tokens */

/** The numbers the editable text may embed. Counted from the catalogue —
 *  the one part of any sentence the admin cannot type. */
function tokenCounts() {
  return {
    visas: getCollection("visa").length,
    destinations: getCollection("destinations").length,
    journeys: getCollection("packages").length + getCollection("activities").length,
  };
}

/* ------------------------------------------------------------------ loops */

/**
 * Fills a marquee track until the loop is seamless.
 *
 * The CSS animates the track to -50%, which is only gapless when the first
 * half is at least as wide as the container — true for fifteen destination
 * names, false for four short badges on a wide screen, where the strip ran
 * out of pills and visibly "ended" before restarting. So the run is repeated
 * until one half covers the container, and the duration is set from the
 * distance so the speed stays constant no matter how much content the admin
 * puts in.
 *
 * Re-run on resize and after the webfont lands, both of which change widths.
 */
function loopTrack(track, runHtml, pxPerSec) {
  if (!track || !runHtml) return;
  // A snapshot that changed nothing must not restart the loop mid-glide.
  // The key carries the container width (resize re-runs) and the font-load
  // state (the fonts.ready re-measure still happens exactly once).
  const key = `${runHtml}|${track.parentElement.clientWidth}|${document.fonts?.status ?? ""}`;
  if (track.__loopKey === key) return;
  track.__loopKey = key;
  track.style.animation = "none";
  track.innerHTML = runHtml;
  const runWidth = track.scrollWidth;
  const container = track.parentElement.clientWidth || innerWidth || 1600;
  if (!runWidth) { track.innerHTML = runHtml + runHtml; track.style.animation = ""; return; }
  const copies = Math.max(1, Math.ceil(container / runWidth));
  const half = runHtml.repeat(copies);
  track.innerHTML = half + half;
  // Shorthand first, longhand second: clearing `animation` resets every
  // animation-* longhand, so a duration set before it would be wiped.
  track.style.animation = "";
  track.style.animationDuration = `${Math.round((runWidth * copies) / pxPerSec)}s`;
}

let loopResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(loopResizeTimer);
  loopResizeTimer = setTimeout(() => { renderTicker(); renderMarquee(); }, 200);
});
/* The serif loads late and reflows every width the loops just measured. */
document.fonts?.ready.then(() => { renderTicker(); renderMarquee(); }).catch(() => {});

/* ------------------------------------------------------------------- copy */

/**
 * Applies the editable text to every element that declares a hook. One
 * attribute, one field, no element-by-element wiring — adding an editable
 * line to the page is a data-hc attribute plus a default in data/home.js.
 */
function renderHomeCopy() {
  const copy = homeCopy();
  document.querySelectorAll("[data-hc]").forEach((el) => {
    const value = copy[el.dataset.hc];
    if (typeof value === "string" && value.trim()) el.textContent = value;
  });
}

/* ----------------------------------------------------------------- ticker */

/**
 * The badge strip over the hero. Counts come from the catalogue and the rest
 * are plain statements of how the business works — nothing here is a metric
 * nobody measured. Decorative (aria-hidden): the same facts appear as real
 * text in the stats band and footer.
 */
/**
 * An icon for a badge, chosen from what the badge says.
 *
 * The pills are free text an admin types, so nothing can be keyed off an id —
 * the words themselves are all there is. First match wins, and the order
 * matters where a phrase could belong to two families: "Private Excursions"
 * is an excursion before it is anything private.
 */
const TICKER_ICONS = [
  [/visa/i, "visa"],
  [/flight|airline|fly|global travel/i, "flights"],
  [/hotel|stay|resort|lodge/i, "hotels"],
  [/transport|transfer|driver|fleet|coach/i, "transport"],
  [/team|concierge|end to end|on call/i, "concierge"],
  [/mice|meeting|conference|corporate|exhibition|incentive/i, "conference"],
  [/desert|dune|safari/i, "desert"],
  [/beach|island|coast|cruise|dhow|water/i, "water"],
  [/family|kids/i, "family"],
  [/culture|cultural|heritage|historic/i, "cultural"],
  [/excursion|activit|experience|tour/i, "activities"],
  [/vip|v\.i\.p|luxury|exclusive|premium|private/i, "luxury"],
];

const tickerIcon = (text) =>
  (TICKER_ICONS.find(([pattern]) => pattern.test(text)) ?? [null, "pin"])[1];

function renderTicker() {
  const track = document.querySelector("#hm-ticker-track");
  if (!track) return;
  /* Every pill comes from the editable list; {visas} and {destinations}
     expand to live counts. A pill whose count expands to zero is dropped
     rather than shown as "0 visa services". */
  const counts = tokenCounts();
  const badges = (homeCopy().tickerPhrases ?? [])
    .map((line) => {
      let dead = false;
      const text = String(line).replace(/\{(visas|destinations|journeys)\}/g, (_, key) => {
        if (!counts[key]) dead = true;
        return counts[key];
      });
      return dead ? "" : text.trim();
    })
    .filter(Boolean);
  loopTrack(track, badges.map((b) =>
    `<span><span class="hm-ticker-icon" aria-hidden="true">${icon(tickerIcon(b))}</span>${esc(b)}</span>`
  ).join(""), 42);
}

/* ------------------------------------------------------------- lead form */

/**
 * The hero card. There is no backend and none is pretended: submitting
 * composes a WhatsApp message carrying the two answers, which is where every
 * enquiry already lands. The destination list offers the catalogue but
 * accepts anything — somebody heading somewhere we have not written up yet
 * is exactly the enquiry worth having.
 */
function fillDestinationList() {
  const list = document.querySelector("#hm-dest-list");
  if (!list) return;
  const names = new Set([
    ...getCollection("destinations").map((d) => d.name),
    ...getCollection("visa").map((v) => v.country),
  ]);
  list.innerHTML = [...names].filter(Boolean).sort()
    .map((n) => `<option value="${esc(n)}"></option>`).join("");
}

document.querySelector("#hm-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#hm-form-name");
  const dest = document.querySelector("#hm-form-dest");
  const note = document.querySelector("#hm-form-note");
  const missing = [name, dest].filter((el) => !el.value.trim());
  missing.forEach((el) => el.setAttribute("aria-invalid", "true"));
  [name, dest].filter((el) => el.value.trim())
    .forEach((el) => el.removeAttribute("aria-invalid"));
  if (missing.length) {
    note.textContent = "Both fields, and we can start: name and destination.";
    note.dataset.error = "true";
    missing[0].focus();
    return;
  }
  note.textContent = `Opening WhatsApp (${WHATSAPP_DISPLAY})…`;
  delete note.dataset.error;
  openWhatsApp(buildWhatsAppUrl(
    `Hi BGS Travel & Tourism, I'm ${name.value.trim()}. ` +
    `I'd like to plan a trip to ${dest.value.trim()}. Please tell me what you need from me.`
  ), "hero_form");
});

/* ------------------------------------------------------------- cta list */

/** The checklist in the closing panel: the services, by name, from the
 *  catalogue — the reference site hand-writes this list, we already have it. */
function renderCtaList() {
  const list = document.querySelector("#hm-cta-list");
  if (!list) return;
  setIfChanged(list, getCollection("services")
    .map((service) => `<li>${esc(service.label)}</li>`).join(""));
}

/* ---------------------------------------------------------- arch parallax */

const archCity = document.querySelector("#hm-arch-city");
let parallaxQueued = false;

function parallax() {
  parallaxQueued = false;
  if (!archCity) return;
  // The city rises slightly slower than the page scrolls — depth, one line.
  const y = Math.min(window.scrollY, 900) * 0.08;
  archCity.style.transform = `translateY(${y}px) scale(1.04)`;
}

/* Desktop only. On a phone this writes a transform on the largest image on
   the page during the very gesture the visitor is judging the site by, and
   the effect — an 8% drift — is not what they are looking at. */
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
if (archCity && !reduceMotion.matches && finePointer.matches && !lowPower) {
  window.addEventListener("scroll", () => {
    if (!parallaxQueued) { parallaxQueued = true; requestAnimationFrame(parallax); }
  }, { passive: true });
}

/* ------------------------------------------------------------------- cta */

document.querySelector("#hm-plan")?.addEventListener("click", () => {
  openWhatsApp(buildCustomTripUrl());
});

document.querySelector("#hm-chat")?.addEventListener("click", () => {
  openWhatsApp(buildCustomTripUrl());
});

/* ---------------------------------------------------------------- footer */

const footerContact = document.querySelector("#footer-contact");
if (footerContact) footerContact.innerHTML = contactStripMarkup();

/* ------------------------------------------------------------------ init */

renderPageCategories();
enableCategoryRail();
placePageCategories();
renderHeroPills();
renderHomeCopy();
  renderPayments();
renderCards();
renderServices();
renderMarquee();
renderTicker();
renderCtaList();
renderFaq();
fillDestinationList();
observeReveals();

window.addEventListener("resize", placePageCategories);

/* ------------------------------------------------------------- payments */

/** The admin's badge list decides which payment icons show; an empty list
 *  hides the strip. Mirrored statically by build/build.mjs. */
function renderPayments() {
  const strip = document.querySelector(".hm-pay");
  if (!strip) return;
  const methods = (homeCopy().payMethods ?? [])
    .map((m) => String(m).trim().toLowerCase()).filter(Boolean);
  strip.toggleAttribute("hidden", !methods.length);
  strip.querySelectorAll("[data-pay]").forEach((img) => {
    img.toggleAttribute("hidden", !methods.includes(img.dataset.pay));
  });
}

/* One delayed pass catches anything the first paint raced past. */
setTimeout(checkReveals, 600);

/* The admin writes to the same store; re-render whatever it touched. */
subscribe(() => {
  renderPageCategories();
  renderHeroPills();
  renderHomeCopy();
  renderPayments();
  renderCards();
    renderServices();
  renderMarquee();
  renderTicker();
  renderCtaList();
  renderFaq();
  fillDestinationList();
});
