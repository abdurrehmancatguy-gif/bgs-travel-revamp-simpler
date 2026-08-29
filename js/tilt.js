/**
 * The card tilt, as one shared engine.
 *
 * Cards lean toward the cursor — 17° of perspective with a lift and a breath
 * of scale — and settle back on leave. Written once here and attached per
 * container, so the homepage rail, the service tiles and every category grid
 * feel identical, and the next tuning request changes one number for the
 * whole site.
 *
 * Delegated from the container because cards re-render on store changes, and
 * inline transforms because the reveal transitions (slow, staggered) would
 * drag the tilt behind the hand. Fine pointers only — a finger cannot hover —
 * and reduced-motion means what it says.
 */

const TILT_MAX = 17;

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

export function enableTilt(container, selector) {
  if (!container) return;
  let raf = null;

  container.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || reduceMotion.matches) return;
    // Weak hardware opts out too: a transform per pointer move, on a card
    // carrying a shadow, is exactly the work such a machine can least spare.
    if (document.documentElement.classList.contains("low-power")) return;
    const card = event.target.closest(selector);
    if (!card || !container.contains(card)) return;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (event.clientX - r.left) / r.width - 0.5;
      const py = (event.clientY - r.top) / r.height - 0.5;
      card.style.transition = "transform 90ms ease-out";
      card.style.transform =
        `perspective(700px) rotateX(${(-py * TILT_MAX).toFixed(2)}deg) ` +
        `rotateY(${(px * TILT_MAX).toFixed(2)}deg) translateY(-8px) scale(1.03)`;
    });
  });

  container.addEventListener("pointerout", (event) => {
    const card = event.target.closest(selector);
    if (!card || card.contains(event.relatedTarget)) return;
    card.style.transition = "transform 420ms cubic-bezier(0.2, 0.6, 0.2, 1)";
    card.style.transform = "";
    // Hand the element back to the stylesheet once the settle finishes, so
    // the reveal and hover rules own it again.
    setTimeout(() => { card.style.transition = ""; }, 450);
  });
}
