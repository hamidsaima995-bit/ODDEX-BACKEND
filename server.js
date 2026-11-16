// ODDEX VIBE news backend.
//
// Every 3 minutes: read publisher RSS feeds, send only new headlines to the
// classifier (DeepSeek, keyword fallback), and write market-moving ones to
// Supabase `market_news`. The frontend reads that table, so every player
// gets the same headline at the same time and the same price shock.
//
// Env: DEEPSEEK_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, PORT

const express = require("express");
const cors = require("cors");
const { fetchAllFeeds } = require("./lib/rss");
const { classifyAll } = require("./lib/classify");
const { writeNews } = require("./lib/store");

const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://khikflaqrdaxzwyajfhd.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CYCLE_MS = 3 * 60 * 1000;
const MAX_AGE_MS = 24 * 3600 * 1000;
const BATCH = 40;

const seen = new Map();   // headline -> true (classified already, moving or not)
let events = [];          // newest first, what /news serves
const status = { startedAt: new Date().toISOString(), lastRun: null, lastError: null, feeds: {}, classifier: null, newHeadlines: 0, moving: 0, written: 0, totalWritten: 0, running: false };

function remember(title) {
  seen.set(title, true);
  if (seen.size > 5000) seen.delete(seen.keys().next().value);
}

async function cycle() {
  if (status.running) return;
  status.running = true;
  try {
    const { items, stats } = await fetchAllFeeds();
    status.feeds = stats;
    const now = Date.now();
    const fresh = [];
    const titles = new Set();
    for (const it of items.sort((a, b) => (b.published || 0) - (a.published || 0))) {
      const title = it.title.slice(0, 300);
      if (title.length < 15 || seen.has(title) || titles.has(title)) continue;
      if (it.published && now - it.published > MAX_AGE_MS) { remember(title); continue; }
      titles.add(title);
      fresh.push({ ...it, title });
      if (fresh.length >= BATCH) break;
    }
    status.newHeadlines = fresh.length;
    if (!fresh.length) { status.moving = 0; status.written = 0; return; }

    const { results, error, usedAI } = await classifyAll(fresh.map((f) => f.title), DEEPSEEK_API_KEY);
    status.classifier = usedAI ? "deepseek" : DEEPSEEK_API_KEY ? "keywords (AI error: " + error + ")" : "keywords (no DEEPSEEK_API_KEY)";

    const rows = [];
    fresh.forEach((f, i) => {
      remember(f.title);
      const r = results[i];
      if (!r) return;
      rows.push({ headline: f.title, symbol: r.symbol, impact: r.impact, source: f.source, url: f.link || null });
    });
    status.moving = rows.length;
    events = rows.map((r) => ({ ...r, time: now })).concat(events).slice(0, 80);

    const w = await writeNews(rows, { url: SUPABASE_URL, key: SUPABASE_SERVICE_KEY });
    status.written = w.written;
    status.totalWritten += w.written;
    if (w.skipped) status.lastError = w.skipped;
    else status.lastError = null;
  } catch (e) {
    status.lastError = e.message;
    console.error("cycle failed:", e);
  } finally {
    status.running = false;
    status.lastRun = new Date().toISOString();
  }
}

const app = express();
app.use(cors());
app.get("/", (req, res) => res.json({ status: "ODDEX news backend running" }));
app.get("/news", (req, res) => res.json({ events, updatedAt: status.lastRun }));
app.get("/status", (req, res) => res.json({
  ...status,
  deepseekKeySet: Boolean(DEEPSEEK_API_KEY),
  supabaseKeySet: Boolean(SUPABASE_SERVICE_KEY),
  cached: events.length,
}));
app.get("/debug", (req, res) => res.redirect("/status"));

app.listen(PORT, () => {
  console.log("News backend running on port " + PORT);
  cycle();
  setInterval(cycle, CYCLE_MS);
});

module.exports = { cycle };
