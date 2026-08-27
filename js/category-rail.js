/**
 * Arrows for the mobile category strip.
 *
 * The strip scrolls sideways, and on a phone the last categories sit past the
 * right edge with nothing to say so — a row that looks complete but isn't.
 * An arrow appears at whichever end still has categories behind it: at rest
 * that is the right one, which is the "there is more" signal; the left one
 * turns up once you have scrolled away from the start.
 *
 * The wrapper is built here rather than in the seven HTML files so the markup
 * stays one <nav>, and so a page whose script fails still shows a scrollable
 * strip — just without the arrows.
 */

const CHEVRON = (d) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ENDS = {
  start: { label: "Scroll categories left", path: "M14.5 5.5 8 12l6.5 6.5", dir: -1 },
  end: { label: "Scroll categories right", path: "M9.5 5.5 16 12l-6.5 6.5", dir: 1 },
};

export function enableCategoryRail() {
  const strip = document.querySelector("#page-categories");
  if (!strip || strip.parentElement?.classList.contains("page-cat-rail")) return;

  const rail = document.createElement("div");
  rail.className = "page-cat-rail";
  strip.parentNode.insertBefore(rail, strip);

  const button = (end) => {
    const { label, path, dir } = ENDS[end];
    const el = document.createElement("button");
    el.type = "button";
    el.className = "page-cat-btn";
    el.dataset.end = end;
    el.setAttribute("aria-label", label);
    el.innerHTML = CHEVRON(path);
    el.hidden = true;
    el.addEventListener("click", () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      strip.scrollBy({
        left: dir * Math.round(strip.clientWidth * 0.7),
        behavior: reduce ? "auto" : "smooth",
      });
    });
    return el;
  };

  const prev = button("start");
  const next = button("end");
  rail.append(prev, strip, next);

  const update = () => {
    // A strip that fits needs neither arrow, which is the case on a tablet
    // wide enough to show every category at once.
    const room = strip.scrollWidth - strip.clientWidth;
    const x = strip.scrollLeft;
    prev.hidden = room < 4 || x <= 2;
    next.hidden = room < 4 || x >= room - 2;
    // The fades live on the rail and follow the same two conditions.
    rail.toggleAttribute("data-more-start", !prev.hidden);
    rail.toggleAttribute("data-more-end", !next.hidden);
  };

  strip.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  // The strip is filled by script and refilled whenever the admin saves, so
  // the arrows follow the chips rather than being measured once.
  new MutationObserver(update).observe(strip, { childList: true });
  document.fonts?.ready.then(update).catch(() => {});
  update();
}
