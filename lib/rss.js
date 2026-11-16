// Minimal RSS 2.0 / Atom headline reader. We only need title, link and date,
// so a small tolerant parser beats pulling in an XML dependency.

const FEEDS = [
  { source: "BBC Entertainment", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
  { source: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { source: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { source: "BBC Health", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
  { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
  { source: "Variety", url: "https://variety.com/feed/" },
  { source: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { source: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { source: "ESPN", url: "https://www.espn.com/espn/rss/news" },
];

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function parseFeed(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = tag(b, "title");
    if (!title) continue;
    let link = tag(b, "link");
    if (!link) {
      const href = b.match(/<link[^>]*href="([^"]+)"/i);
      link = href ? href[1] : "";
    }
    const date = tag(b, "pubDate") || tag(b, "updated") || tag(b, "published");
    const published = date ? Date.parse(date) : NaN;
    out.push({ title, link: /^https?:\/\//.test(link) ? link : "", published: Number.isFinite(published) ? published : null });
  }
  return out;
}

async function fetchWithTimeout(url, ms = 8000, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { "User-Agent": "ODDEX-VIBE-news/2.0 (+https://oddexvibe.com)", ...(opts.headers || {}) } });
  } finally { clearTimeout(t); }
}

// Returns { items: [{title, link, published, source}], stats: {source: count|error} }
async function fetchAllFeeds(feeds = FEEDS) {
  const stats = {};
  const results = await Promise.all(feeds.map(async (f) => {
    try {
      const res = await fetchWithTimeout(f.url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const items = parseFeed(await res.text()).slice(0, 20).map((x) => ({ ...x, source: f.source }));
      stats[f.source] = items.length;
      return items;
    } catch (e) {
      stats[f.source] = "error: " + (e.name === "AbortError" ? "timeout" : e.message);
      return [];
    }
  }));
  return { items: results.flat(), stats };
}

module.exports = { FEEDS, parseFeed, decode, fetchAllFeeds, fetchWithTimeout };
