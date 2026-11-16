// --- Geo helpers -----------------------------------------------------------
// No Google Directions API. We estimate travel from straight-line distance:
// walking under ~1.5 km, otherwise a rough driving estimate.

const R = 6371; // km

export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function rad(d) { return (d * Math.PI) / 180; }

// Returns { km, mode: 'walk'|'drive', mins } — or null if either place has no
// coordinates (e.g. a manually added place without Google location data).
export function travelEstimate(a, b) {
  const km = haversineKm(a, b);
  if (km == null) return null;
  if (km < 1.5) {
    // ~4.8 km/h walking, +20% for real streets vs straight line
    const mins = Math.max(2, Math.round((km * 1.2 / 4.8) * 60));
    return { km, mode: "walk", mins };
  }
  // ~22 km/h average city driving, +25% for real roads
  const mins = Math.max(5, Math.round((km * 1.25 / 22) * 60));
  return { km, mode: "drive", mins };
}

export function fmtKm(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function fmtTravel(t) {
  if (!t) return "";
  const icon = t.mode === "walk" ? "🚶" : "🚗";
  return `${icon} ${t.mins} min · ${fmtKm(t.km)}`;
}

// Build a Google Maps directions URL (no API key needed).
export function directionsUrl(place) {
  const base = "https://www.google.com/maps/dir/?api=1";
  const dest = encodeURIComponent(place.name + ", " + (place.area || "Sydney"));
  let url = `${base}&destination=${dest}`;
  if (place.google_place_id) {
    url += `&destination_place_id=${encodeURIComponent(place.google_place_id)}`;
  }
  return url;
}
