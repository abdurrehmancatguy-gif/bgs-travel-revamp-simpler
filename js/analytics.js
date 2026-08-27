import { POSTHOG_KEY, POSTHOG_HOST, isConfigured } from "./analytics-config.js?v=210";

/**
 * Product analytics, and the only file that knows PostHog exists.
 *
 * Nothing is loaded until a project key is present, so an unconfigured site
 * fetches no script and sets no cookie — the same shape as js/cloud.js, and for
 * the same reason: a feature nobody has configured should cost nothing.
 *
 * Beyond autocapture, three things are worth naming explicitly because they are
 * what this business actually cares about: which visa or package someone opened,
 * what they searched for, and whether they went through to WhatsApp. That last
 * one is the site's only conversion — there is no cart and no checkout.
 */

/* Pinned to an exact version, not the "@1" range it used to carry. A range is
   resolved by the CDN at request time, so every future 1.x publish would be
   executed here the moment it appeared — a compromised release, or simply a
   breaking one, would reach visitors with no change on our side and no way to
   roll back except editing this line under pressure. Bump it deliberately.
   Firebase (js/firebase-config.js) and SheetJS (js/sheet-import.mjs) are
   pinned the same way. */
const CDN = "https://cdn.jsdelivr.net/npm/posthog-js@1.421.2/+esm";

let ready = null;

function connect() {
  if (!isConfigured()) return Promise.resolve(null);
  if (ready) return ready;

  ready = import(CDN)
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Nobody signs in on the public site, so profiles would be noise and
        // cost. The admin is the only place a person is identifiable.
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        // A visitor who has asked not to be tracked has asked not to be tracked.
        respect_dnt: true,
        // PostHog's remote config pulls a surveys bundle by default, and a
        // survey launched from the dashboard would render its own popup over
        // the site. Nobody here wants a questionnaire appearing mid-booking,
        // and not fetching the script is also a request the visitor is spared.
        disable_surveys: true,
        // The admin edits real prices and documents; recording its inputs would
        // put catalogue content into a third party for no benefit.
        autocapture: { css_selector_allowlist: undefined },
        mask_all_text: false,
        loaded: (ph) => {
          if (document.body.classList.contains("admin")) ph.opt_out_capturing();
        },
      });
      return posthog;
    })
    .catch((error) => {
      // A blocked CDN, an ad blocker, an offline visitor: none of these are
      // reasons for the site to misbehave.
      console.warn("analytics: PostHog unavailable —", error.message);
      ready = null;
      return null;
    });

  return ready;
}

/** Fire and forget. Never awaited by anything the visitor is waiting on. */
export function track(event, properties = {}) {
  if (!isConfigured()) return;
  connect().then((ph) => ph?.capture(event, properties)).catch(() => {});
}

export const analyticsEnabled = () => isConfigured();

/*
 * Started after the page has, not alongside it.
 *
 * PostHog costs three hosts — the CDN the module comes from and two of its own
 * — and every one of them competes with the artwork and the catalogue for the
 * same connections. It is measuring a load it was making slower.
 *
 * requestIdleCallback runs it in the first quiet moment instead, with a load
 * event fallback for Safari, which has no idle callback. Nothing is lost: the
 * pageview is captured whenever init happens, and a visitor who leaves before
 * the browser is ever idle was never going to be a useful datapoint.
 */
if (isConfigured()) {
  const start = () => connect();
  if (document.readyState === "complete") queueIdle(start);
  else window.addEventListener("load", () => queueIdle(start), { once: true });
}

function queueIdle(fn) {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 3000 });
  else setTimeout(fn, 1200);
}
