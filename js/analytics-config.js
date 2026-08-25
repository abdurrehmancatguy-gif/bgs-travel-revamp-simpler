/**
 * PostHog project settings. THIS IS THE ONLY FILE YOU NEED TO EDIT.
 *
 * PostHog → Settings → Project → Project API Key. Copy the key that starts
 * `phc_`, and pick the host that matches the region you signed up in.
 *
 * Until the key is filled in the site behaves exactly as it does today: no
 * script is fetched, no cookie is set, no request is made. Fill it in and
 * analytics start on the next deploy.
 *
 * The project API key is public by design — it only permits writing events,
 * never reading them — which is why it can live here the way the Firebase
 * config does. Never put a personal API key (`phx_`) in this file.
 */
export const POSTHOG_KEY = "phc_yt44Defs2Nhyzy6BCqCWeM778WCcCg7YLoZZgfjL4MLY";

/** "https://eu.i.posthog.com" for an EU project, "https://us.i.posthog.com" for US. */
export const POSTHOG_HOST = "https://eu.i.posthog.com";

export const isConfigured = () => POSTHOG_KEY.startsWith("phc_");
