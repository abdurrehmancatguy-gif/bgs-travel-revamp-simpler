import { getCollection, subscribe } from "./store.js?v=231";
import { createNavigation } from "./navigation.js?v=231";
import { contactStripMarkup, legalLinksMarkup, socialLinksMarkup } from "./info-modal.js?v=231";
import { buildWhatsAppUrl, openWhatsApp } from "../utils/whatsapp.js?v=231";

/**
 * The visa application form, and the checkout it leads to.
 *
 * One page for all 28 visas: which visa it is comes from ?visa=<name>, and
 * everything on the page — the price, the processing tiers, the list of
 * documents — is read from that record. A visa whose requirements change in
 * the admin changes this form too, with nothing to keep in step by hand.
 *
 * Matching on the name rather than a slug because that is what the catalogue
 * is keyed on everywhere else the site links inward — the dropdowns, the
 * homepage cards, the hero pills all pass a name. A slug would be a second
 * identity to keep true.
 *
 * Three views on the one page — the form, the checkout that shows the order
 * back before it goes, and the confirmation — rather than three URLs: the
 * documents are File objects held in memory, and loading another page would
 * drop every one of them.
 */

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const norm = (v) => String(v ?? "").trim().toLowerCase();

const el = (id) => document.querySelector(id);
const money = (n, currency) =>
  `${currency || "AED"} ${Number(n).toLocaleString("en-US")}`;

/* --------------------------------------------------------------- the visa */

const wanted = new URLSearchParams(location.search).get("visa") ?? "";

function findVisa() {
  const list = getCollection("visa") ?? [];
  return list.find((v) => norm(v.name) === norm(wanted)) ?? null;
}

let visa = findVisa();

/* ------------------------------------------------------------------ state */

const state = {
  applicants: 1,
  // 'normal' unless the visa quotes an express rate and the applicant picks it.
  tier: "normal",
};

const unitPrice = () =>
  state.tier === "express" && visa.expressPrice
    ? Number(visa.expressPrice)
    : Number(visa.price ?? 0);

const hasPrice = () => Number(visa?.price) > 0 || Number(visa?.expressPrice) > 0;

const requirements = () =>
  Array.isArray(visa.requirements) ? visa.requirements.filter(Boolean) : [];

/* ------------------------------------------------ what each line asks for */

/**
 * What each line of a visa's requirements actually asks for.
 *
 * The lists are written for people, not for a form. Next to the documents
 * they carry details to be typed — "Email Address", "Current Residential
 * Address" — and qualifiers the rate sheet's commas split off the line before
 * them: "if Available" after "Ejari Copy", "White photo background" after the
 * photograph. A file upload labelled "Mobile Number", or "if Available", is
 * the form being wrong, so each line is read for what it is.
 *
 * A document noun decides first, so "Emirates ID copy" is never taken for a
 * detail; a line naming nothing recognisable stays an upload, which is what
 * the lists mostly are. Checked against all 68 lines across the 28 visas.
 */
const NOTE = /^(if available|to be discussed|face clearly visible|no shadows\b.*|white (photo )?background|(recommended )?photo (file )?size\b.*|passport valid for\b.*)$/i;
const DOCUMENT = /\b(cop(?:y|ies)|scan|scanned|photos?|photographs?|pictures?|letters?|letterhead|certificates?|statements?|tickets?|bookings?|reservations?|itinerar(?:y|ies)|cards?|pdf|originals?|noc|invitations?|insurance|forms?|proof|documents?|receipts?|payslips?|licen[cs]es?|deeds?|contracts?)\b/i;

