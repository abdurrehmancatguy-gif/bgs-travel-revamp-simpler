/**
 * Produces dist/ — the site as a crawler should receive it.
 *
 * The source tree stays exactly as it is, so local development and the admin
 * are unchanged; this only runs at deploy. Three things happen: every category
 * grid gets its cards written into the HTML, every record gets a page of its
 * own, and the usual crawl plumbing gets generated.
 *
 * Why it matters: before this, the raw HTML of visa.html was 107 words with an
 * empty <ul>. Google renders JavaScript, but the answer engines this is aimed
 * at mostly do not, so the catalogue was invisible to them.
 */
import fs from "node:fs";
import path from "node:path";
import { loadContent } from "./content.mjs";
import { cardHtml, itemPath, itemJsonLd, describe, esc, SHAPE, slug } from "./render.mjs";
// The same builder the live card panel uses, so the pre-rendered page and the
// panel cannot open WhatsApp with two different messages.
import { buildWhatsAppItemUrl, buildWhatsAppUrl } from "../utils/whatsapp.js";
import { fullSrc } from "../utils/images.js";
import { resolvePill, HOME_COPY } from "../data/home.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
/**
 * The address this site actually lives at.
 *
 * Everything crawler-facing is built from it — the canonical of every page, all
 * 74 entries in the sitemap, the sitemap line in robots.txt, llms.txt, and the
 * @id and url of every piece of JSON-LD. Pointing it at the wrong host does not
 * merely look untidy: a canonical naming another domain tells a search engine
 * that the real copy of the page is over there, so the whole catalogue was
 * crediting the Netlify address rather than bgstravelandtourism.com.
 *
 * SITE_URL still overrides it, which is what a Netlify deploy preview should
 * set so a preview does not claim to be the live site.
 */
const SITE = (process.env.SITE_URL || "https://bgstravelandtourism.com").replace(/\/$/, "");

const NOT_FOUND_NOUN = {
  visa: "visa", packages: "package", activities: "activity",
  destinations: "destination", services: "service", mice: "MICE service",
};

/** Same chip derivation the runtime uses (SHAPES[*].chips in
 *  js/category-page.js) — pre-painted so the row doesn't pop in after load
 *  and shove the whole grid down (that pop-in measured 0.10 CLS). */
const CHIPS = {
  activities: (items) => [...new Set(items.flatMap((i) => i.tags ?? []))].sort(),
  packages: (items) => [...new Set(items.flatMap((i) => [i.region, ...(i.tags ?? [])]))].sort(),
  destinations: (items) => [...new Set(items.map((i) => i.region))],
  services: () => [],
  mice: (items) => items.map((i) => i.name),
  visa: (items) => [...new Set(items.map((i) => i.country))],
};

const PAGES = {
  visa: "visa.html", packages: "packages.html", activities: "activities.html",
  destinations: "destinations.html", services: "services.html", mice: "mice.html",
};

/* Names never copied into the published site. Matched by BARE NAME at every
   level of the walk, so only names that are safe to drop anywhere belong here.
   The infrastructure entries matter: Netlify reads netlify.toml and bundles
   netlify/functions from the REPO ROOT, never from the publish directory, so
   copying them into dist only served them to the public — the stock-image
   function's source was downloadable at /netlify/functions/stock-image.mjs. */
const SKIP = new Set([
  "dist", ".git", "build", "node_modules", "reference", ".DS_Store",
  "netlify", "netlify.toml", "firestore.rules",
  "package.json", "package-lock.json", "FIREBASE.md", "README.md", ".gitignore",
]);

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = path.join(from, entry.name), dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/* ------------------------------------------------------------------ head bits */

const orgJsonLd = () => ({
  "@type": "TravelAgency",
  "@id": `${SITE}/#org`,
  name: "BGS Travel & Tourism",
  url: `${SITE}/`,
  telephone: "+971555809388",
  email: "info@bgstravelandtourism.com",
  address: { "@type": "PostalAddress", addressLocality: "Dubai", addressCountry: "AE" },
  areaServed: "Worldwide",
  logo: `${SITE}/assets/monogram-96.png`,
});

