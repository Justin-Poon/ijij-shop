// Sales page: show live prices, and stop double-clicks on the buy button.
(function () {
  const form = document.getElementById("buy");
  const btn = document.getElementById("buy-btn");

  if (new URLSearchParams(location.search).has("cancelled")) {
    const note = document.createElement("p");
    note.className = "notice";
    note.textContent = "No worries, you haven't been charged. The guide's still here when you're ready.";
    form.prepend(note);
  }

  fetch("/api/products")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((p) => {
      document.querySelectorAll('[data-price="bundle"]').forEach((el) => (el.textContent = p.bundle.display));
      document.querySelectorAll('[data-price="upgrade"]').forEach((el) => (el.textContent = p.upgrade.display));
      document.querySelectorAll("[data-currency]").forEach((el) => (el.textContent = p.bundle.currency.toUpperCase()));
    })
    .catch(() => {});

  form.addEventListener("submit", () => {
    btn.disabled = true;
    btn.textContent = "Opening secure checkout…";
  });
  // Re-enable if the user comes back with the browser's back button.
  window.addEventListener("pageshow", () => {
    btn.disabled = false;
    btn.textContent = "Get the guide";
  });
})();
