import { icon } from "../data/icons.js?v=193";
import { priceLabel, priceFacts } from "../data/packages.js?v=193";
import { openWhatsApp, buildWhatsAppItemUrl } from "../utils/whatsapp.js?v=193";

/**
 * The detail panel a card opens. One dialog, reused for every card on every
 * category page, built from whatever the record actually holds.
 *
 * The builder is deliberately field-driven rather than per-collection: a
 * section renders when its field has content and is skipped when it does not.
 * That is what lets the admin add "what you'll need" to a destination, or empty
 * the highlights on an activity, without this file knowing anything new — and
 * it is why an empty catalogue entry degrades to a short panel rather than a
 * scaffold of empty headings.
 *
 * The WhatsApp button stays the one conversion path, the way the card itself
 * used to be. The card now opens this instead, so the enquiry happens after
 * someone has read the detail rather than instead of reading it.
 */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * What each collection calls its title, its kicker and its facts. Everything
 * else — description, highlights, included, requirements — is read by the same
 * field names across all of them.
 */
const SHAPE = {
  activities: {
    title: (i) => i.title,
    kicker: (i) => i.category,
    facts: (i) => [
      ["Duration", i.duration], ["From", priceLabel(i)],
      ["Rating", i.rating ? `${Number(i.rating).toFixed(1)} ★` : ""],
      ["Where", i.destination],
    ],
  },
  packages: {
    title: (i) => i.title,
    kicker: (i) => i.category,
    facts: (i) => [
      ["Duration", i.duration], ["From", priceLabel(i)],
      ["Rating", i.rating ? `${Number(i.rating).toFixed(1)} ★` : ""],
      ["Where", i.destination],
    ],
  },
  destinations: {
    title: (i) => i.name,
    kicker: (i) => i.region,
    facts: (i) => [["Best time to go", i.bestTime], ["Region", i.region]],
  },
  services: {
    title: (i) => i.label,
    kicker: () => "Service",
    facts: () => [],
  },
  mice: {
    title: (i) => i.name,
    kicker: () => "MICE",
    facts: () => [],
  },
  visa: {
    title: (i) => i.name,
    kicker: (i) => i.country,
    // priceFacts spreads to one row or two depending on what the rate sheet
    // carried for this visa — see data/packages.js.
    facts: (i) => [
      ...priceFacts(i), ["Processing", i.processing],
      ["Validity", i.validity], ["Entry", i.visaType],
    ],
  },
};

/** Sections shown in this order, each skipped when its field is empty. */
const LISTS = [
  ["items", "What this covers"],
  ["highlights", "Highlights"],
  ["included", "What's included"],
  ["requirements", "What you'll need"],
];

/** What a record is called, per collection. Used to match a deep link. */
export const itemTitle = (item, collection) =>
  (item && SHAPE[collection] ? SHAPE[collection].title(item) : "") ?? "";

let dialog = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "item-dialog";
  dialog.id = "item-dialog";
  dialog.setAttribute("aria-labelledby", "item-dialog-title");
  document.body.append(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

const listMarkup = (values, heading) => `
  <section class="item-dialog-section">
    <h3>${esc(heading)}</h3>
    <ul class="item-dialog-list">
      ${values.map((v) => `<li>${esc(v)}</li>`).join("")}
    </ul>
  </section>`;

export function openItem(item, collection) {
  if (!item) return;
  const shape = SHAPE[collection];
  if (!shape) return;

  const el = ensureDialog();
  const title = shape.title(item) ?? "";
  const kicker = shape.kicker(item) ?? "";
  const image = typeof item.image === "string" ? item.image : item.image?.src;
  // Curated description when the record has one; otherwise empty — the h2
  // beside the photo already carries the title, repeating it as alt reads
  // "Desert Safari. Image, Desert Safari. Heading, Desert Safari."
  const imageAlt = (typeof item.image === "object" && item.image?.alt) || "";
  const body = item.fullDescription || item.blurb || item.shortDescription || "";
  const facts = shape.facts(item).filter(([, value]) => value);
  const tags = Array.isArray(item.tags) ? item.tags : [];

  el.innerHTML = `
    <article class="item-dialog-panel">
      <button class="item-dialog-close" type="button" data-item-close aria-label="Close">
        ${icon("close")}
      </button>

      ${image ? `<div class="item-dialog-media">
        <img src="${esc(image)}" alt="${esc(imageAlt)}" />
      </div>` : ""}

      <div class="item-dialog-body" role="region" aria-labelledby="item-dialog-title" tabindex="0">
        <header class="item-dialog-head">
          ${kicker ? `<p class="item-dialog-kicker">
            ${item.icon ? `<span class="item-dialog-icon" aria-hidden="true">${icon(item.icon)}</span>` : ""}
            ${esc(kicker)}
          </p>` : ""}
          <h2 id="item-dialog-title">${esc(title)}</h2>
        </header>

        ${facts.length ? `<dl class="item-dialog-facts">
          ${facts.map(([label, value]) => `
            <div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}
        </dl>` : ""}

        ${body ? `<p class="item-dialog-lede">${esc(body)}</p>` : ""}

        ${LISTS.map(([key, heading]) => {
          const values = Array.isArray(item[key]) ? item[key].filter(Boolean) : [];
          return values.length ? listMarkup(values, heading) : "";
        }).join("")}

        ${tags.length ? `<ul class="item-dialog-tags">
          ${tags.map((t) => `<li>${esc(t)}</li>`).join("")}
        </ul>` : ""}
      </div>

      <footer class="item-dialog-foot">
        <button class="item-dialog-cta" type="button" data-item-enquire>
          <span class="item-dialog-cta-icon" aria-hidden="true">${icon("whatsapp")}</span>
          <span>Buy Now on WhatsApp</span>
        </button>
      </footer>
    </article>`;

  el.querySelector("[data-item-close]").addEventListener("click", () => el.close());
  el.querySelector("[data-item-enquire]").addEventListener("click", () => {
    openWhatsApp(buildWhatsAppItemUrl(title));
  });

  el.showModal();
  el.querySelector(".item-dialog-body").scrollTop = 0;
}