/**
 * JSON-LD is a SCRIPT context, and the HTML tokenizer does not care that the
 * bytes are JSON: it ends the block at the first literal `</script`, wherever
 * that appears — including inside a JSON string. JSON.stringify escapes JSON
 * metacharacters but leaves `<`, `>` and `&` alone, so a catalogue title
 * containing `</script><img src=x onerror=...>` would close this tag and run
 * as markup on our own origin.
 *
 * Escaping those three as \u-sequences is the standard remedy: JSON parsers
 * decode them back to the same characters, so the structured data a crawler
 * reads is byte-for-byte equivalent, while the HTML tokenizer never sees a
 * tag boundary. U+2028/U+2029 go too — legal in JSON, fatal to a JS parser.
 */
function jsonLdScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const headExtras = ({ url, title, description, image, jsonLd }) => `
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="BGS Travel &amp; Tourism" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  ${image ? `<meta property="og:image" content="${esc(image)}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  ${image ? `<meta name="twitter:image" content="${esc(image)}" />` : ""}
  <script type="application/ld+json">${jsonLdScript(
    { "@context": "https://schema.org", "@graph": jsonLd }
  )}</script>`;

/* ------------------------------------------------------------- item pages -- */

/**
 * A preconnect for the item photo's own host, or nothing.
 *
 * This used to be a bare `new URL(image).origin`. Any value that is not an
 * absolute URL throws — and the admin's own photo field says "Paste a URL, or
 * search below", so a relative path is a thing a careful owner types by
 * accident. One malformed field killed every future deploy: verified, the
 * build threw ERR_INVALID_URL and exited before sitemap.xml was written. A
 * speed hint is worth nothing next to that, so it fails soft.
 */
function imageOrigin(image) {
  try {
    return `\n  <link rel="preconnect" href="${esc(new URL(image).origin)}" />`;
  } catch {
    return "";
  }
}

function itemPage(item, collection) {
  const s = SHAPE[collection];
  const title = s.title(item);
  const url = `${SITE}/${itemPath(item, collection)}`;
  /* Sized once here so the <img>, og:image, twitter:image and the JSON-LD all
     quote the same bounded rendition. Social scrapers fetch og:image to build
     a preview, and these links are shared on WhatsApp constantly — a several
     megabyte original makes the preview slow to appear, or skipped outright. */
  const image = fullSrc(typeof item.image === "string" ? item.image : item.image?.src);
  // Curated description when the record has one; empty otherwise — the h1
  // directly beneath already carries the title.
  const imageAlt = (typeof item.image === "object" && item.image?.alt) || "";
  const body = describe(item);
  const facts = s.facts(item).filter(([, v]) => v);
  const lists = [["items", "What this covers"], ["highlights", "Highlights"],
                 ["included", "What's included"], ["requirements", "What you'll need"]]
    .map(([key, heading]) => {
      const values = Array.isArray(item[key]) ? item[key].filter(Boolean) : [];
      return values.length ? `<section class="item-page-section"><h2>${esc(heading)}</h2><ul>${
        values.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></section>` : "";
    }).join("");

  // A sentence stating the answer plainly, because that is the form an engine
  // quotes. A table cell is not quotable; "X costs AED n and takes t" is.
  const lede = [
    `${title}${s.kicker(item) ? ` — ${s.kicker(item)}` : ""}.`,
    item.price ? `Priced from ${item.currency ?? "AED"} ${Number(item.price).toLocaleString("en-US")} ${item.priceUnit ?? ""}`.trim() + "." : "",
    item.processing ? `Processing time: ${item.processing}.` : "",
    item.validity ? `Valid ${item.validity}.` : "",
  ].filter(Boolean).join(" ");

  const description = `${lede} ${body}`.trim().slice(0, 300);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <link rel="preconnect" href="https://dcym8fthxf5uu.cloudfront.net" crossorigin />
  <link rel="preload" as="font" type="font/woff2" href="https://dcym8fthxf5uu.cloudfront.net/fonts/247a073c-29f5-4a89-aa3a-741020f346fc/OggText-Medium.woff2" crossorigin />${imageOrigin(image)}
  <title>${esc(title)} — BGS Travel &amp; Tourism</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png?v=213" />
  <!-- Versioned like everywhere else. These used to be bare, which was
       survivable under the old four-hour revalidate — but the stylesheets are
       now cached immutable for a year, so an unversioned link would wear this
       redesign's CSS forever, through every future one. -->
  <link rel="stylesheet" href="/styles.css?v=213" />
  <link rel="stylesheet" href="/pages.css?v=213" />
  <!-- The one script these pages carry: the same wheel glide as the rest of
       the site. Everything else stays static on purpose. -->
  <script type="module" src="/js/smooth-scroll.js?v=213"></script>${headExtras({
    url, title: `${title} — BGS Travel & Tourism`, description, image,
    jsonLd: [orgJsonLd(), ...itemJsonLd(item, collection, url, `${SITE}/`), {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: s.label, item: `${SITE}/${PAGES[collection]}` },
        { "@type": "ListItem", position: 3, name: title, item: url },
      ],
    }],
  })}
</head>
<body class="page item-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="item-page-bar">
    <a class="site-logo" href="/">
      <img class="site-logo-mark" src="/assets/monogram-96.webp?v=213" alt="" width="40" height="40" />
      <span class="site-logo-text">
        <span class="site-logo-name">BGS Travel &amp; Tourism</span>
        <span class="site-logo-place">Dubai, UAE</span>
      </span>
    </a>
  </header>
  <main id="main" class="item-page-main" tabindex="-1">
    <nav class="item-page-crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> <span aria-hidden="true">›</span>
      <a href="/${PAGES[collection]}">${esc(s.label)}</a> <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(title)}</span>
    </nav>
    ${image ? `<img class="item-page-media" src="${esc(image)}" alt="${esc(imageAlt)}" fetchpriority="high" decoding="async" />` : ""}
    ${s.kicker(item) ? `<p class="item-page-kicker">${esc(s.kicker(item))}</p>` : ""}
    <h1>${esc(title)}</h1>
    <p class="item-page-lede">${esc(lede)}</p>
    ${facts.length ? `<dl class="item-page-facts">${facts.map(([k, v]) =>
      `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    ${body ? `<p class="item-page-body">${esc(body)}</p>` : ""}
    ${lists}
    <p class="item-page-cta">
      <a class="item-page-button" href="${esc(buildWhatsAppItemUrl(title))}"
         target="_blank" rel="noopener">Buy Now on WhatsApp</a>
    </p>
    <p class="item-page-back"><a href="/${PAGES[collection]}">All ${esc(s.label)}</a></p>
  </main>
  <section class="page-notfound" aria-label="Contact us">
    <p class="page-notfound-line">${esc(content.copy?.[collection]?.notFound ?? `Couldn\u2019t find your desired ${NOT_FOUND_NOUN[collection] ?? "trip"}?`)}</p>
    <a class="page-notfound-btn" href="https://wa.me/971555809388?text=${
      encodeURIComponent(`Hi BGS Travel & Tourism, I couldn't find the ${NOT_FOUND_NOUN[collection] ?? "trip"} I'm looking for on the site — can you help?`)}"
       target="_blank" rel="noopener">Contact us on WhatsApp — we\u2019ll check for you</a>
  </section>
  <footer class="page-footer">
    <p><a href="tel:+971555809388">055 580 9388</a> ·
       <a href="mailto:info@bgstravelandtourism.com">info@bgstravelandtourism.com</a></p>
    <p>BGS Travel &amp; Tourism — Dubai, UAE</p>
  </footer>
</body>
</html>`;
}

/* --------------------------------------------------------------------- run -- */

const content = await loadContent();
/* Start from nothing.
 *
 * Netlify builds from a clean checkout, so this only ever bit local builds —
 * but it bit them badly: pages generated by an earlier run survived, so after
 * the site URL changed, dist still held item pages carrying the old canonical,
 * and records deleted from the catalogue kept a page each. A local build that
 * does not match what a deploy produces is worse than no local build. */
fs.rmSync(DIST, { recursive: true, force: true });
copyTree(ROOT, DIST);

const urls = [{ loc: `${SITE}/`, pri: "1.0" }];
let cardCount = 0, pageCount = 0, servicePageCount = 0;

for (const [collection, file] of Object.entries(PAGES)) {
  const items = Array.isArray(content[collection]) ? content[collection] : [];
  const target = path.join(DIST, file);
  if (!fs.existsSync(target)) continue;

  let html = fs.readFileSync(target, "utf8");
  const copy = content.copy?.[collection] ?? {};
  const title = `${copy.title ?? SHAPE[collection].label} — BGS Travel & Tourism`;
  const pageUrl = `${SITE}/${file}`;

  /*
   * Every replacement below passes a FUNCTION, never a string.
   *
   * String.prototype.replace treats `$&`, `$\``, `$'` and `$1` inside a string
   * replacement as substitution tokens, and esc() does not escape `$` (it must
   * not — prices are full of it). So a catalogue title or a line of copy
   * containing `$\`` would expand at build time into a copy of everything
   * before the match: verified, a two-character `intro` value turned a 7KB
   * page into 2.6MB of duplicated document, and the build still exited 0.
   * A function replacer disables that expansion entirely.
   */

  // 1. the grid, filled
  html = html.replace(
    '<ul class="card-grid" id="card-grid"></ul>',
    () => `<ul class="card-grid" id="card-grid">${items.map((i, n) => cardHtml(i, collection, n)).join("")}</ul>`
  );
  cardCount += items.length;

  {
    const chips = (CHIPS[collection]?.(items) ?? []).filter(Boolean);
    const chipHtml = chips
      .map((v) => `<button class="page-chip" type="button" data-value="${esc(v)}">${esc(v)}</button>`)
      .join("");
    const chipAnchor = '<div class="page-chips" id="page-chips"></div>';
    if (chips.length && !html.includes(chipAnchor)) {
      throw new Error(`chips: no empty #page-chips container in ${PAGES[collection]}`);
    }
    html = html.replace(chipAnchor, () => `<div class="page-chips" id="page-chips">${chipHtml}</div>`);
  }

  // 2. head: canonical, social, and a list of what the page holds
  html = html.replace("</head>", () => `${headExtras({
    url: pageUrl, title,
    description: copy.intro ?? "",
    image: items[0] && fullSrc(
      typeof items[0].image === "string" ? items[0].image : items[0].image?.src),
    jsonLd: [orgJsonLd(), {
      "@type": "ItemList",
      name: SHAPE[collection].label,
      numberOfItems: items.length,
      itemListElement: items.map((item, n) => ({
        "@type": "ListItem", position: n + 1,
        name: SHAPE[collection].title(item),
        url: `${SITE}/${itemPath(item, collection)}`,
      })),
    }],
  })}\n</head>`);
  fs.writeFileSync(target, html);
  urls.push({ loc: pageUrl, pri: "0.8" });

  // 3. a page per record
  //
  // Two records that slug to the same path used to overwrite each other in
  // silence — same file written twice, both URLs in the sitemap, build exits 0
  // and reports the full count. Fail loudly instead: a collision means two
  // records have effectively the same name, which is a content problem the
  // owner needs to see rather than a page that quietly does not exist.
  // Services are the exception: /services/<key>/ is written further down as a
  // master page, which carries the offerings and the catalogue an item page
  // has no notion of. Generating both would put two pages at one URL.
  const written = new Set();
  for (const item of collection === "services" ? [] : items) {
    const rel = itemPath(item, collection);
    if (written.has(rel)) {
      throw new Error(
        `two ${collection} records both resolve to /${rel} — ` +
        `"${SHAPE[collection].title(item)}" collides with an earlier record. ` +
        `Give one of them a distinct name.`
      );
    }
    written.add(rel);
    const dir = path.join(DIST, rel);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), itemPage(item, collection));
    urls.push({ loc: `${SITE}/${rel}`, pri: "0.7" });
    pageCount++;
  }
}