function fieldKind(line) {
  if (DOCUMENT.test(line)) return "file";
  if (/\be-?mail\b/i.test(line)) return "email";
  if (/\b(mobile|phone|telephone|whatsapp)\b/i.test(line)) return "tel";
  // A date picker only for a single date: "Spouse's Full Name and Date of
  // Birth" and "Travel History with Entry and Exit Dates" are sentences.
  if (/\bdates?\b/i.test(line) && !/\band\b|history/i.test(line)) return "date";
  if (/\b(address|details|history|qualification)\b/i.test(line)) return "textarea";
  if (/\b(number|name|occupation|profession|designation|nationality|religion|marital|purpose|employer|job)\b/i.test(line)) return "text";
  return "file";
}

/**
 * The record's lines as form items — { label, kind, hints, optional } — each
 * qualifier folded into the item it qualifies. One with nothing before it
 * stands on its own as a note.
 */
function items() {
  const list = [];
  for (const line of requirements()) {
    const prev = list[list.length - 1];
    if (NOTE.test(line) && prev) {
      if (/^if available$/i.test(line)) prev.optional = true;
      else prev.hints.push(line);
      continue;
    }
    list.push({ label: line, kind: NOTE.test(line) ? "note" : fieldKind(line), hints: [], optional: false });
  }
  return list;
}

const isAsked = (item) => item.kind !== "note";
const isRequired = (item) => isAsked(item) && !item.optional;

/* --------------------------------------------------------------- rendering */

function render() {
  el("#co-kicker").textContent = visa.country || visa.category || "Visa";
  el("#co-title").textContent = visa.name;
  el("#co-lede").textContent =
    visa.blurb || visa.fullDescription || "Send us the documents and we take it from there.";

  renderTiers();
  renderDocs();
  renderTotals();
}

/* Only shown when the record actually quotes two rates. Most do not. */
function renderTiers() {
  const step = el("#co-tier-step");
  // Only a real choice gets offered. Several visas carry an expressPrice equal
  // to the standard one — the rate sheet lists both columns even where they
  // agree — and a radio group asking somebody to pick between AED 899 and
  // AED 899 is a question with no answer.
  const differ = Number(visa.expressPrice) > 0
    && Number(visa.price) > 0
    && Number(visa.expressPrice) !== Number(visa.price);
  if (!differ) {
    step.hidden = true;
    // Whichever rate the record actually quotes. Always 'normal' priced an
    // express-only visa at AED 0 while hasPrice() said it had a price.
    state.tier = !(Number(visa.price) > 0) && Number(visa.expressPrice) > 0 ? "express" : "normal";
    return;
  }
  step.hidden = false;

  const opt = (key, label, price, note) => `
    <label class="co-tier">
      <input type="radio" name="tier" value="${key}" ${key === state.tier ? "checked" : ""} />
      <span class="co-tier-body">
        <span class="co-tier-name">${esc(label)}</span>
        ${note ? `<span class="co-tier-note">${esc(note)}</span>` : ""}
      </span>
      <span class="co-tier-price">${esc(money(price, visa.currency))}</span>
    </label>`;

  el("#co-tiers").innerHTML =
    opt("normal", "Standard", visa.price, visa.processing) +
    opt("express", "Express", visa.expressPrice, "Faster processing");
}

/**
 * One card per applicant, each listing that visa's requirements.
 *
 * Rebuilt rather than added to when the count changes, but what was already
 * chosen or typed is carried across: increasing the count must not silently
 * discard what somebody has already given, which is what a naive re-render
 * does.
 */
const chosen = new Map();    // "applicant:requirement" -> File
const details = new Map();   // "applicant:requirement" -> typed text

const key = (i, item) => `${i}:${item.label}`;
const filled = (i, item) =>
  item.kind === "file" ? chosen.has(key(i, item)) : Boolean(details.get(key(i, item))?.trim());

