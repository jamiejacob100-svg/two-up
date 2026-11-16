// --- Demo data + shared metadata -------------------------------------------

// Default reference point for the distance filter (Sydney CBD).
export const CITY_CENTER = { lat: -33.8688, lng: 151.2093, label: "the CBD" };

// Keys stay the same (coffee/food/view/drinks/activity/dessert) so all data,
// filters, the day planner and the bars seed keep working — only the labels
// and icons change. Order here sets the chip order (a date progression).
export const CATEGORIES = {
  coffee:   { label: "Performative matcha time", icon: "🍵", c1: "#8fae6b", c2: "#cfe3ac" },
  food:     { label: "Lil lunch",                icon: "🥪", c1: "#d98b6a", c2: "#f3b89a" },
  view:     { label: "Fancy asf dinner",         icon: "🍽️", c1: "#7d8bd4", c2: "#c3cdf6" },
  drinks:   { label: "Tipsy time",               icon: "🍸", c1: "#9a6fb0", c2: "#d6b6e6" },
  activity: { label: "Jungle exploration",       icon: "🌴", c1: "#6ea4a0", c2: "#aee0dc" },
  dessert:  { label: "Cheeky sweet treat",       icon: "🍰", c1: "#d47ba0", c2: "#f6bcd4" },
  sidequest:{ label: "Side quests",              icon: "🗺️", c1: "#c9a15a", c2: "#ecd49f" },
};

// Cuisine sub-filter — only shown when a food category (lunch/dinner) is picked.
export const CUISINES = {
  italian:  { label: "Italian",  icon: "🍝" },
  steak:    { label: "Steak",    icon: "🥩" },
  japanese: { label: "Japanese", icon: "🍣" },
  fillers:  { label: "Random stomach fillers", icon: "🍔" },
};

// The categories that get the cuisine sub-filter (Lil lunch + Fancy asf dinner).
export const CUISINE_CATS = ["food", "view"];

// Places have no explicit cuisine field, so infer one from the name/notes/vibe.
// Anything that doesn't match italian/steak/japanese falls into "random stomach
// fillers" — the catch-all.
const CUISINE_RULES = [
  ["italian",  /\b(italian|pizz|pasta|trattoria|osteria|napoli|roman|gnocchi|risotto|aperitivo|cicchetti)\b/i],
  ["steak",    /\b(steak|grill|chophouse|parrilla|charr?grill|butcher|bbq|smoke|ribs?|brisket|rotisserie)\b/i],
  ["japanese", /\b(sushi|ramen|izakaya|japanese|sake|teppan|yakitori|omakase|nikkei|udon|donburi|wagyu|robata|tonkatsu)\b/i],
];

export function cuisineOf(place) {
  // An explicit tag (set in the add/edit form) always wins; otherwise infer.
  if (place && place.cuisine && CUISINES[place.cuisine]) return place.cuisine;
  const hay = `${(place && place.name) || ""} ${(place && place.our_notes) || ""} ${((place && place.vibe) || []).join(" ")}`;
  for (const [key, re] of CUISINE_RULES) if (re.test(hay)) return key;
  return "fillers";
}

// Exploration zones — sub-filter shown under Jungle exploration (activity).
export const ZONES = {
  royal:    { label: "Royal National Park",     icon: "🌲" },
  bluemtns: { label: "Blue Mountains",          icon: "⛰️" },
  outback:  { label: "Random outback ventures", icon: "🏜️" },
};

// The categories that get the zone sub-filter (just Jungle exploration).
export const ZONE_CATS = ["activity"];

// Infer a zone from the name/area/notes when none is tagged explicitly.
const ZONE_RULES = [
  ["royal",    /\b(royal national park|royal np|bundeena|audley|wattamolla|garie|figure eight)\b/i],
  ["bluemtns", /\b(blue mountains|katoomba|leura|wentworth falls|blackheath|three sisters|grand canyon|govett|national pass|glenbrook|megalong|jamison|ruined castle)\b/i],
  ["outback",  /\b(outback|desert|broken hill|mungo|silverton|white cliffs|menindee)\b/i],
];

// The exploration zone a place sits in, or null. An explicit tag wins.
export function zoneOf(place) {
  if (place && place.zone && ZONES[place.zone]) return place.zone;
  const hay = `${(place && place.name) || ""} ${(place && place.area) || ""} ${(place && place.our_notes) || ""}`;
  for (const [key, re] of ZONE_RULES) if (re.test(hay)) return key;
  return null;
}