/* The six service master pages. Keyed off servicePages, with SERVICES
   supplying the label and photograph, so the two stay in step: a service the
   owner removes from SERVICES stops being linked, and one with no page entry
   simply does not get a page rather than getting an empty one. */
{
  const byKey = new Map((content.services ?? []).map((s) => [s.key, s]));
  for (const page of content.servicePages ?? []) {
    if (!page?.key) continue;
    const dir = path.join(DIST, "services", page.key);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.html"),
      servicePage(byKey.get(page.key), page, content)
    );
    urls.push({ loc: `${SITE}/services/${page.key}/`, pri: "0.8" });
    pageCount++;
    servicePageCount++;
  }
}


/**
 * A service master page: what the service is, what we do under it, and the
 * catalogue that belongs to it.
 *
 * Static like the item pages, and built from the same content the browser
 * would render, so a crawler and an answer engine see the whole thing without
 * running any script.
 */
function servicePage(service, page, content) {
  const label = page.label || service?.label || page.key;
  const url = `${SITE}/services/${page.key}/`;
  const image = fullSrc(typeof service?.image === "string" ? service.image : service?.image?.src);
  const intro = page.intro || service?.blurb || "";
  const description = intro.slice(0, 300);

  // "Name | Detail" per line, the same shape the FAQ uses, so the admin edits
  // one textarea rather than a nested form.
  const offerings = (page.offerings ?? [])
    .map((line) => {
      const [name, ...rest] = String(line).split("|");
      return [name.trim(), rest.join("|").trim()];
    })
    .filter(([name]) => name);

  // A preview of the catalogue this service sells, not the whole thing — the
  // full list is one click away and already has its own page.
  const collection = page.catalogue && content[page.catalogue] ? page.catalogue : "";
  const picks = collection ? (content[collection] ?? []).slice(0, 6) : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <link rel="preconnect" href="https://dcym8fthxf5uu.cloudfront.net" crossorigin />
  <link rel="preload" as="font" type="font/woff2" href="https://dcym8fthxf5uu.cloudfront.net/fonts/247a073c-29f5-4a89-aa3a-741020f346fc/OggText-Medium.woff2" crossorigin />${imageOrigin(image)}
  <title>${esc(label)} — BGS Travel &amp; Tourism</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png?v=213" />
  <link rel="stylesheet" href="/styles.css?v=213" />
  <link rel="stylesheet" href="/pages.css?v=213" />
  <script type="module" src="/js/smooth-scroll.js?v=213"></script>${headExtras({
    url, title: `${label} — BGS Travel & Tourism`, description, image,
    jsonLd: [orgJsonLd(), {
      "@type": "Service",
      "@id": `${url}#service`,
      name: label,
      description: intro,
      provider: { "@id": `${SITE}/#org` },
      areaServed: "Dubai, United Arab Emirates",
      ...(offerings.length ? {
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: label,
          itemListElement: offerings.map(([name, detail]) => ({
            "@type": "Offer", name, ...(detail ? { description: detail } : {}),
          })),
        },
      } : {}),
    }, {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Services", item: `${SITE}/services.html` },
        { "@type": "ListItem", position: 3, name: label, item: url },
      ],
    }],
  })}
