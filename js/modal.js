/* =============================================================
 * modal.js — Lead-capture popup
 * -------------------------------------------------------------
 * Controls the global #lead-modal popup that contains the
 * Project Planner. Behaviour:
 *   - Auto-opens 5 seconds after page load (once per browser
 *     session, so it doesn't reappear on every page navigation).
 *   - Can be dismissed via the close button, the backdrop, or Esc.
 *   - Any element with [data-open-modal] opens it on click.
 *
 * Accessibility:
 *   - role="dialog" aria-modal, focus moves into the dialog on
 *     open and returns to the trigger on close, Esc closes.
 * ============================================================= */

(function () {
  "use strict";

  var AUTO_DELAY_MS = 5000;
  var SESSION_KEY = "dwLeadModalSeen";

  function init() {
    var modal = document.getElementById("lead-modal");
    if (!modal) return;

    var dialog = modal.querySelector(".modal__dialog");
    var lastFocused = null;

    function open() {
      if (modal.classList.contains("is-open")) return;
      lastFocused = document.activeElement;
      modal.hidden = false;
      // next frame -> trigger CSS transition
      requestAnimationFrame(function () {
        modal.classList.add("is-open");
      });
      document.body.classList.add("modal-open");
      // Move focus to the close button for keyboard users.
      var closeBtn = modal.querySelector(".modal__close");
      if (closeBtn) closeBtn.focus();
      // Remember for this session so it won't auto-open again.
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
    }

    function close() {
      if (!modal.classList.contains("is-open")) return;
      modal.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      // wait for transition before hiding from AT / layout
      window.setTimeout(function () {
        modal.hidden = true;
      }, 300);
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    // Expose for other modules (e.g. lead.js closes it after handoff).
    window.DWModal = { open: open, close: close, el: modal };

    // Close triggers (backdrop + close button both carry data-modal-close)
    modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });

    // Open triggers anywhere on the page
    document.querySelectorAll("[data-open-modal]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        open();
      });
    });

    // Escape closes; keep focus within the dialog while open
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && modal.classList.contains("is-open")) {
        trapFocus(e, dialog);
      }
    });

    // Auto-open once per session
    var seen = false;
    try { seen = sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) {}
    if (!seen) {
      window.setTimeout(open, AUTO_DELAY_MS);
    }
  }

  function trapFocus(e, container) {
    if (!container) return;
    var focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    var visible = Array.prototype.filter.call(focusable, function (el) {
      return el.offsetParent !== null; // skip hidden planner steps
    });
    if (!visible.length) return;
    var first = visible[0];
    var last = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
