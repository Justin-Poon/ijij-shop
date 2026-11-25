// Product page: live prices, discount codes, the 21-day bump, reviews and the on-page
// Stripe payment form. Amounts are always recalculated on the server.
(function () {
  const $ = (id) => document.getElementById(id);
  const form = $("checkout");
  const btn = $("purchase");
  // ---- Listing-image A/B test --------------------------------------------------------
  // Each visitor is put in version A (cover only) or B (image gallery) at random, 50/50, and stays
  // there (remembered in this browser). ?v=a / ?v=b forces a version. The version is sent with the
  // page view and the checkout, so the shop admin can compare which one sells better.
  const variant = (function () {
    const forced = new URLSearchParams(location.search).get("v");
    let v = forced === "a" || forced === "b" ? forced : null;
    try { v = v || localStorage.getItem("ijij-ab"); } catch {}
    if (v !== "a" && v !== "b") v = Math.random() < 0.5 ? "a" : "b";
    try { localStorage.setItem("ijij-ab", v); } catch {}
    return v;
  })();
  if (variant === "b") {
    document.body.classList.add("v-b");
    const g = $("gallery"), track = $("g-track"), dots = $("g-dots");
    if (g && track && dots) {
      g.hidden = false;
      [...track.children].forEach((_, i) => { const d = document.createElement("button"); d.setAttribute("aria-label", `Image ${i + 1}`); d.onclick = () => track.scrollTo({ left: track.clientWidth * i, behavior: "smooth" }); dots.append(d); });
      const mark = () => { const i = Math.round(track.scrollLeft / track.clientWidth); [...dots.children].forEach((d, j) => d.classList.toggle("on", j === i)); };
      track.addEventListener("scroll", mark, { passive: true }); mark();
    }
  }
  const state = { upgrade: false, code: "", total: null, currency: "usd", stripe: null, elements: null, busy: false, turnstile: "", turnstileId: null };

  // ---- Attribution -------------------------------------------------------------------
  // Remember where this visitor first came from (TikTok, Instagram...) for 30 days, so a
  // purchase made on a later visit still counts for the right source. Stored only in this browser.
  const attribution = (function () {
    const qs = new URLSearchParams(location.search);
    const fresh = {
      source: qs.get("src") || qs.get("utm_source") || "",
      campaign: qs.get("c") || qs.get("utm_campaign") || "",
      referrer: document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : "",
    };
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("ijij-attr") || "null"); } catch {}
    const visitor = (saved && saved.visitor) || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Math.random()).slice(2) + Date.now());
    const expired = !saved || Date.now() - (saved.at || 0) > 30 * 86400000;
    const a = !expired && !fresh.source ? saved : { ...fresh, visitor, at: Date.now() };
    a.visitor = visitor;
    try { localStorage.setItem("ijij-attr", JSON.stringify(a)); } catch {}
    return a;
  })();
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: attribution.source, campaign: attribution.campaign, referrer: attribution.referrer, visitor: attribution.visitor, variant }),
    keepalive: true,
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      // Lock in what the server worked out (e.g. "tiktok" from the in-app browser) for later visits.
      if (d && d.source && !attribution.source) {
        attribution.source = d.source;
        try { localStorage.setItem("ijij-attr", JSON.stringify(attribution)); } catch {}
      }
    })
    .catch(() => {});

  // ---- Bot check (Cloudflare Turnstile) ----------------------------------------------
  function mountTurnstile(siteKey) {
    if (!siteKey) return;
    window.onTurnstileLoad = function () {
      state.turnstileId = window.turnstile.render("#turnstile", {
        sitekey: siteKey,
        action: "checkout",
        appearance: "interaction-only",
        callback: (t) => (state.turnstile = t),
        // Invisible for most people: only open up space if Cloudflare needs the visitor to click.
        "before-interactive-callback": () => $("turnstile").classList.add("show"),
        "after-interactive-callback": () => $("turnstile").classList.remove("show"),
        "error-callback": () => { $("turnstile").classList.add("show"); },
        "expired-callback": () => (state.turnstile = ""),
      });
    };
    const sc = document.createElement("script");
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
    sc.async = true;
    document.head.appendChild(sc);
  }

  const setPrice = (key, text) => document.querySelectorAll(`[data-price="${key}"]`).forEach((el) => (el.textContent = text));
  const payError = (msg) => ($("pay-error").textContent = msg || "");

  // ---- Totals ------------------------------------------------------------------------
  async function refreshQuote() {
    const r = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upgrade: state.upgrade, code: state.code }),
    });
    if (!r.ok) throw new Error("quote");
    const q = await r.json();
    state.total = q.total;
    state.currency = q.currency;
    $("total").textContent = q.totalDisplay;
    $("line-discount").hidden = !q.discount;
    $("discount").textContent = q.discount ? `-${q.discountDisplay}` : "";
    if (state.elements) state.elements.update({ amount: q.total });
    return q;
  }

  $("upgrade").addEventListener("change", (e) => {
    state.upgrade = e.target.checked;
    refreshQuote().catch(() => {});
  });

  async function applyCode() {
    const typed = $("code").value.trim();
    const msg = $("code-msg");
    msg.className = "code-msg";
    state.code = typed;
    try {
      const q = await refreshQuote();
      if (!typed) return (msg.textContent = "");
      if (q.codeError) {
        state.code = "";
        msg.textContent = q.codeError;
        msg.classList.add("bad");
        await refreshQuote();
      } else {
        msg.textContent = `${q.code} applied: you save ${q.discountDisplay}`;
        msg.classList.add("good");
      }
    } catch {
      msg.textContent = "Couldn't check that code. Try again.";
      msg.classList.add("bad");
    }
  }
  $("apply").addEventListener("click", applyCode);
  $("code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCode();
    }
  });

  // ---- Stripe payment form -----------------------------------------------------------
  function mountStripe(cfg) {
    if (!window.Stripe || !cfg.publishableKey) {
      payError("Payments couldn't load. Please refresh the page.");
      return;
    }
    state.stripe = window.Stripe(cfg.publishableKey);
    state.elements = state.stripe.elements({
      mode: "payment",
      amount: state.total ?? cfg.bundle.amount,
      currency: cfg.currency,
      appearance: {
        theme: "stripe",
        variables: { colorPrimary: "#6b1234", colorText: "#2a2426", borderRadius: "8px", fontFamily: "Inter, system-ui, sans-serif" },
      },
      fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" }],
    });
    const pe = state.elements.create("payment", { layout: "tabs", fields: { billingDetails: { name: "never", email: "never" } } });
    pe.mount("#payment-element");
    pe.on("ready", () => (btn.disabled = false));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.busy || !state.elements) return;
    payError("");
    const name = $("name").value.trim();
    const email = $("email").value.trim();
    if (!name) return payError("Please enter your name."), $("name").focus();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return payError("Please enter a valid email."), $("email").focus();

    state.busy = true;
    btn.disabled = true;
    btn.textContent = "Processing…";
    try {
      const { error: submitError } = await state.elements.submit();
      if (submitError) throw new Error(submitError.message);

      const r = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, marketing: $("marketing").checked, upgrade: state.upgrade, code: state.code,
          source: attribution.source, campaign: attribution.campaign, visitor: attribution.visitor, variant, turnstile: state.turnstile,
        }),
      });
      const d = await r.json();
      // Each bot-check token works once: get a fresh one ready for any retry.
      if (window.turnstile && state.turnstileId !== null) { window.turnstile.reset(state.turnstileId); state.turnstile = ""; }
      if (!r.ok) throw new Error(d.error || "Something went wrong.");

      const { error } = await state.stripe.confirmPayment({
        elements: state.elements,
        clientSecret: d.clientSecret,
        confirmParams: {
          return_url: `${location.origin}/thanks`,
          payment_method_data: { billing_details: { name, email } },
        },
      });
      // Only reached if the payment failed; success redirects to /thanks.
      throw new Error(error?.message || "Payment failed. Please try again.");
    } catch (err) {
      payError(err.message);
      state.busy = false;
      btn.disabled = false;
      btn.textContent = "Purchase";
    }
  });

  // ---- "Last checked" month in the FAQ: always the current month ----------------------
  const checked = $("checked-month");
  if (checked) checked.textContent = new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  // ---- Reviews -----------------------------------------------------------------------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Reviews left on /review (once approved) come first, then the Etsy reviews in reviews.json.
  const getList = (url) => fetch(url).then((r) => (r.ok ? r.json() : [])).then((l) => (Array.isArray(l) ? l : [])).catch(() => []);
  Promise.all([getList("/api/reviews"), getList("/reviews.json")])
    .then(([own, etsy]) => {
      const list = [...own.map((r) => ({ ...r, source: r.verified ? "Verified buyer" : "Guide buyer" })), ...etsy.map((r) => ({ ...r, source: "" }))];
      if (!list.length) return;
      const track = $("review-track");
      track.innerHTML = list
        .map((rv) => {
          const stars = '<span class="ic star" style="--i:url(/icons/star-fill.svg)"></span>'.repeat(Math.max(1, Math.min(5, rv.stars || 5)));
          return `<article class="review">
            <div class="stars" aria-label="${rv.stars || 5} out of 5">${stars}</div>
            <div class="who"><span class="initial">${esc((rv.name || "?").trim()[0] || "?")}</span><span>${esc(rv.name || "")}${rv.source ? `<small class="src">${esc(rv.source)}</small>` : ""}</span></div>
            <p class="text">${esc(rv.text || "")}</p>
            <button type="button" class="more">Show more</button>
          </article>`;
        })
        .join("");
      track.querySelectorAll(".review").forEach((card) => {
        const text = card.querySelector(".text");
        const more = card.querySelector(".more");
        requestAnimationFrame(() => {
          if (text.scrollHeight <= text.clientHeight + 2) more.remove();
        });
        more.addEventListener("click", () => {
          card.classList.toggle("open");
          more.textContent = card.classList.contains("open") ? "Show less" : "Show more";
        });
      });
      const step = () => (track.querySelector(".review")?.offsetWidth || 260) + 12;
      $("rev-prev").onclick = () => track.scrollBy({ left: -step(), behavior: "smooth" });
      $("rev-next").onclick = () => track.scrollBy({ left: step(), behavior: "smooth" });
      $("reviews").hidden = false;
    })
    .catch(() => {});

  // ---- Start -------------------------------------------------------------------------
  fetch("/api/config")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(async (cfg) => {
      setPrice("bundle", cfg.bundle.display);
      setPrice("upgrade", cfg.upgrade.display);
      if (cfg.upgrade.available === false) {
        document.querySelector(".bump").hidden = true;
        $("upgrade").checked = false;
        state.upgrade = false;
      }
      mountTurnstile(cfg.turnstileSiteKey);
      state.total = cfg.bundle.amount;
      $("total").textContent = cfg.bundle.display;
      const start = () => mountStripe(cfg);
      if (window.Stripe) start();
      else window.addEventListener("load", start, { once: true });
    })
    .catch(() => payError("The shop couldn't load. Please refresh the page."));
})();
