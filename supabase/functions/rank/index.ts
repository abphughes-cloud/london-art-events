// Supabase edge function: POST { profile: TasteProfile, limit?: number } -> { picks: Pick[], events: ArtEvent[] }
// Deploy:  npm run sync:edge  then  supabase functions deploy rank --no-verify-jwt
// Optional secret for Claude-written reasons:  supabase secrets set ANTHROPIC_API_KEY=...
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { rank, explainPicks } from "./rank.js"; // copied from ranking/rank.js by `npm run sync:edge`

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { profile, limit = 5 } = await req.json();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: events, error } = await db.from("events").select("*")
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`).limit(2000);
    if (error) throw error;

    let picks = rank(profile, events ?? [], { today, limit });
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (key && picks.length) {
      const byId = Object.fromEntries((events ?? []).map((e) => [e.id, e]));
      try { picks = await explainPicks(new Anthropic({ apiKey: key }), profile, picks, byId); }
      catch (e) { console.error("reasons fell back to templates:", e); }
    }
    const picked = new Set(picks.map((p) => p.event_id));
    return Response.json({ picks, events: (events ?? []).filter((e) => picked.has(e.id)) }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 400, headers: cors });
  }
});