</head>
<body class="page service-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="item-page-bar">
    <a class="site-logo" href="/">
      <img class="site-logo-mark" src="/assets/monogram-96.webp?v=213" alt="" width="40" height="40" />
      <span class="site-logo-text">
        <span class="site-logo-name">BGS Travel &amp; Tourism</span>
        <span class="site-logo-place">Dubai, UAE</span>
      </span>
    </a>
  </header>
  <main id="main" class="service-page-main" tabindex="-1">
    <nav class="item-page-crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> <span aria-hidden="true">&rsaquo;</span>
      <a href="/services.html">Services</a> <span aria-hidden="true">&rsaquo;</span>
      <span aria-current="page">${esc(label)}</span>
    </nav>

    <p class="item-page-kicker">Service</p>
    <h1>${esc(label)}</h1>
    <p class="item-page-lede">${esc(intro)}</p>
    ${image ? `<img class="item-page-media" src="${esc(image)}" alt="" fetchpriority="high" decoding="async" />` : ""}

    ${offerings.length ? `<section class="service-block" aria-labelledby="service-offerings">
      <h2 id="service-offerings">What we offer</h2>
      <ul class="service-offerings">
        ${offerings.map(([name, detail]) => `<li>
          <h3>${esc(name)}</h3>
          ${detail ? `<p>${esc(detail)}</p>` : ""}
        </li>`).join("")}
      </ul>
    </section>` : ""}

    ${picks.length ? `<section class="service-block" aria-labelledby="service-catalogue">
      <h2 id="service-catalogue">${esc(page.catalogueHeading || "What we book")}</h2>
      <ul class="card-grid">${picks.map((item, i) => cardHtml(item, collection, i)).join("")}</ul>
      <p class="item-page-back">
        <a href="/${PAGES[collection]}">${esc(page.catalogueMore || "See the full list")}</a>
      </p>
    </section>` : ""}

    <p class="item-page-cta">
      <a class="item-page-button" href="${esc(buildWhatsAppUrl(
        `Hi BGS Travel & Tourism, I'd like help with ${label}.`))}"
         target="_blank" rel="noopener">Ask about ${esc(label)} on WhatsApp</a>
    </p>
    <p class="item-page-back"><a href="/services.html">All services</a></p>
  </main>

  <section class="page-notfound" aria-label="Contact us">
    <p class="page-notfound-line">${esc(
      content.copy?.services?.notFound ?? "Couldn\u2019t find your desired service?")}</p>
    <a class="page-notfound-btn" href="${esc(buildWhatsAppUrl(
      `Hi BGS Travel & Tourism, I'd like to ask about ${label}.`))}"
       target="_blank" rel="noopener"><span>Ask us on WhatsApp</span></a>
  </section>

  <footer class="page-footer">
    <p>BGS Travel &amp; Tourism &mdash; Dubai, UAE</p>
  </footer>
