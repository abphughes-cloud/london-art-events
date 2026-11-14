// Shared contract: the shape of one row in the `events` table.
// App side: import this type and read from Supabase (or from events.sample.json
// until the real data lands). Do not add fields here without agreeing them.

export type EventType =
  | "exhibition" | "private_view" | "workshop" | "talk" | "open_studio"
  | "performance" | "screening" | "fair" | "tour" | "other";

export type PriceType = "free" | "paid" | "donation" | "unknown";

export interface ArtEvent {
  id: string;

  title: string;
  event_type: EventType;
  description: string | null;
  artists: string[];
  art_forms: string[];
  tags: string[];
  image_url: string | null;

  start_date: string;          // YYYY-MM-DD, Europe/London
  end_date: string | null;     // null for one-off events
  start_time: string | null;   // HH:MM:SS
  end_time: string | null;

  venue_name: string | null;
  address: string | null;
  postcode: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;

  price_type: PriceType;
  price_min_gbp: number | null;
  booking_required: boolean | null;
  booking_url: string | null;

  source_name: string;
  source_url: string;
  scraped_at: string;          // ISO timestamp
  confidence: number | null;   // 0..1
}

// Personalisation seam (app side sends this, ranking module returns picks).
export interface TasteProfile {
  liked_art_forms: string[];
  liked_tags: string[];
  avoid_tags: string[];
  free_text: string;           // "experimental print, hate crowds"
  free_slots: { date: string; from: string; to: string }[];
  max_price_gbp: number | null;
}

export interface Pick {
  event_id: string;
  score: number;               // 0..1
  reason: string;              // one line shown on the card
}
