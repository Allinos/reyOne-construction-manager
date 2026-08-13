/* =============================================================
 * main.js — App bootstrap & shared renderers
 * -------------------------------------------------------------
 * Responsibilities:
 *   - Inject config-driven text (company name, contact, year)
 *   - Render service cards from data/services.js
 *   - Render testimonials from data/testimonials.js
 *   - Small shared UI helpers
 *
 * Loads AFTER config + data files (see script order in HTML).
 * ============================================================= */

(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};

  /* ---- Reusable inline icon set (no external icon library) ---- */
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h4"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 2 2M17 6l2 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };

  function svg(name) {
    var path = ICONS[name] || ICONS.grid;
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + path + "</svg>"
    );
  }

  /* ---- Config-driven text injection ---- */
  function injectConfig() {
    document.querySelectorAll("[data-company]").forEach(function (el) {
      el.textContent = cfg.companyName || "DW Nirman Engineerings LLP";
    });
    document.querySelectorAll("[data-config='email']").forEach(function (el) {
      el.textContent = maskPlaceholder(cfg.email, "[EMAIL]");
    });
    document.querySelectorAll("[data-config='phone']").forEach(function (el) {
      el.textContent = maskPlaceholder(cfg.phoneNumber, "[PHONE]");
    });
    document.querySelectorAll("[data-config='phoneAlt']").forEach(function (el) {
      el.textContent = maskPlaceholder(cfg.phoneNumberAlt, "[PHONE]");
    });
    document.querySelectorAll("[data-config='address']").forEach(function (el) {
      el.textContent = cfg.officeAddress || "[LEGAL BUSINESS ADDRESS]";
    });
    document.querySelectorAll("[data-config='hours']").forEach(function (el) {
      el.textContent = cfg.businessHours || "";
    });
    document.querySelectorAll("[data-config='serviceArea']").forEach(function (el) {
      el.textContent = cfg.serviceArea || "[SERVICE AREA]";
    });
    document.querySelectorAll("[data-config='gst']").forEach(function (el) {
      el.textContent = (cfg.credentials && cfg.credentials.gstNumber) || "[GST NUMBER]";
    });
    document.querySelectorAll("[data-config='llpin']").forEach(function (el) {
      el.textContent = (cfg.credentials && cfg.credentials.llpin) || "[LLPIN]";
    });

    // Google reviews CTA
    document.querySelectorAll("[data-google-reviews]").forEach(function (el) {
      var url = cfg.googleReviewsUrl || "";
      if (url && url.indexOf("REPLACE") === -1) {
        el.setAttribute("href", url);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      } else {
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("title", "Add your Google Business Profile URL in js/config.js");
      }
    });

    // Social links
    document.querySelectorAll("[data-social]").forEach(function (el) {
      var key = el.getAttribute("data-social");
      var url = (cfg.social && cfg.social[key]) || "";
      if (url && url.indexOf("REPLACE") === -1) {
        el.setAttribute("href", url);
      } else {
        el.setAttribute("href", "#");
        el.setAttribute("aria-disabled", "true");
      }
    });

    // Service-area map embed (with red locator). Falls back to a styled
    // placeholder when no embed URL is configured.
    document.querySelectorAll("[data-map-embed]").forEach(function (iframe) {
      var url = cfg.serviceAreaMapEmbedUrl || "";
      var panel = iframe.closest(".map-panel");
      var placeholder = panel ? panel.querySelector("[data-map-placeholder]") : null;
      if (url && url.indexOf("REPLACE") === -1) {
        iframe.setAttribute("src", url);
        iframe.style.display = "block";
        if (placeholder) placeholder.style.display = "none";
      } else {
        iframe.style.display = "none";
        if (placeholder) placeholder.style.display = "grid";
      }
    });

    // Current year
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  function maskPlaceholder(value, fallback) {
    if (!value || value.indexOf("REPLACE") !== -1) return fallback;
    return value;
  }

  /* ---- Services ---- */
  function serviceCard(s) {
    var badge = s.confirmed
      ? ""
      : '<span class="badge-config">Configurable</span>';
    return (
      '<article class="card" data-reveal>' +
      '<div class="card__icon">' + svg(s.icon) + "</div>" +
      "<h3>" + s.title + badge + "</h3>" +
      "<p>" + s.short + "</p>" +
      '<a class="card__link" href="' + s.page + '">Learn more ' +
      svg("arrow") + "</a>" +
      "</article>"
    );
  }

  function renderServices() {
    var services = window.SERVICES || [];
    document.querySelectorAll("[data-services]").forEach(function (c) {
      var limit = parseInt(c.getAttribute("data-services-limit"), 10);
      var list = isNaN(limit) ? services : services.slice(0, limit);
      c.innerHTML = list.map(serviceCard).join("");
    });
  }

  /* ---- Testimonials ---- */
  function initials(name) {
    var clean = (name || "").replace(/[\[\]]/g, "").trim();
    if (!clean) return "•";
    var parts = clean.split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function testimonialCard(t) {
    var tag = t.placeholder
      ? ' <span class="badge-placeholder">Sample</span>'
      : "";
    return (
      '<figure class="testimonial" data-reveal>' +
      '<blockquote class="testimonial__quote">' + t.quote + "</blockquote>" +
      '<figcaption class="testimonial__who">' +
      '<span class="testimonial__avatar" aria-hidden="true">' +
      initials(t.name) + "</span><span>" +
      '<span class="testimonial__name">' + t.name + tag + "</span>" +
      '<span class="testimonial__role">' + t.projectType +
      (t.location ? " • " + t.location : "") + "</span>" +
      "</span></figcaption></figure>"
    );
  }

  function renderTestimonials() {
    var items = window.TESTIMONIALS || [];
    document.querySelectorAll("[data-testimonials]").forEach(function (c) {
      c.innerHTML = items.map(testimonialCard).join("");
    });
  }

  function init() {
    injectConfig();
    renderServices();
    renderTestimonials();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
