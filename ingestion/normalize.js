// Turns partial records from any adapter into rows that match contract/schema.sql.

export const EVENT_TYPES = [
  "exhibition", "private_view", "workshop", "talk", "open_studio",
  "performance", "screening", "fair", "tour", "other",
];
export const PRICE_TYPES = ["free", "paid", "donation", "unknown"];

const clean = (s) => (s == null ? null : String(s).replace(/\s+/g, " ").trim() || null);

// Same rule as the contract: lower(title) | lower(venue_name) | start_date.
// Punctuation and spacing are squashed so "Bridget Riley " and "bridget riley" match.
export function dedupeKey({ title, venue_name, start_date }) {
  const squash = (s) => (s || "").toLowerCase().normalize("NFKD")
    .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return `${squash(title)}|${squash(venue_name)}|${start_date}`;
}

export function normalize(raw) {
  const ev = {
    title: clean(raw.title),
    event_type: EVENT_TYPES.includes(raw.event_type) ? raw.event_type : "other",
    description: clean(raw.description),
    artists: (raw.artists || []).map(clean).filter(Boolean),
    art_forms: (raw.art_forms || []).map((s) => clean(s)?.toLowerCase()).filter(Boolean),
    tags: (raw.tags || []).map((s) => clean(s)?.toLowerCase()).filter(Boolean),
    image_url: clean(raw.image_url),
    start_date: raw.start_date || null,
    end_date: raw.end_date && raw.end_date !== raw.start_date ? raw.end_date : null,
    start_time: toTime(raw.start_time),
    end_time: toTime(raw.end_time),
    venue_name: clean(raw.venue_name),
    address: clean(raw.address),
    postcode: clean(raw.postcode)?.toUpperCase() ?? null,
    area: clean(raw.area),
    lat: typeof raw.lat === "number" ? raw.lat : null,
    lng: typeof raw.lng === "number" ? raw.lng : null,
    price_type: PRICE_TYPES.includes(raw.price_type) ? raw.price_type : "unknown",
    price_min_gbp: typeof raw.price_min_gbp === "number" ? raw.price_min_gbp : null,
    booking_required: typeof raw.booking_required === "boolean" ? raw.booking_required : null,
    booking_url: clean(raw.booking_url),
    source_name: raw.source_name,
    source_url: raw.source_url,
    scraped_at: raw.scraped_at || new Date().toISOString(),
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
  };
  if (ev.price_type === "free") ev.price_min_gbp = 0;
  if (!ev.title || !/^\d{4}-\d{2}-\d{2}$/.test(ev.start_date || "") || !ev.source_name || !ev.source_url) {
    return null; // not enough to show on a card
  }
  ev.dedupe_key = dedupeKey(ev);
  return ev;
}

function toTime(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:${m[3] || "00"}`;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// "14 Nov 2026" -> "2026-11-14". Year is optional ("19 Nov"), then the next such date from `today`.
export function parseDayMonth(s, today = londonToday()) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?(?:\s+(\d{4}))?/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
  let iso = `${year}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (!m[3] && iso < today) iso = `${year + 1}${iso.slice(4)}`;
  return iso;
}

export function londonToday(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
