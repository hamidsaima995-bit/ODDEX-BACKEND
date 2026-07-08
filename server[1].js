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
// Tuned for entertainment / celebrity / TikTok / YouTube / sports headlines.
const ASSET_KEYWORDS = {
  DRAM:  ["drama", "feud", "beef", "controversy", "scandal", "backlash", "fight", "diss", "clap back", "shade", "exposed", "canceled"],
  FOMO:  ["viral", "trend", "sold out", "hype", "everyone", "craze", "rush", "goes viral", "trending", "breaks internet", "record"],
  CRNG:  ["awkward", "cringe", "embarrassing", "fail", "flop", "disaster", "roasted", "mocked", "booed"],
  GHOST: ["breakup", "unfollow", "ignored", "split", "ex ", "dating", "ghosted", "divorce", "single"],
  EXNRG: ["relationship", "dating", "romance", "heartbreak", "wedding", "engaged", "married", "couple", "kiss"],
  MNDY:  ["work", "job", "layoff", "fired", "quit", "strike", "boss", "retire", "resign"],
  RDBR:  ["energy", "win", "victory", "champion", "record", "wins", "beats", "defeats", "gold medal", "mvp"],
  BATT:  ["battery", "phone", "iphone", "android", "tech", "gadget", "launch", "release"],
  DELV:  ["delivery", "shipping", "late", "package", "amazon", "delayed", "tour", "concert", "canceled show"],
  TABS:  ["youtube", "tiktok", "streamer", "influencer", "creator", "subscribers", "views", "podcast", "netflix", "movie", "album", "song"],
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
  // Entertainment / celebrity / viral / sports subs — most "meme-able" content
  const subs = [
    "entertainment", "popculturechat", "Deuxmoi", "celebgossip",
    "sports", "nba", "soccer", "youtube", "tiktokcringe",
    "trending", "OutOfTheLoop", "technology", "worldnews",
  ];
  const titles = [];
  for (const sub of subs) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=12`, {
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
  if (Date.now() - lastFetch < 3 * 60 * 1000 && cachedEvents.length > 0) {
    return cachedEvents;
  }

  // Gather headlines from BOTH sources
  let allTitles = [];

  // Source 1: Reddit (free, always available)
  const redditTitles = await fetchReddit();
  allTitles = allTitles.concat(redditTitles);

  // Source 2: NewsAPI (if key is set) — entertainment focus
  if (NEWS_API_KEY) {
    try {
      // Pull both entertainment and general top headlines
      const urls = [
        `https://newsapi.org/v2/top-headlines?language=en&category=entertainment&pageSize=25&apiKey=${NEWS_API_KEY}`,
        `https://newsapi.org/v2/top-headlines?language=en&category=sports&pageSize=15&apiKey=${NEWS_API_KEY}`,
      ];
      for (const url of urls) {
        const res = await fetch(url);
        const data = await res.json();
        if (data.articles) {
          allTitles = allTitles.concat(data.articles.map(a => a.title).filter(Boolean));
        }
      }
    } catch (e) { console.error("NewsAPI failed:", e.message); }
  }

  if (allTitles.length === 0) return demoEvents();

  // Match headlines to assets by keyword
  const events = [];
  const symbols = Object.keys(ASSET_KEYWORDS);
  for (const rawTitle of allTitles) {
    const title = rawTitle.toLowerCase();
    let matched = false;
    for (const [symbol, keywords] of Object.entries(ASSET_KEYWORDS)) {
      if (keywords.some(k => title.includes(k))) {
        events.push({
          symbol,
          headline: spiceHeadline(rawTitle, symbol),
          impact: priceImpact(),
          time: Date.now(),
        });
        matched = true;
        break;
      }
    }
    // No keyword match? Still show the real headline, assigned to a random asset.
    // This keeps REAL news flowing instead of falling back to demo text.
    if (!matched && rawTitle.length > 15) {
      events.push({
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        headline: spiceHeadline(rawTitle, ""),
        impact: priceImpact(),
        time: Date.now(),
      });
    }
  }

  if (events.length === 0) return demoEvents();

  cachedEvents = events.slice(0, 25);
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

// Debug endpoint — shows whether the key is set and if NewsAPI works
app.get("/debug", async (req, res) => {
  const keySet = !!NEWS_API_KEY;
  const keyPreview = NEWS_API_KEY ? (NEWS_API_KEY.slice(0, 4) + "..." + NEWS_API_KEY.slice(-2)) : "NOT SET";
  let newsApiWorks = false;
  let newsApiError = null;
  let sampleTitle = null;
  if (NEWS_API_KEY) {
    try {
      const r = await fetch(`https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${NEWS_API_KEY}`);
      const d = await r.json();
      if (d.status === "ok" && d.articles?.length) { newsApiWorks = true; sampleTitle = d.articles[0].title; }
      else newsApiError = d.message || d.code || "unknown";
    } catch (e) { newsApiError = e.message; }
  }
  let redditWorks = false;
  try {
    const r = await fetch("https://www.reddit.com/r/news/hot.json?limit=1", { headers: { "User-Agent": "oddex-vibe/1.0" } });
    const d = await r.json();
    redditWorks = !!d?.data?.children?.length;
  } catch (e) { redditWorks = false; }
  res.json({ keySet, keyPreview, newsApiWorks, newsApiError, sampleTitle, redditWorks });
});

app.get("/news", async (req, res) => {
  const events = await fetchNews();
  res.json({ events });
});

app.listen(PORT, () => console.log(`News backend running on port ${PORT}`));
