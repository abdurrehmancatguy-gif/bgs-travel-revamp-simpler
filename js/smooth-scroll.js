/**
 * Wheel smoothing, and nothing else.
 *
 * A mouse wheel moves the page in steps; this eases those steps out so the
 * page glides instead of jumping. It deliberately touches only the wheel:
 * the scrollbar, keyboard, touch and anchor jumps all keep their native
 * behaviour, because those already feel right — and because hijacking them is
 * how smooth-scroll libraries end up breaking accessibility.
 *
 * Stays out of the way entirely when the visitor asked for reduced motion,
 * when the pointer is coarse (touch momentum beats any lerp), and whenever a
 * dialog or the menu drawer is open — those trap scrolling on purpose, and a
 * page that keeps moving underneath them is the bug, not the feature.
 */

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const coarse = matchMedia("(pointer: coarse)");

let target = 0;
let current = 0;
let raf = null;
let lastStep = 0;   // watchdog: when the easing loop last actually ran

const maxScroll = () =>
  document.documentElement.scrollHeight - window.innerHeight;

let lastWritten = null;   // the position this loop itself last set

function step() {
  lastStep = performance.now();
  // Before writing, check the world still matches what we last wrote. Scroll
  // events coalesce: an outside jump (scrollIntoView, a script, an anchor)
  // followed by our own frame can surface as a single event that already
  // agrees with us — so the listener below never sees the jump, and the ease
  // quietly drags the page back. The loop itself is the only reliable witness.
  if (lastWritten !== null && Math.abs(window.scrollY - lastWritten) > 2) {
    raf = null;
    lastWritten = null;
    current = window.scrollY;
    target = current;
    return;
  }
  // 0.095: the glide that reads as expensive. Higher snaps like no smoothing
  // at all; much lower turns floaty and the page feels like it is ignoring
  // the hand. Tuned by feel against the reference site.
  current += (target - current) * 0.095;
  if (Math.abs(target - current) < 0.6) {
    current = target;
    raf = null;
  } else {
    raf = requestAnimationFrame(step);
  }
  // behavior: "instant" on purpose — the stylesheet sets scroll-behavior:
  // smooth for anchor links, and letting it re-animate every frame of this
  // loop would smooth the smoothing into mush.
  window.scrollTo({ top: current, left: 0, behavior: "instant" });
  lastWritten = current;
  if (raf === null) lastWritten = null;   // ease over; stop vouching for it
}

function onWheel(event) {
  if (reduceMotion.matches || coarse.matches) return;
  if (event.ctrlKey) return;                       // pinch-zoom on trackpads
  // A hidden or heavily throttled document does not run animation frames, and
  // a preventDefault with no frames behind it swallows the wheel outright —
  // the page simply stops scrolling. Native behaviour is the correct fallback.
  if (document.hidden) return;
  if (raf !== null && performance.now() - lastStep > 250) {
    cancelAnimationFrame(raf);
    raf = null;
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
    return;   // let this event scroll natively from wherever that landed
  }
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  // A dialog or the drawer scrolls its own panel; leave the wheel alone there.
  if (document.querySelector("dialog[open]")) return;
  const drawer = document.getElementById("nav-drawer");
  if (drawer && !drawer.hidden) return;
  // Inner scroll areas (the cards rail) manage themselves.
  if (event.target.closest?.("[data-native-scroll], .hm-cards")) return;

  event.preventDefault();

  // Lines-mode deltas (Firefox) arrive tiny; scale them to pixels.
  const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;

  // Re-sync before applying: the keyboard or an anchor may have moved the
  // page since the last wheel, and easing from a stale position rubber-bands.
  if (event.deltaY === 0) return;
  if (raf === null) {
    current = window.scrollY;
    lastWritten = null;
    // A fresh ease starts the watchdog clock now, not from whenever the last
    // ease finished — a stale timestamp made the guard fire on the first
    // wheel pair of every gesture and skip the smoothing it exists to protect.
    lastStep = performance.now();
  }
  target = Math.max(0, Math.min(maxScroll(), (raf === null ? current : target) + delta));
  if (raf === null) raf = requestAnimationFrame(step);
}

/* passive:false is required to call preventDefault from a wheel listener. */
window.addEventListener("wheel", onWheel, { passive: false });

/* Anything else moving the page (keyboard, hash, scrollbar, a script) must
   cancel the ease rather than fight it. Our own frames land within a pixel of
   `current`, so a reading far from it can only be an outside jump — without
   this check, an anchor click was overridden a frame later by the easing loop
   dragging the page back to its stale target. */
window.addEventListener("scroll", () => {
  if (raf === null) {
    current = window.scrollY;
    target = current;
    return;
  }
  if (Math.abs(window.scrollY - current) > 2) {
    cancelAnimationFrame(raf);
    raf = null;
    current = window.scrollY;
    target = current;
  }
}, { passive: true });

/* An in-flight ease writes the scroll position every frame, and a programmatic
   write cancels any CSS smooth scroll the browser has started — so an anchor
   click landing mid-ease (the skip link, a #journeys link) was silently eaten.
   Ending the ease before the browser handles the click hands the page over. */
function cancelEase() {
  if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  lastWritten = null;
  current = window.scrollY;
  target = current;
}

document.addEventListener("click", (event) => {
  if (event.target.closest?.('a[href^="#"]')) cancelEase();
}, true);

window.addEventListener("hashchange", cancelEase);