function renderDocs() {
  const list = items();
  const asked = list.filter(isAsked);
  const files = asked.filter((item) => item.kind === "file").length;
  const typed = asked.length - files;
  const note = el("#co-docs-note");
  el("#co-docs-title").textContent = typed ? "Documents & details" : "Documents";

  if (!asked.length) {
    const said = list.map((item) => item.label.replace(/\.?$/, ". ")).join("");
    note.textContent =
      `${said || "This visa has no fixed document list. "}The team will tell you what they need after you place the order.`;
    el("#co-applicants").innerHTML = "";
    return;
  }
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  note.textContent =
    `${[files && count(files, "document"), typed && count(typed, "detail")].filter(Boolean).join(" and ")} per applicant.`
    + (files ? " Photos of the originals are fine as long as every corner is readable." : "");

  const cards = [];
  for (let i = 1; i <= state.applicants; i++) {
    cards.push(`
      <details class="co-applicant" ${i === 1 ? "open" : ""}>
        <summary class="co-applicant-head">
          <span>Applicant ${i}</span>
          <span class="co-applicant-count" data-filled="${i}"></span>
        </summary>
        <ul class="co-docs">
          ${list.map((item, j) => itemMarkup(i, j, item)).join("")}
        </ul>
      </details>`);
  }
  el("#co-applicants").innerHTML = cards.join("");
  updateCounts();
}

function itemMarkup(i, j, item) {
  if (item.kind === "note") return `<li class="co-doc co-doc-note">${esc(item.label)}</li>`;

  const id = `doc-${i}-${j}`;
  const k = key(i, item);
  const hint = [item.optional && "If available", ...item.hints].filter(Boolean).join(" · ");
  const label = `<label class="co-doc-label" for="${id}">${esc(item.label)}`
    + `${hint ? `<span class="co-doc-hint">${esc(hint)}</span>` : ""}</label>`;

  // The state line is a polite live region the input points at, so a file
  // turned away for size is announced, not just printed beside the control.
  if (item.kind === "file") {
    const file = chosen.get(k);
    return `
            <li class="co-doc"${file ? ' data-have="1"' : ""}>
              ${label}
              <input class="co-doc-input" id="${id}" type="file"
                     data-key="${esc(k)}" aria-describedby="${id}-state"
                     accept="image/*,application/pdf" />
              <span class="co-doc-state" id="${id}-state" role="status">${file ? esc(file.name) : "No file yet"}</span>
            </li>`;
  }

  // Autocomplete off: the browser's saved email and phone are the person
  // filling the form in, and for applicants two to twenty they are wrong.
  const value = details.get(k) ?? "";
  const field = item.kind === "textarea"
    ? `<textarea class="co-detail-input" id="${id}" data-key="${esc(k)}" rows="2" autocomplete="off">${esc(value)}</textarea>`
    : `<input class="co-detail-input" id="${id}" type="${item.kind}" data-key="${esc(k)}" value="${esc(value)}" autocomplete="off" />`;
  return `
            <li class="co-doc co-doc-detail"${value.trim() ? ' data-have="1"' : ""}>
              ${label}
              ${field}
            </li>`;
}

function updateCounts() {
  const required = items().filter(isRequired);
  for (let i = 1; i <= state.applicants; i++) {
    const badge = document.querySelector(`[data-filled="${i}"]`);
    if (!badge) continue;
    const have = required.filter((item) => filled(i, item)).length;
    badge.hidden = !required.length;
    badge.textContent = `${have} of ${required.length}`;
    badge.dataset.complete = String(have === required.length && required.length > 0);
  }
}

function renderTotals() {
  el("#co-people").textContent = String(state.applicants);
  el("#co-count").textContent = String(state.applicants);

  if (!hasPrice()) {
    // Some visas are quoted per nationality. Saying "AED 0" would be a lie;
    // saying nothing is the truth.
    el("#co-unit").textContent = "On request";
    el("#co-total").textContent = "On request";
    return;
  }
  const unit = unitPrice();
  el("#co-unit").textContent = `${money(unit, visa.currency)}${visa.priceUnit ? ` ${visa.priceUnit}` : ""}`;
  el("#co-total").textContent = money(unit * state.applicants, visa.currency);
}

/* ---------------------------------------------------------------- controls */

