/* =============================================================
 * lead.js — Project Planner (qualification -> WhatsApp)
 * -------------------------------------------------------------
 * A multi-step "Project Planner" that qualifies the enquiry and,
 * at the end, hands off to WhatsApp with a personalised message.
 *
 * DESIGN DECISIONS (per brief):
 *   - WhatsApp is the primary conversion; this is NOT a form that
 *     posts data anywhere right now.
 *   - No sensitive data is written to localStorage.
 *
 * FUTURE BACKEND INTEGRATION:
 *   The collected `lead` object is intentionally shaped to match a
 *   future API payload. To persist leads later, replace the
 *   handoff in `finish()` with:
 *
 *     // POST /api/leads
 *     // fetch('/api/leads', {
 *     //   method: 'POST',
 *     //   headers: { 'Content-Type': 'application/json' },
 *     //   body: JSON.stringify(lead)
 *     // }).then(...)
 *
 *   Recommended backend fields:
 *     name, phone, projectType, location, area, budget,
 *     timeline, source, landingPage, createdAt
 *
 *   Recommended architecture:
 *     Website -> POST /api/leads -> Node.js + Express ->
 *     Google Sheets API or Database -> Excel/CSV export
 *     (e.g. GET /api/leads/export.csv)
 *   Do NOT expose Google API credentials in this static site.
 * ============================================================= */

(function () {
  "use strict";

  function init() {
    var planner = document.querySelector("[data-planner]");
    if (!planner) return;

    var steps = Array.prototype.slice.call(
      planner.querySelectorAll(".planner__step")
    );
    var bars = Array.prototype.slice.call(
      planner.querySelectorAll(".planner__progress span")
    );
    var current = 0;

    /* Collected lead — shaped for a future POST /api/leads payload. */
    var lead = {
      projectType: "",
      area: "",
      location: "",
      budget: "",
      timeline: "",
      name: "",
      phone: "",
      source: "website-project-planner",
      landingPage: location.pathname,
      createdAt: null // set on finish
    };

    function show(i) {
      steps.forEach(function (s, idx) {
        s.classList.toggle("is-active", idx === i);
      });
      bars.forEach(function (b, idx) {
        b.classList.toggle("is-active", idx <= i);
      });
      current = i;
      // Move focus to the step heading for screen readers.
      var heading = steps[i].querySelector(".planner__q");
      if (heading) heading.setAttribute("tabindex", "-1"), heading.focus();
    }

    /* Option buttons: single-select within their step group. */
    planner.querySelectorAll(".option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        var field = opt.getAttribute("data-field");
        var value = opt.getAttribute("data-value");
        lead[field] = value;

        // Visual selection within the same group.
        planner
          .querySelectorAll('.option[data-field="' + field + '"]')
          .forEach(function (o) { o.classList.remove("is-selected"); });
        opt.classList.add("is-selected");

        // Auto-advance for quick single-choice steps.
        if (opt.hasAttribute("data-advance")) {
          setTimeout(function () { next(); }, 220);
        }
      });
    });

    function validateStep(i) {
      var step = steps[i];
      var required = step.getAttribute("data-require");
      if (!required) return true;
      return required.split(",").every(function (key) {
        // text inputs
        var input = step.querySelector('[data-input="' + key + '"]');
        if (input) {
          lead[key] = input.value.trim();
          if (!lead[key]) { input.focus(); input.classList.add("is-error"); return false; }
          input.classList.remove("is-error");
          return true;
        }
        // option groups
        return !!lead[key];
      });
    }

    function next() {
      if (!validateStep(current)) return;
      if (current < steps.length - 1) {
        show(current + 1);
        if (steps[current].hasAttribute("data-summary")) renderSummary();
      }
    }
    function prev() {
      if (current > 0) show(current - 1);
    }

    planner.querySelectorAll("[data-next]").forEach(function (b) {
      b.addEventListener("click", next);
    });
    planner.querySelectorAll("[data-prev]").forEach(function (b) {
      b.addEventListener("click", prev);
    });

    /* Render a review summary before the WhatsApp handoff. */
    function renderSummary() {
      var el = planner.querySelector("[data-summary-target]");
      if (!el) return;
      var rows = [
        ["Project", lead.projectType],
        ["Size", lead.area],
        ["Location", lead.location],
        ["Budget", lead.budget],
        ["Start", lead.timeline],
        ["Name", lead.name],
        ["Phone / WhatsApp", lead.phone]
      ];
      el.innerHTML =
        "<dl>" +
        rows
          .map(function (r) {
            return (
              "<dt>" + r[0] + "</dt><dd>" + (r[1] || "—") + "</dd>"
            );
          })
          .join("") +
        "</dl>";
    }

    /* Build the personalised WhatsApp message from the lead. */
    function buildMessage() {
      var parts = [];
      parts.push("Hi DW Nirman Engineerings, I am planning a project.");
      if (lead.projectType) parts.push("Type: " + lead.projectType + ".");
      if (lead.area) parts.push("Approximate size: " + lead.area + ".");
      if (lead.location) parts.push("Location: " + lead.location + ".");
      if (lead.budget) parts.push("Budget range: " + lead.budget + ".");
      if (lead.timeline) parts.push("Expected start: " + lead.timeline + ".");
      if (lead.name) parts.push("My name is " + lead.name + ".");
      if (lead.phone) parts.push("Phone/WhatsApp: " + lead.phone + ".");
      parts.push("I would like to discuss the project.");
      return parts.join(" ");
    }

    /* Final handoff — WhatsApp now; POST /api/leads in the future. */
    function finish() {
      // validate the details step (name + phone)
      if (!validateStep(current)) return;
      lead.createdAt = new Date().toISOString();

      // FUTURE BACKEND INTEGRATION:
      // Replace/augment this WhatsApp handoff with a POST to /api/leads.
      // Example:
      //   fetch('/api/leads', { method:'POST',
      //     headers:{'Content-Type':'application/json'},
      //     body: JSON.stringify(lead) });

      var url = window.DWWhatsApp
        ? window.DWWhatsApp.url(buildMessage())
        : "https://wa.me/?text=" + encodeURIComponent(buildMessage());
      window.open(url, "_blank", "noopener");
    }

    var finishBtn = planner.querySelector("[data-finish]");
    if (finishBtn) finishBtn.addEventListener("click", finish);

    // init
    show(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
