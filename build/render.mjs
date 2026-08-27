/**
 * Turns a content record into HTML a crawler can read without running any
 * JavaScript. The browser still re-renders these grids on load — this exists so
 * that an answer engine, which mostly does not execute JS, sees the catalogue
 * rather than an empty <ul>.
 */

import { cardSrc, fullSrc } from "../utils/images.js";

export const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * A title as a URL segment.
 *
 * The fallback matters: a title with no ASCII alphanumerics at all — "日本ビザ",
 * "★", "— —" — used to slug to the empty string, and an empty segment collapses
 * `visa/<slug>/` down to `visa/` itself. Verified: two such records both wrote
 * to dist/visa/index.html, the second silently overwriting the first, and the
 * sitemap gained two identical bogus URLs while the build reported success.
 * Hashing the original keeps such a record addressable and unique instead.
 */
export const slug = (s) => {
  const text = String(s ?? "");
  const out = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (out) return out;
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return `item-${h.toString(36)}`;
};

const money = (i) =>
  i?.price ? `${i.currency ?? "AED"} ${Number(i.price).toLocaleString("en-US")}` : "";

const expressMoney = (i) =>
  i?.expressPrice
    ? `${i.currency ?? "AED"} ${Number(i.expressPrice).toLocaleString("en-US")}`
    : "";

/**
 * One price row, or two when the rate sheet quoted both turnarounds. Mirrors
 * priceFacts in data/packages.js so the pre-rendered page and the live panel
 * say the same thing about the same visa.
 */
const priceRows = (i) => {
  const unit = (v) => (v ? `${v} ${i.priceUnit ?? ""}`.trim() : "");
  const normal = unit(money(i));
  const express = unit(expressMoney(i));
  // Mirrors priceFacts in data/packages.js: express wins where both exist.
  if (express) return [["Express", express]];
  if (normal) return [["Price", normal]];
  return [];
};

/**
 * What each collection calls its parts. Deliberately the same fields the
 * runtime SHAPE maps use, so a pre-rendered card and a JS-rendered one describe
 * the same record rather than drifting into two versions of the truth.
 */
export const SHAPE = {
  visa: {
    label: "Visa Services", dir: "visa",
    title: (i) => i.name,
    kicker: (i) => i.country,
    facts: (i) => [...priceRows(i),
                   ["Processing", i.processing], ["Validity", i.validity], ["Entry", i.visaType]],
  },
  packages: {
    label: "Travel Packages", dir: "packages",
    title: (i) => i.title,
    kicker: (i) => i.category,
    facts: (i) => [["Duration", i.duration], ["From", money(i) && `${money(i)} ${i.priceUnit ?? ""}`.trim()],
                   ["Destination", i.destination]],
  },
  activities: {
    label: "Activities & Experiences", dir: "activities",
    title: (i) => i.title,
    kicker: (i) => i.category,
    facts: (i) => [["Duration", i.duration], ["From", money(i) && `${money(i)} ${i.priceUnit ?? ""}`.trim()],
                   ["Where", i.destination]],
  },
  destinations: {
    label: "Destinations", dir: "destinations",
    title: (i) => i.name,
    kicker: (i) => i.region,
    facts: (i) => [["Best time to go", i.bestTime], ["Region", i.region]],
  },
  services: {
    label: "Services", dir: "services",
    title: (i) => i.label,
    kicker: () => "Service",
    facts: () => [],
  },
  mice: {
    label: "MICE & Corporate Travel", dir: "mice",
    title: (i) => i.name,
    kicker: () => "MICE",
    facts: () => [],
  },
};

/** Lists shown on a record, in this order, each skipped when empty. */
const LISTS = [["items", "What this covers"], ["highlights", "Highlights"],
               ["included", "What's included"], ["requirements", "What you'll need"]];

export const itemPath = (item, collection) =>
  `${SHAPE[collection].dir}/${slug(SHAPE[collection].title(item))}/`;

export const describe = (item) =>
  item.fullDescription || item.blurb || item.shortDescription || "";

/** A card, with a real link so the item page is reachable by crawling.
 *  `index` decides loading: ONLY the first image is eager and high-priority —
 *  it is the page's largest paint, and every other eager image on a slow
 *  connection is bandwidth taken from it (three extra eager cards measured
 *  +4s of modeled LCP). The rest stay lazy; on mobile they are all below
 *  the fold anyway. */
export function cardHtml(item, collection, index = Infinity) {
  const s = SHAPE[collection];
  const title = s.title(item);
  const image = typeof item.image === "string" ? item.image : item.image?.src;
  // Curated description when the record has one; empty otherwise — the h3
  // link beside it already carries the title, so repeating it says nothing.
  const imageAlt = (typeof item.image === "object" && item.image?.alt) || "";
  const facts = s.facts(item).filter(([, v]) => v);
  return `<li class="item-card" data-title="${esc(title)}">
      ${image ? `<div class="item-card-media"><img src="${esc(cardSrc(image))}" alt="${esc(imageAlt)}"${
        index === 0 ? ` loading="eager" fetchpriority="high"` : ` loading="lazy"`} decoding="async" /></div>` : ""}
      <div class="item-card-inner">
        ${s.kicker(item) ? `<p class="item-card-kicker">${esc(s.kicker(item))}</p>` : ""}
        <h3><a class="item-card-link" href="/${itemPath(item, collection)}">${esc(title)}</a></h3>
        <p>${esc(item.blurb || item.shortDescription || "")}</p>
        ${facts.length ? `<p class="item-card-meta">${
          facts.map(([k, v]) => `<span><span class="visually-hidden">${esc(k)}: </span>${esc(v)}</span>`).join("")}</p>` : ""}
      </div>
    </li>`;
}

/* ------------------------------------------------------------ structured data */

export function itemJsonLd(item, collection, url, org) {
  const s = SHAPE[collection];
  const title = s.title(item);
  const graph = [{
    "@type": collection === "destinations" ? "TouristDestination" : "Service",
    "@id": `${url}#item`,
    name: title,
    description: describe(item) || item.blurb,
    // Same bounded rendition the page and its social tags quote — a search
    // engine reading this should not be handed a multi-megabyte original.
    ...(item.image ? {
      image: fullSrc(typeof item.image === "string" ? item.image : item.image.src),
    } : {}),
    provider: { "@id": `${org}#org` },
    ...(item.price ? {
      offers: {
        "@type": "Offer", price: String(item.price),
        priceCurrency: item.currency ?? "AED", url,
        availability: "https://schema.org/InStock",
      },
    } : {}),
  }];

  // The document list answers "what do I need for X", which is the question an
  // answer engine is most likely to be asked about a visa.
  const reqs = Array.isArray(item.requirements) ? item.requirements.filter(Boolean) : [];
  if (reqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: [{
        "@type": "Question",
        name: `What documents are required for ${title}?`,
        acceptedAnswer: { "@type": "Answer", text: reqs.join(". ") + "." },
      },
      ...(item.processing ? [{
        "@type": "Question",
        name: `How long does ${title} take to process?`,
        acceptedAnswer: { "@type": "Answer", text: `Processing time: ${item.processing}.` },
      }] : []),
      ...(item.price ? [{
        "@type": "Question",
        name: `How much does ${title} cost?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${title} costs ${money(item)} ${item.priceUnit ?? ""}`.trim() + " through BGS Travel & Tourism.",
        },
      }] : [])],
    });
  }
  return graph;
}