document.addEventListener("click", (event) => {
  const step = event.target.closest("[data-count]");
  if (!step) return;
  const next = state.applicants + Number(step.dataset.count);
  if (next < 1 || next > 20) return;
  state.applicants = next;
  renderDocs();
  renderTotals();
});

document.addEventListener("input", (event) => {
  const field = event.target.closest(".co-detail-input");
  if (!field) return;
  details.set(field.dataset.key, field.value);
  field.closest(".co-doc")?.toggleAttribute("data-have", Boolean(field.value.trim()));
  updateCounts();
});

document.addEventListener("change", (event) => {
  const tier = event.target.closest('input[name="tier"]');
  if (tier) { state.tier = tier.value; renderTotals(); return; }

  const doc = event.target.closest(".co-doc-input");
  if (doc) {
    const key = doc.dataset.key;
    const file = doc.files?.[0];
    const row = doc.closest(".co-doc");
    const state_ = row?.querySelector(".co-doc-state");
    doc.removeAttribute("aria-invalid");

    if (!file) { chosen.delete(key); row?.removeAttribute("data-have"); if (state_) state_.textContent = "No file yet"; updateCounts(); return; }

    // 10MB a file: a phone photo of a passport is 2-4MB, and the whole order
    // has to survive one request.
    if (file.size > 10 * 1024 * 1024) {
      doc.value = "";
      doc.setAttribute("aria-invalid", "true");
      chosen.delete(key);
      row?.removeAttribute("data-have");
      // Emptied first and refilled a beat later, so choosing the same
      // oversized photo twice is announced twice rather than once.
      if (state_) {
        state_.textContent = "";
        setTimeout(() => { state_.textContent = "Too large — 10MB maximum"; }, 60);
      }
      updateCounts();
      return;
    }
    chosen.set(key, file);
    row?.setAttribute("data-have", "1");
    if (state_) state_.textContent = file.name;
    updateCounts();
  }
});

/* -------------------------------------------------------- form → checkout */

/**
 * The checks between the form and the checkout. Run on Checkout, and again
 * when Forward returns to a checkout — the form can have been emptied on the
 * way back, and Forward never presses the button.
 *
 * The first thing wrong wins, and takes the focus: a message about a field
 * somewhere up the page is only half an instruction. Applicant details are
 * optional like the documents, but one typed wrongly — half an email
 * address — is caught here rather than discovered by the team later.
 */
function checkForm() {
  const error = el("#co-error");
  const { contact_name: name, contact_phone: phone, contact_email: email } = el("#co-form").elements;
  const badDetail = [...document.querySelectorAll(".co-detail-input")].find((field) => !field.checkValidity());
  const problem =
    !name.value.trim() ? [name, "We need your name for the application."]
    : !phone.value.trim() ? [phone, "We need a phone number to reach you on."]
    : !email.checkValidity() ? [email, "That email address looks incomplete."]
    : badDetail ? [badDetail, `${badDetail.labels[0]?.firstChild?.textContent.trim() || "That field"} looks incomplete.`]
    : null;

  error.hidden = !problem;
  if (!problem) return true;
  error.textContent = problem[1];
  problem[0].closest("details")?.setAttribute("open", "");
  problem[0].focus();
  return false;
}

el("#co-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (checkForm()) showReview();
});

/* ---------------------------------------------------------------- checkout */

/**
 * What is on the order as it stands, per applicant. `chosen` and `details`
 * deliberately outlive a lowered applicant count, so going 3 → 2 → 3 keeps
 * applicant 3's files and answers; the cost is that they can hold passport
 * scans for somebody no longer on the order, and those must not be sent.
 */
