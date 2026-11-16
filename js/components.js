// --- Reusable components: place card + detail sheet ------------------------

import { el, money, stars, openSheet, toast } from "./ui.js";
import { CATEGORIES, photoFor } from "./data.js";
import { directionsUrl } from "./geo.js";
import { addToDraft } from "./planner.js";
import { DEMO_MODE, GOOGLE_ENABLED } from "./config.js";
import { placePhoto, placeDetails, priceLevelSigns } from "./places-api.js";

// Image source: a manual photo link, an already-set photo, else a placeholder.
function imgSrc(place) { return place.photo_url || place.photo || photoFor(place); }

// Lazy-swap the placeholder for a real Google photo (only when Google is on).
function maybeLoadPhoto(img, place) {
  if (DEMO_MODE || !GOOGLE_ENABLED || place.photo_url || !place.google_place_id) return;
  placePhoto(place.google_place_id).then(uri => { if (uri) img.src = uri; }).catch(() => {});
}

export function placeCard(place, onOpen) {
  const cat = CATEGORIES[place.category];
  const img = el("img.place-photo", { src: imgSrc(place), alt: place.name, loading: "lazy" });
  maybeLoadPhoto(img, place);
  return el("button.place-card", { onclick: () => onOpen(place) }, [
    img,
    el("div.place-body", {}, [
      el("div.place-name", { text: place.name }),
      el("div.place-meta", {}, [
        el("span.tag", { text: `${cat.icon} ${cat.label}` }),
        el("span", { text: money(place.est_cost_for_two) }),
      ]),
    ]),
  ]);
}

// --- Demo-only fabricated review/hours ---
function demoReviews(place) {
  const pool = [
    ["Alex", 5, "Exactly the vibe we wanted. Would come back."],
    ["Sam", 4, "Lovely spot, a little busy on weekends but worth it."],
    ["Priya", 5, "One of our favourites in the area — never misses."],
    ["Jordan", 4, "Solid. Service was quick and friendly."],
  ];
  const n = 2 + (place.name.length % 2);
  return pool.slice(0, n).map(([author, rating, text]) => ({ author, rating, text, when: "" }));
}
function demoHours(place) {
  const map = {
    coffee: "7:00 AM – 3:00 PM", food: "11:30 AM – 10:00 PM",
    activity: "9:00 AM – 5:00 PM", view: "Open 24 hours",
    drinks: "4:00 PM – 1:00 AM", dessert: "12:00 PM – 11:00 PM",
  };
  return map[place.category] || "9:00 AM – 6:00 PM";
}
function priceLevelFromCost(cost) {
  if (cost === 0) return "Free";
  if (cost < 25) return "$";
  if (cost < 55) return "$$";
  if (cost < 90) return "$$$";
  return "$$$$";
}

function ratingSpan(r) {
  return r != null ? el("span.rating", { text: `${stars(r)} ${Number(r).toFixed(1)}` }) : null;
}
function statLine(bits) {
  const row = el("div.detail-row");
  bits.filter(Boolean).forEach((b, i) => {
    if (i) row.append(el("span.dot"));
    row.append(typeof b === "string" ? el("span", { text: b }) : b);
  });
  return row;
}
function reviewEl(r) {
  return el("div.review", {}, [
    el("div.review-top", {}, [
      r.uri ? el("a", { href: r.uri, target: "_blank", rel: "noopener", text: r.author, style: "font-weight:700;color:inherit" })
            : el("strong", { text: r.author }),
      r.rating != null && el("span.rating", { text: stars(r.rating) }),
    ]),
    el("div.review-text", { text: r.text }),
    r.when && el("div.attribution", { text: r.when, style: "margin-top:4px" }),
  ]);
}

