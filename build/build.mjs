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
import { buildWhatsAppItemUrl } from "../utils/whatsapp.js";
import { resolvePill } from "../data/home.js";

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

const PAGES = {
  visa: "visa.html", packages: "packages.html", activities: "activities.html",
  destinations: "destinations.html", services: "services.html", mice: "mice.html",
};

const SKIP = new Set(["dist", ".git", "build", "node_modules", "reference", ".DS_Store"]);

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
  <script type="application/ld+json">${JSON.stringify(
    { "@context": "https://schema.org", "@graph": jsonLd }
  )}</script>`;

/* ------------------------------------------------------------- item pages -- */

function itemPage(item, collection) {
  const s = SHAPE[collection];
  const title = s.title(item);
  const url = `${SITE}/${itemPath(item, collection)}`;
  const image = typeof item.image === "string" ? item.image : item.image?.src;
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
  <title>${esc(title)} — BGS Travel &amp; Tourism</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png?v=183" />
  <!-- Versioned like everywhere else. These used to be bare, which was
       survivable under the old four-hour revalidate — but the stylesheets are
       now cached immutable for a year, so an unversioned link would wear this
       redesign's CSS forever, through every future one. -->
  <link rel="stylesheet" href="/styles.css?v=183" />
  <link rel="stylesheet" href="/pages.css?v=183" />
  <!-- The one script these pages carry: the same wheel glide as the rest of
       the site. Everything else stays static on purpose. -->
  <script type="module" src="/js/smooth-scroll.js?v=183"></script>${headExtras({
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
      <img class="site-logo-mark" src="/assets/monogram-96.webp?v=183" alt="" width="40" height="40" />
      <span class="site-logo-text">
        <span class="site-logo-name">BGS Travel &amp; Tourism</span>
        <span class="site-logo-place">Dubai, UAE</span>
      </span>
    </a>
  </header>
  <main id="main" class="item-page-main">
    <nav class="item-page-crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> <span aria-hidden="true">›</span>
      <a href="/${PAGES[collection]}">${esc(s.label)}</a> <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(title)}</span>
    </nav>
    ${image ? `<img class="item-page-media" src="${esc(image)}" alt="${esc(title)}" />` : ""}
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
let cardCount = 0, pageCount = 0;

for (const [collection, file] of Object.entries(PAGES)) {
  const items = Array.isArray(content[collection]) ? content[collection] : [];
  const target = path.join(DIST, file);
  if (!fs.existsSync(target)) continue;

  let html = fs.readFileSync(target, "utf8");
  const copy = content.copy?.[collection] ?? {};
  const title = `${copy.title ?? SHAPE[collection].label} — BGS Travel & Tourism`;
  const pageUrl = `${SITE}/${file}`;

  // 1. the grid, filled
  html = html.replace(
    '<ul class="card-grid" id="card-grid"></ul>',
    `<ul class="card-grid" id="card-grid">${items.map((i) => cardHtml(i, collection)).join("")}</ul>`
  );
  cardCount += items.length;

  // 2. head: canonical, social, and a list of what the page holds
  html = html.replace("</head>", `${headExtras({
    url: pageUrl, title,
    description: copy.intro ?? "",
    image: items[0] && (typeof items[0].image === "string" ? items[0].image : items[0].image?.src),
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
  for (const item of items) {
    const dir = path.join(DIST, itemPath(item, collection));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), itemPage(item, collection));
    urls.push({ loc: `${SITE}/${itemPath(item, collection)}`, pri: "0.7" });
    pageCount++;
  }
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
    return `<button class="hero-pill" type="button" data-page="${esc(t.page)}" ` +
           `data-query="${esc(t.query)}" data-open="${t.open ? "1" : ""}">` +
           `${esc(t.label)}</button>`;
  }).filter(Boolean).join("\n            ");

  // The class list may carry more than "hero-pills" — the homepage adds its
  // reveal class — so match the token, not the whole attribute.
  const wrap = /(<div class="hero-pills[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/;
  if (!wrap.test(html)) throw new Error("pills: no .hero-pills container in index.html");
  return {
    html: html.replace(wrap, `$1\n            ${buttons}\n          $3`),
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

/* The editable homepage text, painted into the markup so a crawler reads what
   the admin wrote rather than the shipped defaults. Same hooks js/home.js
   re-applies live; tickerPhrases is client-side decoration and skipped. */
for (const [key, value] of Object.entries(content.homeCopy ?? {})) {
  if (typeof value !== "string" || !value.trim()) continue;
  homeHtml = homeHtml.replace(
    new RegExp(`(<[^>]*data-hc="${key}"[^>]*>)([^<]*)`),
    (_, open) => `${open}${esc(value)}`
  );
}

/* The stats band, from the same counts this build just rendered. Counted, not
   typed: the old band claimed traveller totals nobody had measured, and a
   crawler was the one visitor who would never see the client-side correction. */
homeHtml = homeHtml.replace("</head>", `${headExtras({
  url: `${SITE}/`,
  title: "BGS Travel & Tourism — Dubai escapes and journeys worldwide",
  description: "Visas, flights, hotels, transfers and tailor-made journeys from Dubai, arranged end to end by one team.",
  image: `${SITE}/assets/icon-512.png`,
  jsonLd: [orgJsonLd(), {
    "@type": "WebSite", "@id": `${SITE}/#site`, url: `${SITE}/`,
    name: "BGS Travel & Tourism", publisher: { "@id": `${SITE}/#org` },
  }],
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

console.log(`  cards pre-rendered: ${cardCount}   item pages: ${pageCount}`);
console.log(`  sitemap entries:    ${urls.length}`);
console.log(`  hero pills in HTML:   ${pills.painted}`);
const min = await minifyDist();
console.log(`  minified:           ${min.files} files, ${Math.round(min.saved / 1024)} KB saved`);
console.log(`  collections:        ${counts}`);