function collected() {
  const files = [];
  const typed = [];
  const asked = items().filter(isAsked);
  for (let i = 1; i <= state.applicants; i++) {
    for (const item of asked) {
      const k = key(i, item);
      if (item.kind === "file") {
        if (chosen.has(k)) files.push({ applicant: i, requirement: item.label, file: chosen.get(k) });
      } else if (details.get(k)?.trim()) {
        typed.push({ applicant: i, requirement: item.label, value: details.get(k).trim() });
      }
    }
  }
  return { files, typed };
}

/**
 * What would be sent, read fresh each time rather than captured when Checkout
 * was pressed: the catalogue can still update underneath the checkout (see
 * subscribe() at the bottom), and what it shows and what it places must agree.
 */
function currentOrder() {
  const data = new FormData(el("#co-form"));
  const field = (name) => String(data.get(name) ?? "").trim();
  return {
    visa_name: visa.name,
    visa_country: visa.country ?? null,
    visa_type: visa.visaType ?? null,
    applicants: state.applicants,
    tier: state.tier,
    unit_price: hasPrice() ? unitPrice() : null,
    currency: visa.currency ?? "AED",
    total: hasPrice() ? unitPrice() * state.applicants : null,
    contact_name: field("contact_name"),
    contact_phone: field("contact_phone"),
    contact_email: field("contact_email") || null,
    notes: field("notes") || null,
    details: collected().typed,
  };
}

