// scraper.js — ODDEX VIBE news scraper
// Real HTML scraping (Cheerio) -> Supabase news_items table

const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service key, anon nahi
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- 1. Asset keywords (server.js jaise hi) ----------
const ASSET_KEYWORDS = {
  DRAM:  ["drama","feud","beef","controversy","scandal","backlash","fight","diss","shade","exposed","canceled"],
  FOMO:  ["viral","trend","sold out","hype","everyone","craze","rush","trending","record"],
  CRNG:  ["awkward","cringe","embarrassing","fail","flop","disaster","roasted","mocked","booed"],
  GHOST: ["breakup","unfollow","ignored","split","dating","ghosted","divorce","single"],
  EXNRG: ["relationship","dating","romance","heartbreak","wedding","engaged","married","couple"],
  MNDY:  ["work","job","layoff","fired","quit","strike","boss","retire","resign"],
  RDBR:  ["energy","win","victory","champion","record","wins","beats","defeats","mvp"],
  BATT:  ["battery","phone","iphone","android","tech","gadget","launch","release"],
  DELV:  ["delivery","shipping","late","package","amazon","delayed","tour","concert"],
  TABS:  ["youtube","tiktok","streamer","influencer","creator","subscribers","views","podcast","netflix","movie","album","song"],
};

function matchSymbol(title) {
  const t = title.toLowerCase();
  for (const [symbol, keywords] of Object.entries(ASSET_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) return symbol;
  }
  const all = Object.keys(ASSET_KEYWORDS);
  return all[Math.floor(Math.random() * all.length)];
}

function spiceHeadline(title) {
  const e = ["🔥","📈","📉","🚨","💥","⚡","😱","🤯"][Math.floor(Math.random() * 8)];
  const s = title.length > 80 ? title.slice(0, 77) + "..." : title;
  return e + " " + s;
}

function priceImpact() {
  const d = Math.random() > 0.5 ? 1 : -1;
  return parseFloat((d * (5 + Math.random() * 30)).toFixed(1));
}

// ---------- 2. Fetch helper (retry + timeout) ----------
async function fetchHTML(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; oddexvibe-bot/1.0)",
          "Accept": "text/html",
        },
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (e) {
      console.log(`  fetch fail (${i + 1}/${retries + 1}) ${url}: ${e.message}`);
      if (i === retries) return null;
      await new Promise(r => setTimeout(r, 2000 * (i + 1))); // backoff
    }
  }
  return null;
}

// ---------- 3. Scrapers ----------
// Har site ka HTML alag hota hai, isliye har site ka apna selector.

async function scrapeCoinDesk() {
  const html = await fetchHTML("https://www.coindesk.com/");
  if (!html) return [];

  const $ = cheerio.load(html);
  const titles = [];

  // headings ke andar ka text uthao
  $("h2, h3, h4").each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 25 && text.length < 200) titles.push(text);
  });

  return [...new Set(titles)].slice(0, 20).map(t => ({ title: t, source: "coindesk" }));
}

async function scrapeHackerNews() {
  const html = await fetchHTML("https://news.ycombinator.com/");
  if (!html) return [];

  const $ = cheerio.load(html);
  const titles = [];

  $(".titleline > a").each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) titles.push(text);
  });

  return [...new Set(titles)].slice(0, 20).map(t => ({ title: t, source: "hackernews" }));
}

// ---------- 4. Save to Supabase ----------
async function saveItems(items) {
  if (items.length === 0) return 0;

  const rows = items.map(item => ({
    headline: spiceHeadline(item.title),
    source: item.source,
    symbol: matchSymbol(item.title),
    impact: priceImpact(),
  }));

  // upsert = duplicate headline aaya to skip, error nahi
  const { data, error } = await supabase
    .from("news_items")
    .upsert(rows, { onConflict: "headline", ignoreDuplicates: true })
    .select();

  if (error) {
    console.error("Supabase error:", error.message);
    return 0;
  }
  return data ? data.length : 0;
}

// ---------- 5. Main ----------
async function runScraper() {
  console.log("Scraper start:", new Date().toISOString());

  const results = await Promise.all([
    scrapeCoinDesk(),
    scrapeHackerNews(),
  ]);

  const all = results.flat();
  console.log(`Scraped ${all.length} headlines`);

  if (all.length === 0) {
    console.log("Kuch nahi mila — selectors check karo");
    return { scraped: 0, saved: 0 };
  }

  const saved = await saveItems(all);
  console.log(`Saved ${saved} new (baaki duplicate the)`);

  return { scraped: all.length, saved };
}

// Direct run: node scraper.js
if (require.main === module) {
  runScraper()
    .then(r => { console.log("Done:", r); process.exit(0); })
    .catch(e => { console.error("Crash:", e); process.exit(1); });
}

module.exports = { runScraper };