// Sweet-treat brands — sub-filter shown under Cheeky sweet treat (dessert).
export const TREATS = {
  yochi: { label: "YoChi", icon: "🍦" },
};

// The categories that get the treat sub-filter (just Cheeky sweet treat).
export const TREAT_CATS = ["dessert"];

// The treat brand a place belongs to, or null. An explicit tag wins.
export function treatOf(place) {
  if (place && place.treat && TREATS[place.treat]) return place.treat;
  const name = ((place && place.name) || "").toLowerCase();
  if (/yo-?chi/.test(name)) return "yochi";
  return null;
}

export const VIBES = {
  chill:       { label: "Chill",       icon: "🌿" },
  social:      { label: "Social",      icon: "🥂" },
  adventurous: { label: "Adventurous", icon: "🧭" },
};

export const SETTINGS = {
  indoor:  { label: "Indoor",  icon: "🏠" },
  outdoor: { label: "Outdoor", icon: "🌞" },
  either:  { label: "Either",  icon: "↔︎" },
};

// Time windows for the constraint picker and day templates.
export const TIME_SLOTS = {
  quick:   { label: "Quick date", hours: 2 },
  evening: { label: "Evening",    hours: 4 },
  half:    { label: "Half day",   hours: 5 },
  full:    { label: "Full day",   hours: 9 },
};

// Days of the week — the sub-filter under "Weekly deals". A place's `deals`
// object maps these keys to the special it runs that day, e.g.
//   deals: { mon: "$12 burger + beer", wed: "2-for-1 wings" }
export const DAYS = [
  { key: "mon", label: "Mon", full: "Monday" },
  { key: "tue", label: "Tue", full: "Tuesday" },
  { key: "wed", label: "Wed", full: "Wednesday" },
  { key: "thu", label: "Thu", full: "Thursday" },
  { key: "fri", label: "Fri", full: "Friday" },
  { key: "sat", label: "Sat", full: "Saturday" },
  { key: "sun", label: "Sun", full: "Sunday" },
];

// The special a place runs on a given day, or null. Tolerant of a missing or
// malformed `deals` field (older rows, places added before the column existed).
export function dealFor(place, dayKey) {
  const d = place && place.deals;
  if (!d || typeof d !== "object") return null;
  const v = d[dayKey];
  return v && String(v).trim() ? String(v).trim() : null;
}
export function hasAnyDeal(place) {
  return DAYS.some(d => dealFor(place, d.key));
}

// Shared photo used for the bars (Tipsy time). Hosted on the live site.
export const BAR_PHOTO = "https://jamiejacob100-svg.github.io/two-up/images/bars.jpg";

