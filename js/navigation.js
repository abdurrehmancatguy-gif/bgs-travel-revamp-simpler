import { buildPrimaryNav, buildDrawerMenus } from "./nav-model.js?v=224";
import { subscribe } from "./store.js?v=224";
import { contactStripMarkup } from "./info-modal.js?v=224";
import { icon } from "../data/icons.js?v=224";

/**
 * Header dropdowns and the mobile drawer.
 *
 * Desktop menus open on hover and on focus, and close on outside click, on
 * Escape and when focus leaves the menu. The mobile drawer uses collapsible
 * groups and contains every item from every menu.
 *
 * Nothing here knows what an action does — each item carries an `action`
 * descriptor from data/navigation.js and this module hands it to `onAction`.
 */
export function createNavigation({ nav, drawer, drawerBody, toggle, onAction }) {
  const menus = [];
  let openMenu = null;

  /* Hovering out of a menu closes it after a grace period rather than instantly.
     The CSS bridges the gap directly under each trigger, but the panels are
     centred and much wider than their trigger, so a diagonal move towards an
     item near the panel's edge still leaves .nav-item on the way. Without the
     delay that reads as the menu closing before it can be used. */
  const HOVER_CLOSE_DELAY = 260;
  let closeTimer = null;
  const cancelClose = () => {
    if (closeTimer === null) return;
    window.clearTimeout(closeTimer);
    closeTimer = null;
  };

  /* ---------------- rendering ---------------- */

  /* Menu labels are store content — visa names, package titles, whatever the
     admin typed — and they land in innerHTML, so they are escaped like any
     other data. A title containing an angle bracket becomes text, not markup. */
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  /* These are disclosure panels of plain links/buttons, not ARIA menus:
     role="menu"/"menuitem" would promise arrow-key navigation this pattern
     does not (and should not) implement. Tab + Escape + aria-expanded is the
     complete disclosure-navigation contract. */
  const linkMarkup = (item, id) =>
    `<li><button class="nav-panel-link" type="button" data-action-id="${id}">` +
    (item.icon ? `<span class="nav-panel-icon" aria-hidden="true">${icon(item.icon)}</span>` : "") +
    `<span>${esc(item.label)}</span></button></li>`;

  const actions = new Map();
  let actionSeq = 0;
  const registerAction = (action) => {
    const id = `act-${(actionSeq += 1)}`;
    actions.set(id, action);
    return id;
  };

  function panelMarkup(menu) {
    if (menu.kind === "groups") {
      return (
        `<div class="nav-panel-grid">` +
        menu.groups
          .map(
            (group) =>
              `<div><p class="nav-panel-group-label">${esc(group.label)}</p>` +
              `<ul class="nav-panel-list">` +
              group.items.map((i) => linkMarkup(i, registerAction(i.action))).join("") +
              `</ul></div>`
          )
          .join("") +
        `</div>`
      );
    }
    return (
      `<ul class="nav-panel-list">` +
      menu.items.map((i) => linkMarkup(i, registerAction(i.action))).join("") +
      `</ul>`
    );
  }

  function buildDesktop() {
    const html = buildPrimaryNav()
      .map((menu) => {
        // A menu with no sub-items is just a button: no caret, no panel, and
        // nothing for the hover/open machinery to attach to.
        if (menu.kind === "action") {
          return `
        <li class="nav-item" data-menu="${menu.id}">
          <button class="nav-trigger" type="button" id="nav-trigger-${menu.id}"
                  data-action-id="${registerAction(menu.action)}">
            <span>${esc(menu.label)}</span>
          </button>
        </li>`;
        }
        return `
        <li class="nav-item" data-menu="${menu.id}">
          <button class="nav-trigger" type="button"
                  id="nav-trigger-${menu.id}"
                  aria-expanded="false" aria-controls="nav-panel-${menu.id}"
                  ${menu.page ? `data-nav-page="${menu.page}"` : ""}>
            <span>${esc(menu.label)}</span>
            <span class="nav-trigger-caret" aria-hidden="true"></span>
          </button>
          <div class="nav-panel${menu.kind === "groups" ? " nav-panel-wide" : ""}"
               id="nav-panel-${menu.id}"
               aria-labelledby="nav-trigger-${menu.id}">${panelMarkup(menu)}</div>
        </li>`;
      })
      .join("");
    return html;
  }

  function buildDrawer() {
    return buildDrawerMenus().map((menu) => {
      // Same as the header: nothing to expand, so it is a single button.
      if (menu.kind === "action") {
        return `
      <section class="drawer-group" data-menu="${menu.id}">
        <button class="drawer-group-trigger" type="button"
                data-action-id="${registerAction(menu.action)}">
          <span>${esc(menu.label)}</span>
        </button>
      </section>`;
      }
      return `
      <section class="drawer-group" data-menu="${menu.id}">
        <button class="drawer-group-trigger" type="button" aria-expanded="false"
                aria-controls="drawer-panel-${menu.id}">
          <span>${esc(menu.label)}</span>
          <span class="nav-trigger-caret" aria-hidden="true"></span>
        </button>
        <div class="drawer-group-panel" id="drawer-panel-${menu.id}">${panelMarkup(menu)}</div>
      </section>`;
    }).join("");
  }

  /* ---------------- desktop menu behaviour ---------------- */

  function setOpen(item, open) {
    item.dataset.open = String(open);
    item.querySelector(".nav-trigger").setAttribute("aria-expanded", String(open));
    if (open) {
      if (openMenu && openMenu !== item) setOpen(openMenu, false);
      openMenu = item;
    } else if (openMenu === item) {
      openMenu = null;
    }
  }

  function wireDesktop() {
    nav.querySelectorAll(".nav-item").forEach((item) => {
      const trigger = item.querySelector(".nav-trigger");
      // Panel-less menus (kind: "action") fire their action through the
      // delegated handler in wireActions; there is nothing to open or close.
      if (!item.querySelector(".nav-panel")) return;
      menus.push(item);

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        cancelClose();
        // A menu that owns a page opens it on click; hover still reveals the
        // dropdown, so both the overview and the shortcuts stay reachable.
        if (trigger.dataset.navPage) {
          window.location.href = `${trigger.dataset.navPage}.html`;
          return;
        }
        setOpen(item, item.dataset.open !== "true");
      });

      item.addEventListener("mouseenter", () => {
        cancelClose();
        setOpen(item, true);
      });
      item.addEventListener("mouseleave", () => {
        cancelClose();
        closeTimer = window.setTimeout(() => {
          closeTimer = null;
          setOpen(item, false);
        }, HOVER_CLOSE_DELAY);
      });

      item.addEventListener("focusin", () => {
        cancelClose();
        setOpen(item, true);
      });
      item.addEventListener("focusout", (event) => {
        if (!item.contains(event.relatedTarget)) setOpen(item, false);
      });
    });
  }

  const closeAll = () => {
    cancelClose();
    menus.forEach((item) => setOpen(item, false));
  };

  document.addEventListener("click", (event) => {
    if (openMenu && !openMenu.contains(event.target)) closeAll();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (openMenu) {
      const trigger = openMenu.querySelector(".nav-trigger");
      closeAll();
      trigger.focus();
    }
    closeDrawer();
  });

  /* ---------------- drawer behaviour ---------------- */

  let drawerReturnFocus = null;
  let drawerOpen = false;

  function openDrawer() {
    drawerReturnFocus = document.activeElement;
    drawerOpen = true;
    drawer.hidden = false;
    // Force a reflow so the transform transition has a starting value, then set
    // the state synchronously. Deferring this to rAF would leave the drawer
    // un-closable whenever that frame is delayed (background tab, heavy paint).
    void drawer.offsetHeight;
    drawer.dataset.open = "true";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    document.body.style.overflow = "hidden";
    drawer.querySelector(".nav-drawer-close")?.focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    drawer.dataset.open = "false";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.style.overflow = "";
    window.setTimeout(() => {
      if (!drawerOpen) drawer.hidden = true;
    }, 320);
    drawerReturnFocus?.focus?.({ preventScroll: true });
    drawerReturnFocus = null;
  }

  toggle.addEventListener("click", () => {
    if (drawerOpen) closeDrawer();
    else openDrawer();
  });

  drawer.querySelectorAll("[data-drawer-close]").forEach((el) =>
    el.addEventListener("click", closeDrawer)
  );

  // Keep focus inside the drawer while it is open.
  drawer.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !drawerOpen) return;
    const focusables = drawer.querySelectorAll(
      'button, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ---------------- shared item activation ---------------- */

  function wireDrawerGroups() {
    drawerBody.querySelectorAll(".drawer-group").forEach((group) => {
      const trigger = group.querySelector(".drawer-group-trigger");
      if (!group.querySelector(".drawer-group-panel")) return;
      trigger.addEventListener("click", () => {
        const open = group.dataset.open !== "true";
        group.dataset.open = String(open);
        trigger.setAttribute("aria-expanded", String(open));
      });
    });
  }

  function wireActions(root, afterActivate) {
    root.addEventListener("click", (event) => {
      const link = event.target.closest("[data-action-id]");
      if (!link) return;
      const action = actions.get(link.dataset.actionId);
      if (!action) return;
      afterActivate();
      onAction(action);
    });
  }

  /**
   * The menus are derived from the content, so they are rebuilt whenever the
   * content changes — an admin save, or a Firestore snapshot landing.
   *
   * The per-item listeners live on markup that innerHTML has just replaced, so
   * they have to be reattached; the registry and the open-menu bookkeeping have
   * to be cleared or they accumulate stale entries across rebuilds. wireActions
   * is delegated on nav and drawerBody, which survive, so it is wired once.
   */
  let lastNavMarkup = "";

  function rebuild() {
    // Ids restart from zero so identical content produces identical markup —
    // the map is re-registered either way, but the DOM is only replaced when
    // something actually changed. A Firestore snapshot that changed nothing
    // must not wipe the header out from under keyboard focus.
    actions.clear();
    actionSeq = 0;
    const desktopHtml = buildDesktop();
    const drawerHtml = buildDrawer() +
      '<div class="drawer-contact">' + contactStripMarkup() + "</div>";
    if (desktopHtml + drawerHtml === lastNavMarkup) return;
    lastNavMarkup = desktopHtml + drawerHtml;
    menus.length = 0;
    openMenu = null;
    nav.innerHTML = `<ul class="site-nav-list">${desktopHtml}</ul>`;
    drawerBody.innerHTML = drawerHtml;
    wireDesktop();
    wireDrawerGroups();
  }

  rebuild();
  wireActions(nav, closeAll);
  wireActions(drawerBody, closeDrawer);
  subscribe(rebuild);

  return { closeAll, closeDrawer };
}
