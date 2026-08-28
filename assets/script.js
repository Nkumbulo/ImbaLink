// ImbaLink marketing site — nav, scroll-reveal and a small live demo of the
// property search that mirrors how the real app works (search + filter +
// save + request a viewing), running entirely client-side against a sample
// of the app's actual seed listings (src/data/properties.json).

// Flip on scroll-reveal styling only once we know JS actually ran — see the
// html.js-ready guard in styles.css. Without this, a blocked/broken script
// would leave every .reveal section permanently invisible.
document.documentElement.classList.add("js-ready");

// ----- Sample listings (trimmed from src/data/properties.json) -----
const DEMO_LISTINGS = [
  { id: 40, title: "Back room, Battlefields", type: "Back room", suburb: "Battlefields", city: "Kadoma", rooms: 1, rent: 33, furnished: false, verification: "verified", landlord: "F. Moyo Properties", image: "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=600&q=70" },
  { id: 42, title: "3-Bedroom House, Mucheke", type: "House", suburb: "Mucheke", city: "Masvingo", rooms: 3, rent: 319, furnished: true, verification: "verified", landlord: "R. Mapfumo", image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=600&q=70" },
  { id: 43, title: "Bachelor Flat, Chikanga", type: "Bachelor Flat", suburb: "Chikanga", city: "Mutare", rooms: 1, rent: 149, furnished: false, verification: "pending", landlord: "S. Nyathi", image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=70" },
  { id: 45, title: "Room with Own Bathroom, Unit L", type: "Room with Own Bathroom", suburb: "Unit L", city: "Chitungwiza", rooms: 1, rent: 86, furnished: true, verification: "verified", landlord: "S. Zulu", image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=70" },
  { id: 47, title: "Two-room unit, Glen View", type: "Two-room unit", suburb: "Glen View", city: "Harare", rooms: 2, rent: 190, furnished: true, verification: "verified", landlord: "S. Mutasa", image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=70" },
  { id: 108, title: "Studio, Mkhosana", type: "Studio", suburb: "Mkhosana", city: "Victoria Falls", rooms: 1, rent: 128, furnished: false, verification: "verified", landlord: "S. Mapfumo", image: "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=600&q=70" },
  { id: 65, title: "Garden Flat, Daylesford", type: "Garden Flat", suburb: "Daylesford", city: "Gweru", rooms: 1, rent: 60, furnished: false, verification: "verified", landlord: "Mrs Nyathi", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=70" },
  { id: 66, title: "Two-room unit, Bradfield", type: "Two-room unit", suburb: "Bradfield", city: "Bulawayo", rooms: 2, rent: 124, furnished: false, verification: "verified", landlord: "T. Ndlovu", image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=70" },
];

const VIEWING_REQUEST_MESSAGE = "I would like to request a viewing.";

const demoState = {
  query: "",
  city: "All",
  verifiedOnly: false,
  saved: new Set(),
  requested: new Set(),
};

function setFooterYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
}

function initNavScrollShadow() {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;
  const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const panel = document.querySelector(".mobile-panel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  panel.querySelectorAll("[data-scroll-to]").forEach((link) => {
    link.addEventListener("click", () => {
      panel.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initSmoothScrollButtons() {
  document.querySelectorAll("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", (event) => {
      const targetId = el.getAttribute("data-scroll-to");
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || items.length === 0) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.01, rootMargin: "0px 0px 200px 0px" }
  );

  items.forEach((el, index) => {
    el.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    observer.observe(el);
  });

  // Safety net: a very fast or non-standard scroll (e.g. jumping straight to
  // an anchor) can outrun the observer. Nothing should stay invisible for
  // good, so anything not yet revealed gets shown once, shortly after load.
  window.setTimeout(() => {
    document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
      el.classList.add("is-visible");
      observer.unobserve(el);
    });
  }, 2500);
}

function currencyLabel(rent) {
  return `$${rent}`;
}

function listingCardHTML(listing) {
  const isSaved = demoState.saved.has(listing.id);
  const isRequested = demoState.requested.has(listing.id);
  const verifiedBadge =
    listing.verification === "verified"
      ? `<span class="badge badge-verified"><svg class="icon"><use href="#icon-check"></use></svg>Verified</span>`
      : `<span class="badge badge-pending">Pending review</span>`;

  return `
    <article class="listing-card" data-id="${listing.id}">
      <div class="listing-media">
        <img src="${listing.image}" alt="${listing.title}" loading="lazy" />
        ${verifiedBadge}
        <button
          type="button"
          class="save-btn ${isSaved ? "is-saved" : ""}"
          data-action="save"
          aria-pressed="${isSaved}"
          aria-label="Save ${listing.title}"
        >
          <svg class="icon"><use href="#icon-heart"></use></svg>
        </button>
      </div>
      <div class="listing-body">
        <div class="listing-price">
          <strong>${currencyLabel(listing.rent)}<span>/mo</span></strong>
          <span class="listing-type">${listing.type}</span>
        </div>
        <div class="listing-title">${listing.title}</div>
        <div class="listing-loc">
          <svg class="icon"><use href="#icon-pin"></use></svg>
          ${listing.suburb}, ${listing.city}
        </div>
        <div class="listing-landlord">${listing.furnished ? "Furnished" : "Unfurnished"} · Listed by ${listing.landlord}</div>
        <div class="listing-actions">
          <button type="button" class="btn btn-outline" data-action="message">
            <svg class="icon"><use href="#icon-message"></use></svg>
            Message
          </button>
          <button type="button" class="btn btn-primary" data-action="request" ${isRequested ? "disabled" : ""}>
            ${isRequested ? `<svg class="icon"><use href="#icon-check"></use></svg> Requested` : "Request viewing"}
          </button>
        </div>
        <div class="listing-note ${isRequested ? "is-visible" : ""}">
          Sent to ${listing.landlord}: &ldquo;${VIEWING_REQUEST_MESSAGE}&rdquo;
        </div>
      </div>
    </article>
  `;
}

function filteredListings() {
  const query = demoState.query.trim().toLowerCase();

  return DEMO_LISTINGS.filter((listing) => {
    if (demoState.city !== "All" && listing.city !== demoState.city) return false;
    if (demoState.verifiedOnly && listing.verification !== "verified") return false;
    if (!query) return true;
    const haystack = `${listing.title} ${listing.suburb} ${listing.city} ${listing.type} ${listing.landlord}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderListings() {
  const grid = document.getElementById("listing-grid");
  const emptyState = document.getElementById("listing-empty");
  const resultCount = document.getElementById("listing-count");
  if (!grid) return;

  const results = filteredListings();

  grid.innerHTML = results.map(listingCardHTML).join("");
  emptyState.classList.toggle("is-visible", results.length === 0);

  if (resultCount) {
    const word = results.length === 1 ? "home" : "homes";
    resultCount.innerHTML = `<strong>${results.length}</strong> ${word} match your filters`;
  }
}

function initDemoFilters() {
  const searchInput = document.getElementById("demo-search-input");
  const cityChips = document.querySelectorAll("[data-city-filter]");
  const verifiedToggle = document.getElementById("demo-verified-toggle");

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      demoState.query = event.target.value;
      renderListings();
    });
  }

  cityChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      cityChips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      demoState.city = chip.dataset.cityFilter;
      renderListings();
    });
  });

  if (verifiedToggle) {
    verifiedToggle.addEventListener("click", () => {
      demoState.verifiedOnly = !demoState.verifiedOnly;
      verifiedToggle.classList.toggle("is-active", demoState.verifiedOnly);
      verifiedToggle.setAttribute("aria-pressed", String(demoState.verifiedOnly));
      renderListings();
    });
  }
}

// Event delegation for the save / message / request-viewing buttons, since
// the cards themselves are re-rendered on every filter change.
function initDemoCardActions() {
  const grid = document.getElementById("listing-grid");
  if (!grid) return;

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest(".listing-card");
    const id = Number(card.dataset.id);
    const listing = DEMO_LISTINGS.find((item) => item.id === id);
    if (!listing) return;

    if (button.dataset.action === "save") {
      const nowSaved = !demoState.saved.has(id);
      nowSaved ? demoState.saved.add(id) : demoState.saved.delete(id);
      button.classList.toggle("is-saved", nowSaved);
      button.setAttribute("aria-pressed", String(nowSaved));
      button.classList.remove("is-popping");
      // Restart the pop animation even if it's already mid-flight.
      void button.offsetWidth;
      button.classList.add("is-popping");
      return;
    }

    if (button.dataset.action === "message" || button.dataset.action === "request") {
      demoState.requested.add(id);
      const note = card.querySelector(".listing-note");
      const requestBtn = card.querySelector('[data-action="request"]');
      if (note) note.classList.add("is-visible");
      if (requestBtn) {
        requestBtn.disabled = true;
        requestBtn.innerHTML = `<svg class="icon"><use href="#icon-check"></use></svg> Requested`;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setFooterYear();
  initNavScrollShadow();
  initMobileNav();
  initSmoothScrollButtons();
  initScrollReveal();
  initDemoFilters();
  initDemoCardActions();
  renderListings();
});
