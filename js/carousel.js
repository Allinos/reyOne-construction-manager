/* =============================================================
 * carousel.js — Auto-scrolling card carousel
 * -------------------------------------------------------------
 * Enhances any [data-carousel] containing a [data-carousel-track].
 * The track is a horizontal, scroll-snap flex row of cards. This
 * module adds:
 *   - Auto-advance one card at a time (loops back to start).
 *   - Pagination dots (one per card) with an active indicator.
 *   - Pause on hover / touch / focus; resume shortly after.
 *   - Fully responsive: works with 3-up (desktop), 2-up (tablet)
 *     or 1-up (mobile) — card widths are driven by CSS.
 *
 * Runs AFTER js/projects.js so the cards already exist in the DOM.
 * Respects prefers-reduced-motion (no auto-advance).
 * ============================================================= */

(function () {
  "use strict";

  var INTERVAL_MS = 3500;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setup(root) {
    var track = root.querySelector("[data-carousel-track]");
    var dotsWrap = root.querySelector("[data-carousel-dots]");
    if (!track) return;

    var cards = Array.prototype.slice.call(track.children);
    if (cards.length < 2) {
      if (dotsWrap) dotsWrap.style.display = "none";
      return;
    }

    /* Distance between the start of consecutive cards (card + gap). */
    function step() {
      if (cards.length < 2) return track.clientWidth;
      return cards[1].getBoundingClientRect().left -
        cards[0].getBoundingClientRect().left;
    }

    function currentIndex() {
      var s = step();
      return s ? Math.round(track.scrollLeft / s) : 0;
    }

    function maxIndex() {
      var s = step();
      if (!s) return 0;
      // last index the track can actually rest at (right-clamped)
      return Math.max(0, Math.round((track.scrollWidth - track.clientWidth) / s));
    }

    function goTo(i) {
      var s = step();
      track.scrollTo({ left: i * s, behavior: "smooth" });
    }

    /* ---- Dots (one per card) ---- */
    var dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      cards.forEach(function (_, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "carousel__dot";
        b.setAttribute("aria-label", "Go to project " + (i + 1));
        b.addEventListener("click", function () {
          pause();
          goTo(Math.min(i, maxIndex()));
        });
        dotsWrap.appendChild(b);
        dots.push(b);
      });
    }

    function syncDots() {
      var idx = currentIndex();
      dots.forEach(function (d, i) {
        var active = i === idx;
        d.classList.toggle("is-active", active);
        if (active) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    }

    /* ---- Auto-advance ---- */
    var timer = null;
    function advance() {
      var next = currentIndex() + 1;
      if (next > maxIndex()) next = 0; // loop
      goTo(next);
    }
    function play() {
      if (reduce || timer) return;
      timer = window.setInterval(advance, INTERVAL_MS);
    }
    function pause() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    // Pause on interaction, resume after a short idle.
    var resumeTimer = null;
    function bumpResume() {
      pause();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(play, 4000);
    }

    root.addEventListener("mouseenter", pause);
    root.addEventListener("mouseleave", play);
    root.addEventListener("focusin", pause);
    root.addEventListener("focusout", play);
    track.addEventListener("pointerdown", bumpResume, { passive: true });
    track.addEventListener("wheel", bumpResume, { passive: true });

    // Keep dots in sync while scrolling (rAF-throttled).
    var ticking = false;
    track.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          syncDots();
          ticking = false;
        });
      },
      { passive: true }
    );

    // Recompute on resize (card widths change across breakpoints).
    window.addEventListener("resize", syncDots);

    syncDots();
    play();
  }

  function init() {
    document.querySelectorAll("[data-carousel]").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
