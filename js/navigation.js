/* =============================================================
 * navigation.js — Header behaviour & mobile menu
 * -------------------------------------------------------------
 *   - Adds .is-scrolled to the header past a scroll threshold
 *   - Toggles the accessible slide-down mobile menu
 *   - Marks the current page link with aria-current
 *   - Closes menu on Escape / link click / resize to desktop
 * ============================================================= */

(function () {
  "use strict";

  function init() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav__toggle");
    var menu = document.getElementById("mobile-menu");

    /* Sticky header state on scroll */
    if (header) {
      var onScroll = function () {
        if (window.scrollY > 12) header.classList.add("is-scrolled");
        else header.classList.remove("is-scrolled");
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    /* Mobile menu open/close */
    function closeMenu() {
      if (!menu || !toggle) return;
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    }
    function openMenu() {
      if (!menu || !toggle) return;
      menu.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
    }

    if (toggle && menu) {
      toggle.addEventListener("click", function () {
        var expanded = toggle.getAttribute("aria-expanded") === "true";
        if (expanded) closeMenu();
        else openMenu();
      });

      // Close on link click
      menu.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", closeMenu);
      });

      // Close on Escape
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeMenu();
      });

      // Close when resizing up to desktop
      window.addEventListener("resize", function () {
        if (window.innerWidth > 900) closeMenu();
      });
    }

    /* Mark current page in nav */
    var path = location.pathname.split("/").pop() || "index.html";
    document
      .querySelectorAll(".nav__links a, .mobile-menu a.m-link")
      .forEach(function (a) {
        var href = a.getAttribute("href");
        if (!href) return;
        var target = href.split("/").pop();
        if (target === path) a.setAttribute("aria-current", "page");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