// A small, hand-made set of Sydney-flavoured sample places for demo mode.
// Images are generated locally (see photoFor) so the demo works offline.
export const DEMO_PLACES = [
  { id: "d1",  google_place_id: "", name: "Paramount Coffee Project", category: "coffee",
    area: "Surry Hills", est_cost_for_two: 24, vibe: ["chill","social"], setting: "indoor",
    lat: -33.8836, lng: 151.2110, our_rating: 4.5,
    our_notes: "Great filter coffee, get there before 10 or it's a wait." },
  { id: "d2",  google_place_id: "", name: "Single O", category: "coffee",
    area: "Surry Hills", est_cost_for_two: 20, vibe: ["chill"], setting: "either",
    lat: -33.8861, lng: 151.2098, our_rating: 4.3,
    our_notes: "Little bench out front, good for a quick flat white." },
  { id: "d3",  google_place_id: "", name: "Bourke Street Bakery", category: "coffee",
    area: "Surry Hills", est_cost_for_two: 18, vibe: ["chill"], setting: "outdoor",
    lat: -33.8849, lng: 151.2131, our_rating: 4.4,
    our_notes: "Sausage roll + ginger brûlée tart. Corner tables are the move." },

  { id: "d4",  google_place_id: "", name: "Spice Alley", category: "food",
    area: "Chippendale", est_cost_for_two: 36, vibe: ["social","adventurous"], setting: "outdoor",
    lat: -33.8885, lng: 151.1986, our_rating: 4.2,
    our_notes: "Hawker-style, lantern-lit laneway. Cash-free, order at stalls.",
    deals: { thu: "Dumpling night — $8 plates", sun: "Laksa Sunday $14" } },
  { id: "d5",  google_place_id: "", name: "Chica Bonita", category: "food",
    area: "Manly", est_cost_for_two: 70, vibe: ["social"], setting: "indoor",
    lat: -33.7968, lng: 151.2870, our_rating: 4.1,
    our_notes: "Tacos + margs near the wharf. Good after a ferry.",
    deals: { tue: "Taco Tuesday — $3 tacos all night", fri: "Margarita happy hour til 6" } },
  { id: "d6",  google_place_id: "", name: "Mary's", category: "food",
    area: "Newtown", est_cost_for_two: 52, vibe: ["social","adventurous"], setting: "indoor",
    lat: -33.8976, lng: 151.1793, our_rating: 4.3,
    our_notes: "Loud, dark, best burger. No bookings — go early.",
    deals: { mon: "$12 cheeseburger + schooner", wed: "2-for-1 fried chicken" } },

  { id: "d7",  google_place_id: "", name: "Royal Botanic Garden", category: "activity",
    area: "CBD", est_cost_for_two: 0, vibe: ["chill"], setting: "outdoor",
    lat: -33.8642, lng: 151.2166, our_rating: 4.7,
    our_notes: "Free. Loop to Mrs Macquarie's Chair for the harbour view." },
  { id: "d8",  google_place_id: "", name: "White Rabbit Gallery", category: "activity",
    area: "Chippendale", est_cost_for_two: 0, vibe: ["chill","adventurous"], setting: "indoor",
    lat: -33.8872, lng: 151.1979, our_rating: 4.5,
    our_notes: "Free contemporary Chinese art. Tea room upstairs is lovely." },
  { id: "d9",  google_place_id: "", name: "Bondi to Bronte Walk", category: "activity",
    area: "Bondi", est_cost_for_two: 0, vibe: ["adventurous"], setting: "outdoor",
    lat: -33.8915, lng: 151.2767, our_rating: 4.8,
    our_notes: "~45 min coastal walk. Swim at Bronte after." },
  { id: "d10", google_place_id: "", name: "Sydney Fish Market", category: "activity",
    area: "Pyrmont", est_cost_for_two: 45, vibe: ["social","adventurous"], setting: "either",
    lat: -33.8716, lng: 151.1930, our_rating: 4.0,
    our_notes: "Grab oysters + prawns, sit by the water. Mind the seagulls." },
  { id: "d19", google_place_id: "", name: "Figure Eight Pools", category: "activity",
    area: "Royal National Park", est_cost_for_two: 0, vibe: ["adventurous"], setting: "outdoor",
    lat: -34.1619, lng: 151.0530, our_rating: 4.5, zone: "royal",
    our_notes: "Big coastal hike to the rock pools. Only go at low tide — check the swell." },
  { id: "d20", google_place_id: "", name: "Wentworth Falls Track", category: "activity",
    area: "Blue Mountains", est_cost_for_two: 0, vibe: ["adventurous"], setting: "outdoor",
    lat: -33.7120, lng: 150.3730, our_rating: 4.7, zone: "bluemtns",
    our_notes: "Waterfall + National Pass clifftop walk. Pack water and good shoes." },
  { id: "d21", google_place_id: "", name: "Silverton & Broken Hill", category: "activity",
    area: "Outback NSW", est_cost_for_two: 0, vibe: ["adventurous"], setting: "outdoor",
    lat: -31.9510, lng: 141.2200, our_rating: 4.4, zone: "outback",
    our_notes: "Big-sky outback road trip — ghost town, mine lookouts, desert sunsets." },

  { id: "d11", google_place_id: "", name: "Mrs Macquarie's Chair", category: "view",
    area: "CBD", est_cost_for_two: 0, vibe: ["chill"], setting: "outdoor",
    lat: -33.8599, lng: 151.2229, our_rating: 4.6,
    our_notes: "Best free Opera House + Bridge framing. Golden hour." },
  { id: "d12", google_place_id: "", name: "Barangaroo Reserve", category: "view",
    area: "Barangaroo", est_cost_for_two: 0, vibe: ["chill"], setting: "outdoor",
    lat: -33.8559, lng: 151.2010, our_rating: 4.4,
    our_notes: "Sandstone headland, sunset over the water. Bring a drink." },
  { id: "d13", google_place_id: "", name: "Blues Point Reserve", category: "view",
    area: "McMahons Point", est_cost_for_two: 0, vibe: ["chill"], setting: "outdoor",
    lat: -33.8452, lng: 151.2049, our_rating: 4.5,
    our_notes: "Quiet, straight-on Bridge view. Grass to sit on." },

  { id: "d14", google_place_id: "", name: "Maybe Sammy", category: "drinks",
    area: "The Rocks", est_cost_for_two: 60, vibe: ["social"], setting: "indoor",
    lat: -33.8599, lng: 151.2089, our_rating: 4.6, photo_url: BAR_PHOTO,
    our_notes: "World-ranked cocktail bar. Dress up a little, book ahead." },
  { id: "d15", google_place_id: "", name: "The Baxter Inn", category: "drinks",
    area: "CBD", est_cost_for_two: 50, vibe: ["social","adventurous"], setting: "indoor",
    lat: -33.8694, lng: 151.2065, our_rating: 4.4, photo_url: BAR_PHOTO,
    our_notes: "Hidden down a laneway, wall of whisky. No sign — just go in." },
  { id: "d16", google_place_id: "", name: "Opera Bar", category: "drinks",
    area: "CBD", est_cost_for_two: 55, vibe: ["social"], setting: "outdoor", photo_url: BAR_PHOTO,
    lat: -33.8570, lng: 151.2150, our_rating: 4.2,
    our_notes: "Pricey but the view does the work. Sunset spritz.",
    deals: { fri: "$15 spritz + oysters, 4–6pm", sat: "Live music, no cover" } },

  { id: "d17", google_place_id: "", name: "Gelato Messina", category: "dessert",
    area: "Darlinghurst", est_cost_for_two: 18, vibe: ["chill","social"], setting: "either",
    lat: -33.8800, lng: 151.2200, our_rating: 4.7,
    our_notes: "The classic. Specials board is always worth a look.",
    deals: { mon: "Buy-one-get-one scoops", thu: "New special flavour drop" } },
  { id: "d18", google_place_id: "", name: "Koi Dessert Bar", category: "dessert",
    area: "Chippendale", est_cost_for_two: 34, vibe: ["social"], setting: "indoor",
    lat: -33.8880, lng: 151.1990, our_rating: 4.3,
    our_notes: "Fancy plated desserts. Sit at the counter." },
  { id: "d22", google_place_id: "", name: "Yo-Chi Newtown", category: "dessert",
    area: "Newtown", est_cost_for_two: 22, vibe: ["chill","social"], setting: "indoor",
    lat: -33.8978, lng: 151.1793, our_rating: 4.4, treat: "yochi",
    our_notes: "Self-serve froyo & açaí — pile on the toppings. 293 King St." },
  { id: "d23", google_place_id: "", name: "Yo-Chi Surry Hills", category: "dessert",
    area: "Surry Hills", est_cost_for_two: 22, vibe: ["chill","social"], setting: "indoor",
    lat: -33.8846, lng: 151.2110, our_rating: 4.3, treat: "yochi",
    our_notes: "Self-serve froyo & açaí, weigh-and-pay. 435 Crown St." },
];

