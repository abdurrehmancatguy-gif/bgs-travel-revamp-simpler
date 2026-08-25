/**
 * Turns a content record into HTML a crawler can read without running any
 * JavaScript. The browser still re-renders these grids on load — this exists so
 * that an answer engine, which mostly does not execute JS, sees the catalogue
 * rather than an empty <ul>.
 */

export const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const slug = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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

/** A card, with a real link so the item page is reachable by crawling. */
export function cardHtml(item, collection) {
  const s = SHAPE[collection];
  const title = s.title(item);
  const image = typeof item.image === "string" ? item.image : item.image?.src;
  const facts = s.facts(item).filter(([, v]) => v);
  return `<li class="item-card" data-title="${esc(title)}">
      ${image ? `<div class="item-card-media"><img src="${esc(image)}" alt="${esc(title)}" loading="lazy" /></div>` : ""}
      <div class="item-card-inner">
        ${s.kicker(item) ? `<p class="item-card-kicker">${esc(s.kicker(item))}</p>` : ""}
        <h3><a class="item-card-link" href="/${itemPath(item, collection)}">${esc(title)}</a></h3>
        <p>${esc(item.blurb || item.shortDescription || "")}</p>
        ${facts.length ? `<p class="item-card-meta">${
          facts.map(([, v]) => `<span>${esc(v)}</span>`).join("")}</p>` : ""}
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
    ...(item.image ? { image: typeof item.image === "string" ? item.image : item.image.src } : {}),
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
