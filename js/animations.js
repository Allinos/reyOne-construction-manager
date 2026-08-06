/* =============================================================
 * animations.js — Scroll reveal + hero entrance
 * -------------------------------------------------------------
 * Uses IntersectionObserver to add `.is-visible` to [data-reveal]
 * elements as they enter the viewport. Extremely lightweight.
 * Respects prefers-reduced-motion (handled in CSS + guarded here).
 * ============================================================= */

(function () {
  "use strict";

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function init() {
    var els = document.querySelectorAll("[data-reveal]");

    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    els.forEach(function (el) { io.observe(el); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