// Generate a soft gradient placeholder image as a data-URI SVG.
// Used in demo mode and as a fallback when a live photo isn't available.
export function photoFor(place) {
  const cat = CATEGORIES[place.category] || CATEGORIES.activity;
  const initials = (place.name || "?")
    .split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${cat.c1}"/>
          <stop offset="1" stop-color="${cat.c2}"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#g)"/>
      <text x="26" y="270" font-family="system-ui,sans-serif" font-size="150"
            fill="rgba(255,255,255,.35)" font-weight="800">${cat.icon}</text>
      <text x="200" y="165" text-anchor="middle" font-family="system-ui,sans-serif"
            font-size="86" fill="rgba(255,255,255,.9)" font-weight="800"
            letter-spacing="2">${initials}</text>
    </svg>`.trim();
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// Fake "Google search" used by the Add-place flow in demo mode.
export const DEMO_SEARCH_RESULTS = [
  { google_place_id: "ChIJ-demo-01", name: "The Grounds of Alexandria",
    address: "7a/2 Huntley St, Alexandria NSW", lat: -33.9110, lng: 151.1940 },
  { google_place_id: "ChIJ-demo-02", name: "Wildflower Rooftop Bar",
    address: "Level 4, 17 Barlow St, Haymarket NSW", lat: -33.8800, lng: 151.2050 },
  { google_place_id: "ChIJ-demo-03", name: "Cornersmith Cafe",
    address: "314 Illawarra Rd, Marrickville NSW", lat: -33.9110, lng: 151.1560 },
  { google_place_id: "ChIJ-demo-04", name: "Wayward Brewing Co.",
    address: "1 Gordon St, Camperdown NSW", lat: -33.8930, lng: 151.1760 },
];