</body>
</html>`;
}

/**
 * Writes the hero pills into the homepage HTML.
 *
 * js/home.js renders these from the store so they are admin-editable, but a
 * crawler that does not run scripts would otherwise find an empty div where the
 * three most prominent links on the site should be. Pre-rendering them keeps
 * the markup honest; home.js replaces them with the same content a moment later
 * and the visitor sees no change.
 *
 * open=1 matches the signal the dropdown menus use, so a pill naming one visa
 * lands on that visa's panel rather than on a filtered list of one.
 */
function paintPillsIntoHtml(html, pills) {
  if (!pills?.length) return { html, painted: 0 };
  const buttons = pills.map((pill) => {
    // Same resolver the browser uses, so the pre-rendered button and the one
    // js/home.js draws a moment later cannot say different things.
    const t = resolvePill(pill, (c) => content[c] ?? []);
    if (!t || !t.label) return "";
    // Same MICE expansion js/home.js renders — trade jargon explained
    // where a visitor first meets it, visible label kept first in the name.
    const mice = /\bMICE\b/.test(t.label)
      ? ` title="MICE — Meetings, Incentives, Conferences and Exhibitions"` +
        ` aria-label="${esc(t.label)} — Meetings, Incentives, Conferences and Exhibitions"`
      : "";
    return `<button class="hero-pill" type="button" data-page="${esc(t.page)}" ` +
           `data-query="${esc(t.query)}" data-open="${t.open ? "1" : ""}"${mice}>` +
           `${esc(t.label)}</button>`;
  }).filter(Boolean).join("\n            ");

  // The class list may carry more than "hero-pills" — the homepage adds its
  // reveal class — so match the token, not the whole attribute.
  const wrap = /(<div class="hero-pills[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/;
  if (!wrap.test(html)) throw new Error("pills: no .hero-pills container in index.html");
  return {
    // Function replacer: $1/$3 become real arguments, and any `$` inside the
    // painted buttons stays literal.
    html: html.replace(wrap, (_m, open, _inner, close) =>
      `${open}\n            ${buttons}\n          ${close}`),
    painted: pills.length,
  };
}

/**
 * Minifies the CSS and JavaScript in dist.
 *
 * The source has no build step on purpose — every file runs in a browser as
 * written, which is what makes the site openable from a folder and debuggable
 * without a source map. This touches only what gets published.
 *
 * Deliberately optional. esbuild is a devDependency, and a deploy that cannot
 * install it should publish a slightly larger site, not fail: a missing
 * minifier is not a reason for a travel agency to have no website. Each file is
 * minified in place rather than bundled, so the ?v= import specifiers between
 * modules are untouched and the module graph still works exactly as it did.
 */
async function minifyDist() {
  let esbuild;
  try {
    esbuild = await import("esbuild");
  } catch {
    console.log("  minify: esbuild unavailable, publishing unminified");
    return { files: 0, saved: 0 };
  }

  const targets = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (/\.(css|m?js)$/.test(entry.name)) targets.push(full);
    }
  };
  walk(DIST);

  let saved = 0, done = 0;
  for (const file of targets) {
    const source = fs.readFileSync(file, "utf8");
    try {
      const out = await esbuild.transform(source, {
        loader: file.endsWith(".css") ? "css" : "js",
        minify: true,
        // Nothing older than this can run the site anyway: it is ES modules,
        // optional chaining and <dialog> throughout.
        target: file.endsWith(".css") ? "chrome100" : "es2022",
      });
      if (out.code.length < source.length) {
        fs.writeFileSync(file, out.code);
        saved += source.length - out.code.length;
        done++;
      }
    } catch (error) {
      // One unparseable file must not take the deploy with it.
      console.warn(`  minify: skipped ${path.relative(DIST, file)} — ${error.message.split("\n")[0]}`);
    }
  }
  return { files: done, saved };
}

/* homepage head */
const home = path.join(DIST, "index.html");
let homeHtml = fs.readFileSync(home, "utf8");
const pills = paintPillsIntoHtml(homeHtml, content.homePills);
homeHtml = pills.html;

/* The FAQ, statically: the answers are exactly what an answer engine wants,
   and details/summary needs no script to be readable. The same lines become
   FAQPage structured data below. */
const faqPairs = (content.homeCopy?.faq ?? [])
  .map((line) => {
    const [q, ...rest] = String(line).split("|");
    const a = rest.join("|").trim();
    return q.trim() && a ? [q.trim(), a] : null;
  })
  .filter(Boolean);
homeHtml = homeHtml.replace(
  '<div class="hm-faq" id="hm-faq"></div>',
  () => `<div class="hm-faq" id="hm-faq">${faqPairs.map(([q, a]) => `
        <details class="hm-faq-item"><summary>${esc(q)}<span class="hm-faq-mark" aria-hidden="true"></span></summary><p>${esc(a)}</p></details>`).join("")}
      </div>`
);

/* The editable homepage text, painted into the markup so a crawler reads what
   the admin wrote rather than the shipped defaults. Same hooks js/home.js
   re-applies live; tickerPhrases is client-side decoration and skipped. */
/*
 * The KEY here is a Firestore field name, and it used to be compiled straight
 * into a RegExp. Two ways that bites: a key of `(` throws "Unterminated group"
 * and every deploy from then on fails with a stack trace pointing at a regex
 * the admin UI cannot even display; and a key like `eyebrow"[^>]*>)([\s\S]*)(`
 * compiles fine and swallows 12KB of the document. Both verified against this
 * build.
 *
 * The markup carries a fixed set of data-hc hooks, so a key that is not a
 * known HOME_COPY field can never legitimately match anything — ignoring it is
 * both the safe answer and the correct one.
 */
const HOME_COPY_KEYS = new Set(Object.keys(HOME_COPY));
for (const [key, value] of Object.entries(content.homeCopy ?? {})) {
  if (typeof value !== "string" || !value.trim()) continue;
  if (!HOME_COPY_KEYS.has(key)) continue;
  homeHtml = homeHtml.replace(
    new RegExp(`(<[^>]*data-hc="${key}"[^>]*>)([^<]*)`),
    (_, open) => `${open}${esc(value)}`
  );
}

/* Payment badges: the admin's list decides which icons show. Painted rather
   than assumed: the source ships tabby hidden, so this both reveals a badge
   the admin turned on and hides one they turned off; an empty list hides the
   strip. Mirrors renderPayments in js/home.js. */
{
  if ((homeHtml.match(/data-pay="/g) ?? []).length !== 2) {
    throw new Error("payments: expected two data-pay badges in index.html");
  }
  const methods = (content.homeCopy?.payMethods ?? [])
    .map((m) => String(m).trim().toLowerCase()).filter(Boolean);
  for (const key of ["tabby", "tamara"]) {
    homeHtml = homeHtml.replace(
      new RegExp(`<img([^>]*data-pay="${key}"[^>]*?) */>`),
      (_, attrs) =>
        `<img${attrs.replace(/\s*\bhidden\b/, "")}${methods.includes(key) ? "" : " hidden"} />`
    );
  }
  homeHtml = homeHtml.replace('<div class="hm-pay hm-reveal">',
    () => `<div class="hm-pay hm-reveal"${methods.length ? "" : " hidden"}>`);
}

/* The stats band, from the same counts this build just rendered. Counted, not
   typed: the old band claimed traveller totals nobody had measured, and a
   crawler was the one visitor who would never see the client-side correction. */
homeHtml = homeHtml.replace("</head>", () => `${headExtras({
  url: `${SITE}/`,
  title: "BGS Travel & Tourism — Dubai escapes and journeys worldwide",
  description: "Visas, flights, hotels, transfers and tailor-made journeys from Dubai, arranged end to end by one team.",
  image: `${SITE}/assets/icon-512.png`,
  jsonLd: [orgJsonLd(), {
    "@type": "WebSite", "@id": `${SITE}/#site`, url: `${SITE}/`,
    name: "BGS Travel & Tourism", publisher: { "@id": `${SITE}/#org` },
  }, ...(faqPairs.length ? [{
    "@type": "FAQPage",
    mainEntity: faqPairs.map(([q, a]) => ({
      "@type": "Question", name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }] : [])],
})}\n</head>`);
fs.writeFileSync(home, homeHtml);

/* sitemap, robots, llms.txt */
fs.writeFileSync(path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.loc}</loc><priority>${u.pri}</priority></url>`).join("\n") +
  `\n</urlset>\n`);

