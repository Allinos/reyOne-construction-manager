/* =============================================================
 * projects.js — Render project cards & before/after slider
 * -------------------------------------------------------------
 * Renders window.PROJECTS into any [data-projects] container.
 * Attributes on the container:
 *   data-projects            -> render all projects
 *   data-projects-limit="3"  -> render only the first N
 *
 * FUTURE BACKEND INTEGRATION:
 *   Replace the window.PROJECTS source with data from:
 *     GET /api/projects
 * ============================================================= */

(function () {
  "use strict";

  /* Build the media area: real image if present, else a clear placeholder. */
  function mediaHtml(p) {
    if (p.image) {
      return (
        '<div class="project-card__media">' +
        '<img src="' + p.image + '" alt="' +
        (p.imageAlt || p.name) +
        '" width="640" height="480" loading="lazy" decoding="async"></div>'
      );
    }
    return (
      '<div class="project-card__media">' +
      '<div class="img-placeholder">' +
      iconSvg("image") +
      "<span>Project image placeholder — real photo to be added</span>" +
      "</div></div>"
    );
  }

  function iconSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
      '<circle cx="8.5" cy="8.5" r="1.5"/>' +
      '<path d="M21 15l-5-5L5 21"/></svg>'
    );
  }

  function cardHtml(p) {
    var placeholderBadge = p.placeholder
      ? ' <span class="badge-placeholder">Sample</span>'
      : "";
    return (
      '<a class="project-card" href="' + p.page + '">' +
      mediaHtml(p) +
      '<div class="project-card__body">' +
      '<span class="tag">' + p.type + "</span>" +
      '<div class="project-card__meta">' +
      "<span>" + p.location + "</span>" +
      (p.year ? "<span>• " + p.year + "</span>" : "") +
      "</div>" +
      "<h3>" + p.name + placeholderBadge + "</h3>" +
      "<p>" + p.summary + "</p>" +
      '<span class="card__link">View project ' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
      "</div></a>"
    );
  }

  function renderLists() {
    var projects = window.PROJECTS || [];
    document.querySelectorAll("[data-projects]").forEach(function (container) {
      var limit = parseInt(container.getAttribute("data-projects-limit"), 10);
      var list = isNaN(limit) ? projects : projects.slice(0, limit);
      container.innerHTML = list.map(cardHtml).join("");
    });
  }

  /* Before/After slider — pure vanilla, pointer + range input. */
  function initBeforeAfter() {
    document.querySelectorAll(".ba-slider").forEach(function (slider) {
      var after = slider.querySelector(".ba-after");
      var handle = slider.querySelector(".ba-handle");
      var range = slider.querySelector(".ba-range");
      if (!after || !handle || !range) return;

      function set(v) {
        var pct = Math.max(0, Math.min(100, v));
        after.style.clipPath = "inset(0 0 0 " + pct + "%)";
        handle.style.left = pct + "%";
      }
      range.addEventListener("input", function () { set(range.value); });
      set(range.value || 50);
    });
  }

  function init() {
    renderLists();
    initBeforeAfter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
