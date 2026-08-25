import { filterPackages, withSlugs, resolveHomeCards, CARD_TITLE_KEY } from "../data/packages.js?v=139";
import { getCollection } from "./store.js?v=139";

/* Read through the store, not from the data file directly. The carousel used
   to import PACKAGES and HOME_PACKAGES as constants, which meant the homepage
   showed the six packages written into the source and no edit made in the
   admin ever reached it — the one grid on the site that ignored its own CMS. */
const allPackages = () => withSlugs(getCollection("packages"));
/* The homepage row is mixed — visas and packages in a chosen order — so it is
   resolved from the homeCards references rather than filtered out of one
   collection. Each card carries __collection so the markup and the click know
   what they are holding. */
const homePackages = () =>
  withSlugs(resolveHomeCards(getCollection("homeCards"), (c) => getCollection(c)));
import { icon } from "../data/icons.js?v=139";

/**
 * Horizontal package rail.
 *
 * Three identical sets of cards are rendered and the active index lives in the
 * middle one. The row no longer wraps: travel is clamped to that middle set, so
 * it stays wherever the visitor left it. The outer sets remain so the first and
 * last cards still have a neighbour peeking in at the edge of the screen.
 *
 * Only the middle set is tabbable — otherwise a keyboard user would walk
 * through every package three times.
 */

const SET_COUNT = 3;
const DRAG_THRESHOLD = 8;

/*
 * Every field below is optional.
 *
 * This markup used to read pkg.rating.toFixed(1) and pkg.price.toLocaleString()
 * straight, which was safe only while the row was built from the constants in
 * data/packages.js. Reading real content instead means meeting records that a
 * spreadsheet or a JSON restore left without a rating or a price — and an
 * exception thrown here does not blank one card, it aborts render() and leaves
 * the entire carousel empty. Which is exactly what happened.
 *
 * A missing field now drops its own element and nothing else.
 */
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);


const ratingLabel = (pkg) =>
  Number.isFinite(Number(pkg?.rating)) ? Number(pkg.rating).toFixed(1) : "";

/* No price on the homepage row. The card is an invitation to look, and the
   panel it opens carries the figure with the detail that justifies it —
   duration, what is included, what is not. The accessible name drops it too,
   so a screen reader hears what the card actually says rather than a price
   nobody else is shown. The packages page still prices every card. */
/* A visa has no duration and no rating; it has a processing time and a validity,
   which are the two things somebody comparing visas actually wants on the card.
   Read per collection rather than per field so a package cannot accidentally
   render a visa's furniture. */
function cardParts(record) {
  const kind = record.__collection ?? "packages";
  const title = record[CARD_TITLE_KEY[kind] ?? "title"] ?? "";
  if (kind === "visa") {
    return {
      title,
      kicker: record.category || record.country || "Visa",
      desc: record.blurb || record.shortDescription || "",
      // Validity only. It is the short fact that reads as the parallel of a
      // package's "6 Days", and it keeps every card the same height —
      // "Express 4-5 days · Normal 10-15 days" wrapped onto a second line and
      // made the visa cards taller than the ones beside them. The processing
      // time is on the panel, next to the price and the documents, where
      // somebody comparing turnarounds is actually looking.
      meta: [record.validity].filter((v) => v && !/^n\/?a$/i.test(String(v).trim())),
      rating: "",
    };
  }
  return {
    title,
    kicker: record.category || "",
    desc: record.shortDescription || record.blurb || "",
    meta: [record.duration].filter(Boolean),
    rating: ratingLabel(record),
  };
}