function renderReview() {
  // A failure message belongs to the order it was built from. Redrawn under
  // a different order it would be a WhatsApp link quoting the wrong one.
  el("#co-review-error").hidden = true;

  const order = currentOrder();
  const list = items();
  const required = list.filter(isRequired);
  const typedItems = list.filter((item) => isAsked(item) && item.kind !== "file");
  const row = (label, value, cls) => value == null || value === ""
    ? ""
    : `<div${cls ? ` class="${cls}"` : ""}><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const price = (n) => (n == null ? "On request" : money(n, order.currency));

  el("#co-review-kicker").textContent = visa.name;

  // The tier only means something where the form offered a choice; otherwise
  // the record's own processing time is the more useful thing to repeat.
  const processing = el("#co-tier-step").hidden
    ? visa.processing
    : state.tier === "express" ? "Express" : "Standard";

  el("#co-review-order").innerHTML =
    row("Visa", visa.name)
    + row("Processing", processing)
    + row("Applicants", String(order.applicants))
    + row("Per applicant", price(order.unit_price))
    + row("Total", price(order.total), "co-sums-total");

  el("#co-review-docs-head").textContent = typedItems.length ? "Documents & details" : "Documents";
  let missingCount = 0;
  el("#co-review-docs").innerHTML = list.some(isAsked)
    ? Array.from({ length: state.applicants }, (_, n) => {
        const i = n + 1;
        const missing = required.filter((item) => !filled(i, item));
        missingCount += missing.length;
        const answers = typedItems
          .filter((item) => filled(i, item))
          .map((item) => `<span class="co-review-answer">${esc(item.label)}: ${esc(details.get(key(i, item)).trim())}</span>`)
          .join("");
        return `<li>
          <span class="co-review-doc-head">
            <span>Applicant ${i}</span>
            ${required.length ? `<span class="co-applicant-count" data-complete="${!missing.length}">${required.length - missing.length} of ${required.length}</span>` : ""}
          </span>
          ${answers}
          ${missing.length ? `<span class="co-review-missing">Missing: ${esc(missing.map((item) => item.label).join(", "))}</span>` : ""}
        </li>`;
      }).join("")
    : "<li>This visa has no fixed document list. The team will tell you what they need.</li>";

  const note = el("#co-review-docs-note");
  note.hidden = !missingCount;
  note.textContent = "You can place the order now and send whatever is missing on WhatsApp afterwards.";

  el("#co-review-you").innerHTML =
    row("Name", order.contact_name)
    + row("Phone", order.contact_phone)
    + row("Email", order.contact_email)
    + row("Notes", order.notes);
}

let formScroll = 0;

/* True while an order is uploading. The checkout it was placed from has to
   stay put until the answer comes back, or the answer lands on another one. */
let placing = false;

function showReview() {
  renderReview();
  formScroll = scrollY;
  el("#co-form").hidden = true;
  el("#co-review").hidden = false;
  // Its own history entry, so a phone's back button returns to the form with
  // every file still attached instead of leaving the page and taking the
  // documents with it.
  if (history.state?.view !== "review") history.pushState({ view: "review" }, "");
  scrollTo({ top: 0, behavior: "instant" });
  el("#co-review-title").focus({ preventScroll: true });
}

function showForm() {
  const fromReview = !el("#co-review").hidden;
  el("#co-review").hidden = true;
  el("#co-form").hidden = false;
  scrollTo({ top: formScroll, behavior: "instant" });
  // The Edit button that had focus has just been hidden; left alone, focus
  // falls to <body> and a screen reader announces nothing at all.
  if (fromReview) el("#co-submit").focus();
}

el("#co-edit")?.addEventListener("click", () => {
  if (history.state?.view === "review") history.back();
  else showForm();
});

addEventListener("popstate", () => {
  // Once the order is placed there is no form to go back to — showing it again
  // would only invite the same order twice.
  if (!visa || !el("#co-done").hidden) return;
  // Back during the upload stays on the checkout the order was placed from.
  if (placing) { history.pushState({ view: "review" }, ""); return; }
  if (history.state?.view !== "review") showForm();
  else if (checkForm()) showReview();
});

el("#co-place")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const edit = el("#co-edit");
  const error = el("#co-review-error");
  error.hidden = true;

  const order = currentOrder();
  const payload = new FormData();
  payload.append("order", JSON.stringify(order));
  for (const { applicant, requirement, file } of collected().files) {
    payload.append("files", file, file.name);
    payload.append("meta", JSON.stringify({ applicant, requirement }));
  }

  placing = true;
  button.disabled = edit.disabled = true;
  button.textContent = "Placing order…";
  try {
    const res = await fetch("/api/visa-order", { method: "POST", body: payload });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { reference } = await res.json();
    showDone(reference, order);
  } catch (err) {
    // The status code is for us, not the customer — "the server answered 501"
    // told them nothing they could act on. What they can act on is the other
    // way in, which stays open whatever the API is doing. Nothing was placed,
    // so the link quotes the order on screen now: a catalogue redraw during
    // the upload can have moved the price.
    console.warn("Visa order not sent:", err);
    error.innerHTML =
      "Your order could not be sent just now. "
      + `<a href="${esc(buildWhatsAppUrl(waMessage(currentOrder())))}" target="_blank" rel="noopener">Send it on WhatsApp instead</a>.`;
    error.hidden = false;
    button.disabled = false;
    button.textContent = "Place order";
  } finally {
    placing = false;
    edit.disabled = false;
  }
});

function waMessage(order, reference) {
  const lines = [
    `Hi BGS Travel & Tourism, I'd like to apply for ${order.visa_name}.`,
    `Applicants: ${order.applicants}`,
  ];
  if (order.total) lines.push(`Quoted total: ${money(order.total, order.currency)}`);
  if (reference) lines.push(`Reference: ${reference}`);
  return lines.join("\n");
}

function showDone(reference, order) {
  el("#co-form").hidden = true;
  el("#co-review").hidden = true;
  el("#co-done").hidden = false;
  el("#co-ref").textContent = reference;
  el("#co-done-note").textContent =
    `We have ${order.applicants === 1 ? "your documents" : `documents for ${order.applicants} applicants`}`
    + ` for ${order.visa_name}. The team will confirm the price and the next steps.`;
  el("#co-done-wa").href = buildWhatsAppUrl(waMessage(order, reference));
  history.replaceState({ view: "done" }, "");
  // To the top of the page, not the section's top edge to the top of the
  // screen: the header is sticky glass, and that parked the focused heading
  // underneath it.
  scrollTo({ top: 0, behavior: "instant" });
  el("#co-done-title").focus({ preventScroll: true });
}

