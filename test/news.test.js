const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MARKETS } = require("../lib/markets");
const { parseFeed } = require("../lib/rss");
const C = require("../lib/classify");
const { writeNews } = require("../lib/store");

test("parses RSS 2.0 with CDATA and entities", () => {
  const xml = `<rss><channel><title>Feed</title>
    <item><title><![CDATA[Star &amp; band win top award]]></title><link>https://ex.com/a</link><pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate></item>
    <item><title>Tom &#39;s show cancelled &#8211; again</title><link>https://ex.com/b</link></item>
  </channel></rss>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Star & band win top award");
  assert.equal(items[0].link, "https://ex.com/a");
  assert.equal(items[0].published, Date.parse("Mon, 16 Nov 2026 10:00:00 GMT"));
  assert.equal(items[1].title, "Tom 's show cancelled – again");
  assert.equal(items[1].published, null);
});

test("parses Atom feeds", () => {
  const xml = `<feed><entry><title type="html">New phone launches</title><link rel="alternate" href="https://v.com/x"/><updated>2026-11-16T09:00:00Z</updated></entry></feed>`;
  const [it] = parseFeed(xml);
  assert.equal(it.title, "New phone launches");
  assert.equal(it.link, "https://v.com/x");
  assert.ok(it.published > 0);
});

test("keyword sentiment and market, never random", () => {
  assert.ok(C.keywordSentiment("Team wins championship in record victory") > 0);
  assert.ok(C.keywordSentiment("Singer arrested after scandal") < 0);
  assert.equal(C.keywordSentiment("Weather today"), 0);
  assert.equal(C.keywordMarket("Netflix renews hit series"), "STRM");
  assert.equal(C.keywordMarket("Premier League match ends in draw"), "SPRT");
  assert.equal(C.keywordMarket("Nothing to see here"), null);
  const a = C.fallbackClassify("Big tech layoffs hit thousands of jobs");
  const b = C.fallbackClassify("Big tech layoffs hit thousands of jobs");
  assert.deepEqual(a, b);
});

test("inverse indices rise on bad news", () => {
  const r = C.fallbackClassify("Mass layoffs announced as budget deadline nears");
  assert.equal(r.symbol, "DDLN");
  assert.ok(r.impact > 0, "deadline pressure goes up");
});

test("impact is bounded and signed", () => {
  assert.equal(C.impactFrom(1, 1), 35);
  assert.equal(C.impactFrom(-1, 1), -35);
  assert.ok(C.impactFrom(0.2, 0) > 0 && C.impactFrom(0.2, 0) < 6);
  assert.equal(C.impactFrom(0, 1), 0);
  assert.equal(C.impactFrom(9, 9), 35);
});

test("AI output is validated", () => {
  const titles = ["Film wins", "Odd one", "Match today", "Cup final"];
  const txt = JSON.stringify({ items: [
    { i: 0, w: "Film", symbol: "film", move: 0.8, magnitude: 0.5 },
    { i: 1, w: "Odd", symbol: "NOPE", move: 0.8, magnitude: 0.5 },
    { i: 2, w: "Match", symbol: "SPRT", move: 0.05, magnitude: 0.9 },
    { i: 9, w: "Cup", symbol: "SPRT", move: 0.5, magnitude: 0.5 },
    { i: 3, w: "Cup", symbol: "SPRT", move: "x", magnitude: 0.5 },
  ] });
  const r = C.parseClassification(txt, titles);
  assert.equal(r[0].symbol, "FILM");
  assert.ok(r[0].impact > 0);
  assert.equal(r[1], null);
  assert.equal(r[2], null);
  assert.equal(r[3], null);
  assert.deepEqual(C.parseClassification("not json", ["a b", "c d"]), [null, null]);
});

test("classifyAll uses AI, falls back to keywords on error", async () => {
  const titles = ["Netflix series renewed after record views", "Weather today"];
  const ok = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, w: "Netflix", symbol: "STRM", move: 0.7, magnitude: 0.6 }] }) } }] }) });
  const a = await C.classifyAll(titles, "key", ok);
  assert.equal(a.usedAI, true);
  assert.equal(a.results[0].by, "ai");
  assert.equal(a.results[1], null);
  const bad = async () => ({ ok: false, status: 500 });
  const b = await C.classifyAll(titles, "key", bad);
  assert.equal(b.usedAI, false);
  assert.match(b.error, /500/);
  assert.equal(b.results[0].by, "keywords");
  const c = await C.classifyAll(titles, undefined);
  assert.equal(c.results[0].symbol, "STRM");
});

test("prompt lists every market and marks inverse ones", () => {
  const [sys] = C.buildPrompt(["x"]);
  for (const m of MARKETS) assert.ok(sys.content.includes(m.s + ":"), m.s);
  assert.ok(sys.content.includes("STRS: Stress Index (Lifestyle) [rises on bad news]"));
});

test("writeNews posts with service key, retries without new columns, skips without creds", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    if (calls.length === 1) return { ok: false, status: 400, text: async () => "column \"source\" does not exist" };
    return { ok: true, json: async () => [{}, {}] };
  };
  const rows = [{ headline: "a", symbol: "FILM", impact: 5, source: "BBC", url: "https://x" }, { headline: "b", symbol: "SPRT", impact: -4, source: "ESPN", url: null }];
  const r = await writeNews(rows, { url: "https://p.supabase.co/", key: "eyJsvc", fetchImpl });
  assert.equal(r.written, 2);
  assert.equal(calls[0].url, "https://p.supabase.co/rest/v1/market_news?on_conflict=headline");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer eyJsvc");
  assert.equal(calls[0].opts.headers.apikey, "eyJsvc");
  calls.length = 0;
  await writeNews(rows, { url: "https://p.supabase.co", key: "sb_secret_abc", fetchImpl: async (u, o) => { calls.push(o); return { ok: true, json: async () => [] }; } });
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[0].headers.apikey, "sb_secret_abc");
  assert.match(calls[0].opts.headers.Prefer, /ignore-duplicates/);
  assert.deepEqual(Object.keys(calls[1].body[0]), ["headline", "symbol", "impact"]);
  assert.equal((await writeNews(rows, { url: "u" })).skipped, "no supabase credentials");
});

test("market tickers match the frontend catalog", { skip: !fs.existsSync(path.join(__dirname, "../../oddexvibe/src/v2/lib/assets.js")) }, () => {
  const src = fs.readFileSync(path.join(__dirname, "../../oddexvibe/src/v2/lib/assets.js"), "utf8");
  const front = [...src.matchAll(/symbol: "([A-Z]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(MARKETS.map((m) => m.s).sort(), front);
});

test("headlines about human suffering are never traded", async () => {
  const titles = ["Actor sentenced to prison after sexual assault case", "Flood kills dozens", "Netflix renews hit comedy series"];
  for (const t of titles.slice(0, 2)) assert.equal(C.isSensitive(t), true, t);
  assert.equal(C.isSensitive(titles[2]), false);
  // Even if the AI returns them, they are dropped.
  const ai = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [
    { i: 0, w: "Actor", symbol: "CELEB", move: -0.8, magnitude: 0.8 }, { i: 1, w: "Flood", symbol: "STRS", move: 0.9, magnitude: 0.9 }, { i: 2, w: "Netflix", symbol: "STRM", move: 0.6, magnitude: 0.4 },
  ] }) } }] }) });
  const r = await C.classifyAll(titles, "key", ai);
  assert.equal(r.results[0], null);
  assert.equal(r.results[1], null);
  assert.equal(r.results[2].symbol, "STRM");
  assert.ok(C.buildPrompt(["x"])[0].content.includes("never trade on tragedy"));
});

test("a renumbered / shifted AI answer can't land on the wrong headline", () => {
  const titles = ["Russell Brand moved to new prison", "Dr. Hedgehog documentary boarded", "Avoid this Black Friday scam"];
  // Model skipped item 0 and numbered the rest from 0: classic shift.
  const shifted = JSON.stringify({ items: [
    { i: 0, w: "Dr.", symbol: "FILM", move: 0.4, magnitude: 0.3 },
    { i: 1, w: "Avoid", symbol: "TRST", move: -0.5, magnitude: 0.4 },
  ] });
  const r = C.parseClassification(shifted, titles);
  assert.deepEqual(r, [null, null, null]);
  const right = JSON.stringify({ items: [
    { i: 0, w: "Russell", symbol: null, move: 0, magnitude: 0 },
    { i: 1, w: "Dr.", symbol: "FILM", move: 0.4, magnitude: 0.3 },
    { i: 2, w: "Avoid", symbol: "TRST", move: -0.5, magnitude: 0.4 },
  ] });
  const ok = C.parseClassification(right, titles);
  assert.equal(ok[0], null);
  assert.equal(ok[1].symbol, "FILM");
  assert.equal(ok[2].symbol, "TRST");
});
