/* =============================================================
 * faq.js — Accessible accordion
 * -------------------------------------------------------------
 * Progressive enhancement:
 *   - Works with server-rendered .faq-item markup, OR
 *   - Renders items from window.FAQS into [data-faq-list].
 *
 * Accessibility:
 *   - Each question is a <button> with aria-expanded + aria-controls
 *   - Answer region has role via id linkage; max-height animates open
 * ============================================================= */

(function () {
  "use strict";

  function buildFromData(container) {
    var faqs = window.FAQS || [];
    var frag = document.createDocumentFragment();

    faqs.forEach(function (item, i) {
      var wrap = document.createElement("div");
      wrap.className = "faq-item";

      var id = "faq-a-" + i;
      var btn = document.createElement("button");
      btn.className = "faq-q";
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", id);
      btn.innerHTML =
        "<span>" + item.q + "</span><span class='plus' aria-hidden='true'></span>";

      var ans = document.createElement("div");
      ans.className = "faq-a";
      ans.id = id;
      ans.setAttribute("role", "region");
      var inner = document.createElement("div");
      inner.className = "faq-a__inner";
      inner.textContent = item.a;
      ans.appendChild(inner);

      wrap.appendChild(btn);
      wrap.appendChild(ans);
      frag.appendChild(wrap);
    });

    container.appendChild(frag);
  }

  function wire(list) {
    list.querySelectorAll(".faq-q").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var expanded = btn.getAttribute("aria-expanded") === "true";
        var answer = document.getElementById(
          btn.getAttribute("aria-controls")
        );

        // Optional single-open behaviour: close siblings.
        if (!expanded && list.hasAttribute("data-faq-single")) {
          list.querySelectorAll(".faq-q[aria-expanded='true']").forEach(function (o) {
            o.setAttribute("aria-expanded", "false");
            var a = document.getElementById(o.getAttribute("aria-controls"));
            if (a) a.style.maxHeight = null;
          });
        }

        btn.setAttribute("aria-expanded", String(!expanded));
        if (answer) {
          answer.style.maxHeight = expanded ? null : answer.scrollHeight + "px";
        }
      });
    });
  }

  function init() {
    var list = document.querySelector("[data-faq-list]");
    if (!list) return;
    // If empty, build from data layer.
    if (!list.querySelector(".faq-item")) buildFromData(list);
    wire(list);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
