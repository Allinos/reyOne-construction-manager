/* =============================================================
 * whatsapp.js — WhatsApp conversion system
 * -------------------------------------------------------------
 * WhatsApp is the PRIMARY lead channel. This module:
 *   - Builds wa.me links from SITE_CONFIG.whatsappNumber
 *   - Generates context-aware prefilled messages
 *   - Wires every [data-wa] element to open WhatsApp
 *
 * Usage in HTML:
 *   <a data-wa>WhatsApp Us</a>                 -> default message
 *   <a data-wa data-wa-service="Renovation">   -> service message
 *   <a data-wa data-wa-project="Villa X">      -> project message
 *   <a data-wa data-wa-message="Custom text">  -> explicit message
 *
 * FUTURE BACKEND INTEGRATION:
 *   Click events could additionally POST an analytics/lead event
 *   to POST /api/leads before redirecting to WhatsApp.
 * ============================================================= */

(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};

  /* Build a wa.me URL with an encoded prefilled message. */
  function buildWaUrl(message) {
    var number = (cfg.whatsappNumber || "").replace(/[^\d]/g, "");
    var text = encodeURIComponent(message || cfg.defaultWhatsappMessage || "");
    // If the number is still a placeholder, link to wa.me without a number
    // so the site does not silently break; developer should replace it.
    if (!number || number.indexOf("REPLACE") !== -1) {
      return "https://wa.me/?text=" + text;
    }
    return "https://wa.me/" + number + "?text=" + text;
  }

  /* Decide which message to use for a given element. */
  function messageFor(el) {
    if (el.getAttribute("data-wa-message")) {
      return el.getAttribute("data-wa-message");
    }
    var service = el.getAttribute("data-wa-service");
    if (service) {
      return (
        "Hi DW Nirman Engineerings, I am interested in your " +
        service +
        " service. I would like to discuss my requirement."
      );
    }
    var project = el.getAttribute("data-wa-project");
    if (project) {
      return (
        "Hi DW Nirman Engineerings, I am interested in a project similar to " +
        project +
        ". I would like to discuss my requirement."
      );
    }
    var context = el.getAttribute("data-wa-context");
    if (context === "contact") {
      return "Hi DW Nirman Engineerings, I would like to discuss my construction project.";
    }
    return cfg.defaultWhatsappMessage;
  }

  /* Public helper so other modules (e.g. Project Planner) can reuse. */
  window.DWWhatsApp = {
    url: buildWaUrl,
    open: function (message) {
      window.open(buildWaUrl(message), "_blank", "noopener");
    }
  };

  function init() {
    var links = document.querySelectorAll("[data-wa]");
    links.forEach(function (el) {
      var url = buildWaUrl(messageFor(el));
      // Anchors get href; buttons get a click handler.
      if (el.tagName === "A") {
        el.setAttribute("href", url);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      } else {
        el.addEventListener("click", function () {
          window.open(url, "_blank", "noopener");
        });
      }
    });

    /* Wire tel: links from config */
    document.querySelectorAll("[data-tel]").forEach(function (el) {
      var phone = (cfg.phoneNumber || "").replace(/\s+/g, "");
      if (phone && phone.indexOf("REPLACE") === -1) {
        el.setAttribute("href", "tel:" + phone);
      }
    });

    /* Wire secondary tel: links from config */
    document.querySelectorAll("[data-tel-alt]").forEach(function (el) {
      var phone = (cfg.phoneNumberAlt || "").replace(/\s+/g, "");
      if (phone && phone.indexOf("REPLACE") === -1) {
        el.setAttribute("href", "tel:" + phone);
      }
    });

    /* Wire mailto: links from config */
    document.querySelectorAll("[data-email]").forEach(function (el) {
      var email = cfg.email || "";
      if (email && email.indexOf("REPLACE") === -1) {
        el.setAttribute("href", "mailto:" + email);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