function cardMarkup(pkg, index, set) {
  const { title, kicker, desc, meta, rating } = cardParts(pkg);
  const label = [title, pkg.destination || pkg.country, ...meta].filter(Boolean).join(". ");
  return `
    <article class="package-card" data-index="${index}" data-set="${set}" data-slug="${esc(pkg.slug)}"
             data-collection="${esc(pkg.__collection ?? "packages")}"
             role="button" tabindex="${set === 1 ? 0 : -1}"
             aria-label="${esc(label)}. Open details.">
      ${kicker ? `<span class="package-kicker">${esc(kicker)}</span>` : ""}
      ${pkg.icon ? `<span class="package-icon" aria-hidden="true">${icon(pkg.icon)}</span>` : ""}
      <h3>${esc(title)}</h3>
      ${desc ? `<p class="package-desc">${esc(desc)}</p>` : ""}
      <p class="package-meta">
        ${meta.map((m) => `<span class="package-duration">${esc(m)}</span>`).join("")}
        ${rating ? `<span class="package-rating">${esc(rating)} &#9733;</span>` : ""}
      </p>
    </article>`;
}

export function createCarousel({ rail, track, controls, filterLabel, onOpenPackage }) {
  let list = homePackages();
  let currentFilter = null;
  let cards = [];
  let baseCount = 0;
  let active = 0;

  let cardObserver = null;

  let dragging = false;
  let dragMoved = false;
  let dragStartX = 0;
  let dragOffset = 0;
  let pointerId = null;

  const step = () => {
    if (!cards.length) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    return cards[0].offsetWidth + gap;
  };

  function applyShift() {
    if (!cards.length) return;
    track.style.setProperty("--rail-shift", `${-step() * active}px`);
    cards.forEach((card) => {
      card.dataset.active = String(Number(card.dataset.index) === active);
    });
  }

  function render() {
    baseCount = list.length;
    if (!baseCount) {
      track.replaceChildren();
      cards = [];
      return;
    }
    const html = [];
    for (let set = 0; set < SET_COUNT; set += 1) {
      list.forEach((pkg, i) => {
        const index = set * baseCount + i;
        html.push(cardMarkup(pkg, index, set));
      });
    }
    track.innerHTML = html.join("");
    cards = Array.from(track.querySelectorAll(".package-card"));
    active = baseCount;
    track.classList.add("is-jumping");
    applyShift();
    observeCardWidth();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => track.classList.remove("is-jumping"));
    });
  }

  /**
   * Card width comes from CSS, so on a cold load the stylesheet can still be in
   * flight when render() runs. step() then measures an unstyled card — 54px
   * instead of 364px — and the row parks part-way through the list with the
   * first package clipped off the left edge. Nothing recovered from that except
   * a window resize, which is the only thing wired to refresh().
   *
   * Re-apply the shift whenever the card's width actually changes, which covers
   * late CSS, web fonts reflowing the cards, and container resizes alike. The
   * correction jumps rather than transitions — it is fixing a wrong position,
   * not moving the row somewhere new.
   */
  function resync() {
    if (!cards.length) return;
    const expected = -step() * active;
    const current = parseFloat(track.style.getPropertyValue("--rail-shift")) || 0;
    if (Math.abs(expected - current) < 1) return;
    jumpTo(active);
  }

  function observeCardWidth() {
    cardObserver?.disconnect();
    if (!cards.length || typeof ResizeObserver === "undefined") return;
    cardObserver = new ResizeObserver(resync);
    cardObserver.observe(cards[0]);
  }

  function jumpTo(index) {
    track.classList.add("is-jumping");
    active = index;
    applyShift();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => track.classList.remove("is-jumping"));
    });
  }

  /**
   * The row stays inside the middle set instead of wrapping. Running off the
   * end used to teleport the strip back by a whole set, which is invisible in
   * theory — the sets are identical — but in practice reads as the row throwing
   * you back to where you started. Clamping keeps it wherever it was left. The
   * outer sets still render, so the first and last cards keep a neighbour
   * peeking at the edge.
   */
  const clampActive = (index) =>
    Math.min(Math.max(index, baseCount), baseCount * 2 - 1);

  function move(direction) {
    if (!baseCount) return;
    const next = clampActive(active + direction);
    if (next === active) return;
    active = next;
    applyShift();
  }

  function selectCard(card) {
    const index = Number(card.dataset.index);
    if (Number.isFinite(index)) active = clampActive(index);
    applyShift();
  }

  function packageForCard(card) {
    return list[Number(card.dataset.index) % baseCount] || null;
  }

  /* ---------------- pointer drag ---------------- */

  track.addEventListener("pointerdown", (event) => {
    if (!baseCount || event.button !== 0) return;
    dragging = true;
    dragMoved = false;
    dragStartX = event.clientX;
    dragOffset = 0;
    pointerId = event.pointerId;
    track.classList.add("is-dragging");
  });

  track.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    dragOffset = event.clientX - dragStartX;
    if (Math.abs(dragOffset) > DRAG_THRESHOLD) {
      dragMoved = true;
      // Claim the gesture only once it is clearly horizontal, so a vertical
      // swipe still scrolls the page on touch.
      if (track.hasPointerCapture?.(pointerId) === false) {
        track.setPointerCapture(pointerId);
      }
      track.style.setProperty("--rail-drag", `${dragOffset}px`);
    }
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("is-dragging");
    track.style.setProperty("--rail-drag", "0px");
    if (dragMoved) {
      const moved = Math.round(-dragOffset / step());
      if (moved !== 0) move(moved);
      else applyShift();
    }
    dragOffset = 0;
    pointerId = null;
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("lostpointercapture", endDrag);

  /* ---------------- click / keyboard ---------------- */

  track.addEventListener("click", (event) => {
    const card = event.target.closest(".package-card");
    if (!card || dragMoved) return;
    selectCard(card);
    const pkg = packageForCard(card);
    if (pkg) onOpenPackage(pkg, card);
  });

  rail.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter" || event.key === " ") {
      const card = event.target.closest(".package-card");
      if (!card) return;
      event.preventDefault();
      selectCard(card);
      const pkg = packageForCard(card);
      if (pkg) onOpenPackage(pkg, card);
    }
  });

  controls.querySelector(".rail-prev").addEventListener("click", () => move(-1));
  controls.querySelector(".rail-next").addEventListener("click", () => move(1));

  render();

  // ResizeObserver is the general safety net, but it is delivered through the
  // rendering pipeline and so can be withheld in a backgrounded or throttled
  // tab. These two fire off ordinary events instead, which covers the exact
  // cold-load case above: `load` waits for stylesheets, `fonts.ready` for any
  // web font that reflows the cards. resync() is a no-op when nothing moved.
  window.addEventListener("load", resync);
  document.fonts?.ready.then(resync).catch(() => {});

  return {
    /**
     * Swap the visible packages.
     * @returns {number} how many packages matched — 0 means the caller should
     *   fall back to a WhatsApp enquiry and the rail is left untouched.
     */
    setFilter(filter, label) {
      const next = filterPackages(filter, allPackages());
      if (!next.length) return 0;
      list = next;
      currentFilter = filter;
      render();
      filterLabel.textContent =
        filter && filter.type && filter.type !== "all" ? `Showing: ${label}` : "";
      return next.length;
    },
    /** Reset the row to the curated home selection and clear any filter label. */
    showHome() {
      list = homePackages();
      currentFilter = null;
      render();
      filterLabel.textContent = "";
    },

    /**
     * Re-read the packages after the store changed, keeping whatever the
     * visitor is currently looking at.
     *
     * Needed because the row is built once and then only ever recalculated on
     * resize, so an edit made in the admin — a new price, a package added to
     * the homepage — reached every other grid on the site and not this one.
     * A filtered row re-applies its filter rather than snapping back to the
     * home selection under the visitor.
     */
    reload() {
      list = currentFilter ? filterPackages(currentFilter, allPackages()) : homePackages();
      if (!list.length) { list = homePackages(); currentFilter = null; }
      render();
    },
    /** Re-centre the row and hand keyboard focus to the active card. */
    restart() {
      if (!baseCount) return;
      jumpTo(baseCount);
      const card = cards.find((c) => Number(c.dataset.index) === baseCount);
      card?.focus({ preventScroll: true });
    },
    /** Recompute the pixel shift after a resize changes the card width. */
    refresh: applyShift,
    openBySlug(slug) {
      // The home row is a subset, so a #package= link can name something that
      // is not currently on it. Fall back to the full catalogue before giving
      // up, otherwise deep links to the Dubai day-tours silently do nothing.
      if (!list.some((pkg) => pkg.slug === slug)) {
        if (!allPackages().some((pkg) => pkg.slug === slug)) return false;
        list = allPackages();
        currentFilter = null;
        render();
        filterLabel.textContent = "";
      }
      const card = cards.find(
        (c) => c.dataset.slug === slug && Number(c.dataset.index) >= baseCount
      );
      if (!card) return false;
      selectCard(card);
      const pkg = packageForCard(card);
      if (pkg) onOpenPackage(pkg, card);
      return true;
    },
  };
}
