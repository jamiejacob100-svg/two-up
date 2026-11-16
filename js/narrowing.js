// --- Narrowing games: this-or-that, both-pick, just-decide ----------------

import { el, openSheet, toast, money } from "./ui.js";
import { CATEGORIES, photoFor } from "./data.js";

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

function miniCard(place, onPick) {
  const cat = CATEGORIES[place.category];
  return el("button.place-card.vs-card", { onclick: () => onPick(place) }, [
    el("img.place-photo", { src: place.photo || photoFor(place), alt: place.name }),
    el("div.place-body", {}, [
      el("div.place-name", { text: place.name }),
      el("div.place-meta", {}, [ el("span.tag", { text: `${cat.icon} ${cat.label}` }), el("span", { text: money(place.est_cost_for_two) }) ]),
    ]),
  ]);
}

function winnerScreen(place, onDone) {
  const cat = CATEGORIES[place.category];
  return el("div.winner-wrap", {}, [
    el("div.winner-badge", { text: "Winner" }),
    el("img.detail-hero", { src: place.photo || photoFor(place), alt: place.name, style: "margin:10px 0" }),
    el("h2", { text: place.name, style: "font-size:22px;font-weight:800" }),
    el("p.page-sub", { text: `${cat.icon} ${cat.label} · ${place.area} · ${money(place.est_cost_for_two)}` }),
    el("div.row-split", { style: "margin-top:16px" }, [
      el("button.btn.btn-soft", { text: "See details", onclick: () => onDone(place, "detail") }),
      el("button.btn.btn-primary", { text: "＋ Add to day", onclick: () => onDone(place, "add") }),
    ]),
  ]);
}

// This-or-that single-elimination bracket (max 8 entrants).
export function thisOrThat(places, onDone) {
  let round = shuffle(places).slice(0, 8);
  if (round.length < 2) { toast("Need at least 2 places — loosen your filters"); return; }

  const body = el("div");
  const close = openSheet({ title: "This or that?", body });

  function playRound(entrants) {
    if (entrants.length === 1) { body.replaceChildren(winnerScreen(entrants[0], finish)); return; }
    const winners = [];
    let i = 0;
    const next = () => {
      if (i >= entrants.length - 1) { playRound([...winners, ...(entrants.length % 2 ? [entrants[entrants.length - 1]] : [])]); return; }
      const a = entrants[i], b = entrants[i + 1];
      body.replaceChildren(
        el("p.vs-progress", { text: `Round of ${entrants.length} — tap your pick` }),
        el("div.vs-row", {}, [
          miniCard(a, () => { winners.push(a); i += 2; next(); }),
          el("div.vs-mid", { text: "vs" }),
          miniCard(b, () => { winners.push(b); i += 2; next(); }),
        ]),
      );
    };
    next();
  }
  function finish(place, action) { close(); onDone(place, action); }
  playRound(round);
}

// Both-pick: each person picks from the same shortlist; agree = that place,
// disagree = coin flip between the two picks.
export function bothPick(places, onDone) {
  const shortlist = shuffle(places).slice(0, 6);
  if (shortlist.length < 2) { toast("Need at least 2 places — loosen your filters"); return; }
  const body = el("div");
  const close = openSheet({ title: "Both pick", body });

  const chooser = (who, onChoose) => el("div", {}, [
    el("p.lede", { text: `${who}, pick your favourite (don't show the other!)` }),
    el("div.grid", {}, shortlist.map(p => miniCard(p, () => onChoose(p)))),
  ]);

  body.replaceChildren(chooser("Person 1", (p1) => {
    body.replaceChildren(chooser("Person 2", (p2) => {
      if (p1.id === p2.id) { body.replaceChildren(winnerScreen(p1, finish)); return; }
      // Coin flip
      body.replaceChildren(
        el("div.winner-wrap", {}, [
          el("p.lede", { text: "You disagreed! Flipping a coin…" }),
          el("div.coin", { text: "🪙" }),
        ]));
      setTimeout(() => {
        const win = Math.random() < 0.5 ? p1 : p2;
        body.replaceChildren(
          el("p.vs-progress", { text: `${p1.name} vs ${p2.name} → coin picked:` }),
          winnerScreen(win, finish));
      }, 1100);
    }));
  }));
  function finish(place, action) { close(); onDone(place, action); }
}

// Just decide: pick one, allow a single re-roll.
export function justDecide(places, onDone) {
  if (!places.length) { toast("No places match — loosen your filters"); return; }
  let rerolled = false;
  const body = el("div");
  const close = openSheet({ title: "We'll decide for you", body });

  function roll() {
    const pick = places[Math.random() * places.length | 0];
    body.replaceChildren(
      winnerScreen(pick, finish),
      !rerolled ? el("button.btn.btn-ghost.btn-block", {
        text: "🎲 Re-roll once", style: "margin-top:10px",
        onclick: () => { rerolled = true; roll(); },
      }) : el("p.page-sub", { text: "That's the one — no more re-rolls!", style: "text-align:center;margin-top:10px" }),
    );
  }
  function finish(place, action) { close(); onDone(place, action); }
  roll();
}
