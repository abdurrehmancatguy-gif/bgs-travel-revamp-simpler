import { LEGAL_DOCS, LEGAL_LINKS, CONTACT_CHANNELS } from "../data/legal.js?v=219";
import { icon } from "../data/icons.js?v=219";

/**
 * The Contacts and legal panels. One <dialog> is built lazily and reused for
 * every document, so seven pages carry a button row rather than seven copies of
 * a modal.
 *
 * Native <dialog> rather than a hand-rolled overlay: it gives the top layer,
 * the backdrop, focus containment and Escape without any of it being this
 * file's problem. The only thing worth styling carefully is ::backdrop, since
 * the frosted panel needs something behind it to actually frost.
 *
 * Any element with data-info="privacy" opens the matching entry in LEGAL_DOCS,
 * so adding a document is a data change plus a button.
 */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let dialog = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "info-dialog";
  dialog.id = "info-dialog";
  dialog.setAttribute("aria-labelledby", "info-dialog-title");
  document.body.append(dialog);

  // Clicking the backdrop closes. The dialog element covers the whole viewport
  // while the panel inside does not, so a click landing on the dialog itself is
  // a click outside the panel.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

function contactMarkup(doc) {
  return `
    <p class="info-dialog-intro">${esc(doc.intro)}</p>
    <ul class="info-contact-list">
      ${CONTACT_CHANNELS.map((c) => `
        <li>
          <span class="info-contact-text">
            <span class="info-contact-label">${esc(c.label)}</span>
            ${c.href
              ? `<a class="info-contact-value" href="${esc(c.href)}"${
                  c.href.startsWith("http") ? ` target="_blank" rel="noopener"` : ""
                }>${esc(c.value)}</a>`
              : `<span class="info-contact-value">${esc(c.value)}</span>`}
            ${c.note ? `<span class="info-contact-note">${esc(c.note)}</span>` : ""}
          </span>
          ${c.icon ? `<span class="info-contact-icon" data-channel="${esc(c.key)}"
            aria-hidden="true">${icon(c.icon)}</span>` : ""}
        </li>`).join("")}
    </ul>`;
}

function documentMarkup(doc) {
  const sections = doc.sections ?? [];
  // The notices ship empty on purpose, so an unwritten one has to say so rather
  // than open as a blank pane that reads like a rendering fault.
  if (!sections.length && !doc.intro) {
    return `<p class="info-dialog-empty">This notice has not been published yet.</p>`;
  }
  return `
    ${doc.updated ? `<p class="info-dialog-updated">Last updated ${esc(doc.updated)}</p>` : ""}
    ${doc.intro ? `<p class="info-dialog-intro">${esc(doc.intro)}</p>` : ""}
    ${sections.map((section) => `
      <section class="info-dialog-section">
        <h3>${esc(section.heading)}</h3>
        ${section.body.map(blockMarkup).join("")}
      </section>`).join("")}`;
}

/** A body entry is a paragraph, or { list } for one of the bulleted runs. */
function blockMarkup(block) {
  if (typeof block === "string") return `<p>${esc(block)}</p>`;
  if (block?.list) {
    return `<ul class="info-dialog-list">${
      block.list.map((item) => `<li>${esc(item)}</li>`).join("")
    }</ul>`;
  }
  return "";
}

/**
 * Contact details and legal links as markup, shared by the page footers and
 * the drawer. Built from the same CONTACT_CHANNELS the Contacts panel reads,
 * so a phone number is never written down twice and cannot drift.
 */
export function contactStripMarkup() {
  const links = CONTACT_CHANNELS.filter((c) => c.href).map((c) =>
    '<a class="contact-strip-item" href="' + esc(c.href) + '"' +
    (c.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "") + '>' +
      '<span class="contact-strip-icon" data-channel="' + esc(c.key) + '" aria-hidden="true">' +
        icon(c.icon) + '</span>' +
      "<span>" + esc(c.value) + "</span>" +
    "</a>").join("");

  const legal = LEGAL_LINKS.map((l) =>
    '<button class="info-legal-link" type="button" data-info="' + l.key + '">' +
    esc(l.label) + "</button>").join("");

  return '<div class="contact-strip">' +
    '<div class="contact-strip-links">' + links + "</div>" +
    '<div class="contact-strip-legal">' + legal + "</div>" +
  "</div>";
}

export function openInfo(key) {
  const doc = LEGAL_DOCS[key];
  if (!doc) return;
  const el = ensureDialog();

  el.innerHTML = `
    <article class="info-dialog-panel">
      <header class="info-dialog-head">
        <h2 id="info-dialog-title">${esc(doc.title)}</h2>
        <button class="info-dialog-close" type="button" data-info-close aria-label="Close">
          ${icon("close")}
        </button>
      </header>
      <div class="info-dialog-body" role="region" aria-labelledby="info-dialog-title" tabindex="0">
        ${doc.kind === "contact" ? contactMarkup(doc) : documentMarkup(doc)}
      </div>
      ${doc.kind === "contact" ? "" : `
      <footer class="info-dialog-foot">
        ${LEGAL_LINKS.filter((l) => l.key !== key).map((l) =>
          `<button class="info-dialog-swap" type="button" data-info="${l.key}">${esc(l.label)}</button>`
        ).join("")}
      </footer>`}
    </article>`;

  el.querySelector("[data-info-close]").addEventListener("click", () => el.close());
  // Swapping documents while open re-enters here: showModal() would throw on
  // an open dialog, and innerHTML just destroyed the button holding focus.
  if (!el.open) el.showModal();
  el.querySelector("[data-info-close]").focus();
  // Long documents open scrolled to wherever the last one was left otherwise.
  el.querySelector(".info-dialog-body").scrollTop = 0;
}

/* One delegated listener covers the page buttons and the swap buttons inside
   the dialog, including any rendered after this module ran. */
document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-info]");
  if (!trigger) return;
  event.preventDefault();
  openInfo(trigger.dataset.info);
});
