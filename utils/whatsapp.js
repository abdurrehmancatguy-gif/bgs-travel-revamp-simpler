/**
 * Every WhatsApp link in the site is built here. Nothing else concatenates a
 * wa.me URL, so the number and the message templates live in exactly one place.
 *
 * These links are the only "conversion" path on the site — there is no cart,
 * no checkout and no backend. A link hands the traveller to a real person.
 */

export const WHATSAPP_NUMBER = "971555809388";
export const WHATSAPP_DISPLAY = "055 580 9388";
export const CONTACT_EMAIL = "info@bgstravelandtourism.com";
export const LOCATION = "Dubai, UAE";

/** Base builder — URL-encodes the message onto the BGS number. */
export function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * The message behind every "Buy Now" button on a card panel or item page.
 *
 * Buy wording, because the button says Buy Now and a message opening with
 * "I'd like to know more about" put the traveller back a step from where they
 * had already got to. It still asks rather than instructs: WhatsApp is a
 * conversation with a person, so the useful thing to send is a clear intent
 * plus the two questions that always follow it.
 *
 * @param {string} title e.g. "Dubai 30 Day Single Entry Visa"
 */
export function buildWhatsAppItemUrl(title) {
  return buildWhatsAppUrl(
    `Hi BGS Travel & Tourism, I'd like to buy ${title}. ` +
      `Please confirm the price and the next steps.`
  );
}

/**
 * The package version, which can name a price because the panel showed one.
 * @param {string} packageTitle e.g. "Evening Desert Safari with BBQ Dinner"
 * @param {string} price        e.g. "AED 180 per person"
 */
export function buildWhatsAppPackageUrl(packageTitle, price) {
  return buildWhatsAppUrl(
    `Hi BGS Travel & Tourism, I'd like to buy the ${packageTitle} package ` +
      `at ${price}. Please confirm availability, dates and the next steps.`
  );
}

/** "Tailor-Made Trips" pill and the tailor-made prompts in the menus. */
export function buildCustomTripUrl() {
  return buildWhatsAppUrl(
    "Hi BGS Travel & Tourism, I'd like help planning a tailor-made trip."
  );
}

/** Used when a destination or category has no matching package yet. */
export function buildDestinationEnquiryUrl(destinationName) {
  return buildWhatsAppUrl(
    `Hi BGS Travel & Tourism, I'd like to plan a trip to ${destinationName}. ` +
      `Please share the options you can arrange.`
  );
}

/** The Services scene CTA. */
export function buildPlanTripUrl() {
  return buildWhatsAppUrl(
    "Hi BGS Travel & Tourism, I'd like help planning a complete trip."
  );
}

/**
 * Opens a WhatsApp conversation in a new tab without leaking the opener.
 *
 * @param {string} url    a wa.me URL from one of the builders above
 * @param {string} [from] which control started it — a fixed label, never text
 *
 * On counting: this used to read the message back out of the URL and send the
 * first 120 characters to PostHog as `intent`. On the two homepage forms that
 * message is composed from what the visitor typed, so their real name and the
 * opening of their enquiry left the site — under a note beneath the very same
 * button promising the form "sends nothing to a server". The conversion is still
 * counted; only a fixed source label goes with it, so the number is just as
 * useful and no one's words travel with it.
 */
export function openWhatsApp(url, from = "") {
  // The site's only conversion — there is no cart and no checkout — and every
  // WhatsApp link goes through here, so this is the one place worth counting.
  import("../js/analytics.js?v=226")
    .then(({ track }) => track("enquiry_started", {
      ...(from ? { from } : {}),
      page: location.pathname,
    }))
    .catch(() => {});
  window.open(url, "_blank", "noopener,noreferrer");
}