export function openDetail(place) {
  const cat = CATEGORIES[place.category];
  const ourCost = `our est. ${money(place.est_cost_for_two)} for two`;
  const hero = el("img.detail-hero", { src: imgSrc(place), alt: place.name });
  maybeLoadPhoto(hero, place);

  const info = el("div");
  const body = el("div", {}, [
    hero,
    el("div.detail-row", {}, [
      el("span.tag", { text: `${cat.icon} ${cat.label}` }),
      el("span.dot"), el("span", { text: place.area || "Sydney" }),
    ]),
    info,
    place.our_notes && el("div.section-label", { text: "Our notes" }),
    place.our_notes && el("div.notes-box", { text: place.our_notes }),
  ]);

  if (DEMO_MODE) demoInfo();
  else if (GOOGLE_ENABLED) liveInfo();
  else manualInfo();

  function demoInfo() {
    const reviewCount = 40 + (place.name.length * 7) % 400;
    info.replaceChildren(
      statLine([ ratingSpan(place.our_rating), `${reviewCount} Google reviews`,
                 `${priceLevelFromCost(place.est_cost_for_two)} · ${ourCost}` ]),
      el("div.detail-row", {}, [ el("span", { html: `🕒 <strong>${demoHours(place)}</strong>` }) ]),
      el("div.section-label", { text: "Reviews" }),
      el("div.reviews", {}, demoReviews(place).map(reviewEl)),
      el("div.attribution", { text: "Reviews & hours via Google. Powered by Google." }),
    );
  }

  // Manual (cloud, no Google): just our own data.
  function manualInfo() {
    const rows = [ statLine([ ratingSpan(place.our_rating), ourCost ]) ];
    if (place.hours) rows.push(el("div.detail-row", {}, [ el("span", { html: `🕒 <strong>${place.hours}</strong>` }) ]));
    info.replaceChildren(...rows);
  }

  // Live Google data, fetched on open.
  function liveInfo() {
    const ratingEl = ratingSpan(place.our_rating) || el("span.rating");
    const reviewCountEl = el("span", { text: "Loading reviews…" });
    const priceEl = el("span", { text: ourCost });
    const hoursEl = el("span", { html: "🕒 checking hours…" });
    const reviewsWrap = el("div.reviews", {}, [ el("p.page-sub", { text: "Loading…" }) ]);
    const attribution = el("div.attribution", { text: "Reviews & hours via Google. Powered by Google." });
    info.replaceChildren(
      statLine([ ratingEl, reviewCountEl, priceEl ]),
      el("div.detail-row", {}, [ hoursEl ]),
      el("div.section-label", { text: "Reviews" }), reviewsWrap, attribution,
    );
    (async () => {
      const d = place.google_place_id ? await placeDetails(place.google_place_id) : null;
      if (!d) {
        hoursEl.innerHTML = "🕒 hours unavailable";
        reviewsWrap.replaceChildren(el("p.page-sub", { text: "Live Google reviews aren't available for this place yet." }));
        attribution.textContent = "";
        return;
      }
      if (d.capped) {
        hoursEl.innerHTML = "🕒 hours unavailable today";
        reviewsWrap.replaceChildren(el("p.page-sub", { text: "Reviews unavailable today (daily limit reached)." }));
        return;
      }
      if (d.rating != null) ratingEl.textContent = `${stars(d.rating)} ${Number(d.rating).toFixed(1)}`;
      reviewCountEl.textContent = d.userRatingCount != null ? `${d.userRatingCount} Google reviews` : "";
      const pl = priceLevelSigns(d.priceLevel);
      priceEl.textContent = `${pl ? pl + " · " : ""}${ourCost}`;
      if (d.openingHours) {
        const week = d.openingHours.week || [];
        const today = week[(new Date().getDay() + 6) % 7];
        const todayHrs = today ? today.split(": ").slice(1).join(": ") : "";
        hoursEl.innerHTML = `🕒 <strong>${d.openingHours.openNow ? "Open now" : "Closed now"}</strong>${todayHrs ? " · " + todayHrs : ""}`;
      } else {
        hoursEl.innerHTML = "🕒 hours unavailable";
      }
      reviewsWrap.replaceChildren(...(d.reviews?.length ? d.reviews.map(reviewEl)
        : [el("p.page-sub", { text: "No reviews yet." })]));
    })();
  }

  const actions = [
    el("a.btn.btn-soft", { href: directionsUrl(place), target: "_blank", rel: "noopener", html: "🧭 Directions" }),
    el("button.btn.btn-primary", {
      html: "＋ Add to day",
      onclick: () => { addToDraft(place.id); toast(`Added ${place.name} to your day`); },
    }),
  ];
  openSheet({ title: place.name, body, actions });
}