fs.writeFileSync(path.join(DIST, "robots.txt"),
`User-agent: *
Allow: /

# Answer engines. Being readable by these is the point of the pre-render.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /

Disallow: /admin/

Sitemap: ${SITE}/sitemap.xml
`);

const counts = Object.entries(PAGES)
  .map(([c]) => `${(content[c] ?? []).length} ${c}`).join(", ");
fs.writeFileSync(path.join(DIST, "llms.txt"),
`# BGS Travel & Tourism

> A Dubai travel agency arranging visas, flights, hotels, transfers, tours and
> corporate travel. Enquiries are handled over WhatsApp by one team.

Contact: 055 580 9388 · info@bgstravelandtourism.com · Dubai, UAE

## What is on this site
${Object.entries(PAGES).map(([c, f]) =>
  `- [${SHAPE[c].label}](${SITE}/${f}) — ${(content[c] ?? []).length} entries, each with its own page`).join("\n")}

Every entry carries its price in AED, processing or duration, and the documents
required. Prices are the published selling price.

## Full index
${Object.entries(PAGES).flatMap(([c]) => (content[c] ?? []).map((i) =>
  `- [${SHAPE[c].title(i)}](${SITE}/${itemPath(i, c)})`)).join("\n")}
`);

console.log(`  cards pre-rendered: ${cardCount}   item pages: ${pageCount}   service pages: ${servicePageCount}`);
console.log(`  sitemap entries:    ${urls.length}`);
console.log(`  hero pills in HTML:   ${pills.painted}`);
const min = await minifyDist();
console.log(`  minified:           ${min.files} files, ${Math.round(min.saved / 1024)} KB saved`);
console.log(`  collections:        ${counts}`);
