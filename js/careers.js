/* =============================================================
 * careers.js — "We're Hiring" animated popup
 * -------------------------------------------------------------
 * Controls the #hire-pop corner toast that invites visitors to
 * the Careers page. Behaviour:
 *   - Slides in ~2.5s after load (once per browser session, so it
 *     doesn't reappear on every page navigation).
 *   - Dismissible via the close (×) button.
 *   - Hidden automatically on the Careers page itself.
 *
 * Respects prefers-reduced-motion (the CSS drops the animation).
 * ============================================================= */

(function () {
  "use strict";

  var SHOW_DELAY_MS = 2500;
  var SESSION_KEY = "dwHirePopSeen";

  function init() {
    var pop = document.getElementById("hire-pop");
    if (!pop) return;

    // Don't nag on the Careers page — they're already here.
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (page === "career.html") return;

    function open() {
      pop.hidden = false;
      // next frame -> trigger the CSS slide-in transition
      requestAnimationFrame(function () {
        pop.classList.add("is-visible");
      });
    }

    function close() {
      pop.classList.remove("is-visible");
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
      window.setTimeout(function () { pop.hidden = true; }, 400);
    }

    pop.querySelectorAll("[data-hire-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    // Dismiss (as seen) once the visitor clicks through to Careers.
    var cta = pop.querySelector(".hire-pop__cta");
    if (cta) cta.addEventListener("click", function () {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
    });

    var seen = false;
    try { seen = sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) {}
    if (!seen) window.setTimeout(open, SHOW_DELAY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
