// ═══════════════════════════════════════════════════════════════════
//  ODDEX VIBE — News Backend
//  Fetches real news, turns it into funny "market events" tied to assets,
//  and serves them to the game. The API key stays safe here on the server.
// ═══════════════════════════════════════════════════════════════════

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // allow the game (browser) to call this server

const NEWS_API_KEY = process.env.NEWS_API_KEY; // set this in Railway (never in code!)
const PORT = process.env.PORT || 3000;

// ─── Asset keyword map: which news topics move which in-game asset ───
// Each asset reacts to certain words appearing in real headlines.
const ASSET_KEYWORDS = {
  DRAM:  ["drama", "feud", "beef", "controversy", "scandal", "backlash", "fight"],
  FOMO:  ["viral", "trend", "sold out", "hype", "everyone", "craze", "rush"],
  CRNG:  ["awkward", "cringe", "embarrassing", "fail", "flop", "disaster"],
  GHOST: ["breakup", "unfollow", "ignored", "left", "ex", "dating", "ghosted"],
  EXNRG: ["relationship", "dating", "romance", "heartbreak", "wedding", "divorce"],
  MNDY:  ["work", "job", "office", "monday", "layoff", "boss", "meeting"],
  RDBR:  ["energy", "coffee", "boost", "hype", "record", "win", "victory"],
  BATT:  ["battery", "phone", "charge", "dead", "low", "power"],
  DELV:  ["delivery", "shipping", "late", "package", "amazon", "delayed"],
  TABS:  ["browser", "internet", "web", "online", "tech", "app"],
};

// ─── Turn a real headline into a funny "market event" ───
function spiceHeadline(title, symbol) {
  const emojis = ["🔥", "📈", "📉", "🚨", "💥", "⚡", "😱", "🤯"];
  const e = emojis[Math.floor(Math.random() * emojis.length)];
  // Keep it short and punchy for the ticker
  const short = title.length > 70 ? title.slice(0, 67) + "..." : title;
  return `${e} ${short}`;
}

// Decide price impact: random but weighted (news causes volatility)
function priceImpact() {
  const dir = Math.random() > 0.5 ? 1 : -1;
  const magnitude = 5 + Math.random() * 30; // 5% to 35% swing
  return parseFloat((dir * magnitude).toFixed(1));
}

// ─── Main endpoint: game calls this to get current news events ───
let cachedEvents = [];
let lastFetch = 0;

// ─── Fetch trending posts from Reddit (free public JSON, no key needed) ───
async function fetchReddit() {
  // Public subreddits with lots of "meme-able" trending content
  const subs = ["news", "worldnews", "technology", "entertainment"];
  const titles = [];
  for (const sub of subs) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=15`, {
        headers: { "User-Agent": "oddex-vibe/1.0" },
      });
      const data = await res.json();
      if (data?.data?.children) {
        for (const post of data.data.children) {
          if (post.data?.title) titles.push(post.data.title);
        }
      }
    } catch (e) { /* skip this sub on error */ }
  }
  return titles;
}

async function fetchNews() {
  // Cache for 5 minutes to respect rate limits
  if (Date.now() - lastFetch < 5 * 60 * 1000 && cachedEvents.length > 0) {
    return cachedEvents;
  }

  // Gather headlines from BOTH sources
  let allTitles = [];

  // Source 1: Reddit (free, always available)
  const redditTitles = await fetchReddit();
  allTitles = allTitles.concat(redditTitles);

  // Source 2: NewsAPI (if key is set)
  if (NEWS_API_KEY) {
    try {
      const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=30&apiKey=${NEWS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.articles) {
        allTitles = allTitles.concat(data.articles.map(a => a.title).filter(Boolean));
      }
    } catch (e) { console.error("NewsAPI failed:", e.message); }
  }

  if (allTitles.length === 0) return demoEvents();

  // Match headlines to assets by keyword
  const events = [];
  for (const rawTitle of allTitles) {
    const title = rawTitle.toLowerCase();
    for (const [symbol, keywords] of Object.entries(ASSET_KEYWORDS)) {
      if (keywords.some(k => title.includes(k))) {
        events.push({
          symbol,
          headline: spiceHeadline(rawTitle, symbol),
          impact: priceImpact(),
          time: Date.now(),
        });
        break;
      }
    }
  }

  if (events.length === 0) return demoEvents();

  cachedEvents = events.slice(0, 20);
  lastFetch = Date.now();
  return cachedEvents;
}

// Fallback demo events (used when no API key or fetch fails)
function demoEvents() {
  const symbols = Object.keys(ASSET_KEYWORDS);
  return symbols.slice(0, 8).map(symbol => ({
    symbol,
    headline: `📊 Market buzz around ${symbol} intensifies`,
    impact: priceImpact(),
    time: Date.now(),
  }));
}

app.get("/", (req, res) => res.json({ status: "ODDEX news backend running" }));

app.get("/news", async (req, res) => {
  const events = await fetchNews();
  res.json({ events });
});

app.listen(PORT, () => console.log(`News backend running on port ${PORT}`));