/* ------------------------------------------------------------------- shell */

createNavigation({
  nav: document.querySelector("#site-nav"),
  drawer: document.querySelector("#nav-drawer"),
  drawerBody: document.querySelector("#nav-drawer-body"),
  toggle: document.querySelector("#nav-toggle"),
  onAction: (action) => {
    if (action?.kind === "page") {
      const params = new URLSearchParams();
      if (action.q) params.set("q", action.q);
      if (action.open) params.set("open", "1");
      const q = params.toString();
      location.href = q ? `${action.page}.html?${q}` : `${action.page}.html`;
      return;
    }
    if (action?.kind === "whatsapp") openWhatsApp(buildWhatsAppUrl(action.intent));
  },
});

// A #fragment link adds a history entry whose state is null, and popstate
// reads null as "back to the form" — so Skip to content would close the
// checkout. It only has to move focus, and that needs no history entry.
document.querySelector(".skip-link")?.addEventListener("click", (event) => {
  event.preventDefault();
  el("#main").focus();
});

const footerContact = document.querySelector("#footer-contact");
if (footerContact) footerContact.innerHTML = contactStripMarkup({ legal: false });
const footerSocial = document.querySelector("#footer-social");
if (footerSocial) footerSocial.innerHTML = socialLinksMarkup();
const footerLegal = document.querySelector("#footer-legal");
if (footerLegal) footerLegal.innerHTML = legalLinksMarkup();

/* The first paint.
 *
 * Down here, not beside findVisa(), because render() reaches for `state` and
 * `chosen` — both declared further down the file. Called from the top it threw
 * a temporal-dead-zone ReferenceError before drawing anything, which is not an
 * error a form shows you: the page simply appeared with no documents, no
 * processing tiers, and a total reading "on request" for a visa that has a
 * price. Nothing in the markup looked wrong, so nothing suggested looking at
 * the console.
 *
 * A reload always lands on the form, whatever the history entry says: the
 * files did not survive it, so a checkout drawn from that entry would be of
 * nothing. */
if (history.state?.view) history.replaceState(null, "");

if (!visa) {
  el("#co-missing").hidden = false;
} else {
  el("#co-form").hidden = false;
  render();
}

/**
 * Re-render when the catalogue changes underneath us.
 *
 * The page paints from the shipped data files and Firestore answers a moment
 * later, so the first render is frequently of a thinner record than the real
 * one — the shipped Saudi entry carries no price and no documents, while the
 * live one carries both. Only re-rendering when the visa was missing entirely
 * left that first render standing: a form with no document list, no processing
 * tiers, and a total reading "on request" for a visa priced at AED 899.
 *
 * So this compares what actually matters to the form and redraws when any of
 * it moved. Files already chosen survive, because renderDocs reads them back
 * out of `chosen` rather than trusting the DOM. Whichever view is up stays up,
 * and an open checkout redraws with it so it never shows a price the form has
 * already moved off. The tier needs no fixing here: render() runs renderTiers,
 * which settles it against the new rates.
 */
const signature = (v) => v && JSON.stringify([
  v.name, v.price, v.expressPrice, v.currency, v.priceUnit,
  v.processing, (v.requirements ?? []).length,
]);

let lastSignature = signature(visa);

subscribe(() => {
  // A placed order is final; nothing the catalogue does afterwards redraws it.
  if (!el("#co-done").hidden) return;
  const next = findVisa();
  const nextSignature = signature(next);
  if (nextSignature === lastSignature) return;
  lastSignature = nextSignature;
  visa = next;

  if (!visa) {
    el("#co-form").hidden = true;
    el("#co-review").hidden = true;
    el("#co-missing").hidden = false;
    return;
  }
  el("#co-missing").hidden = true;
  render();
  if (el("#co-review").hidden) el("#co-form").hidden = false;
  else renderReview();
});
