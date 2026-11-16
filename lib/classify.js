// Turn headlines into market moves.
//
// Primary: one DeepSeek call per batch picks the best market for each
// headline and how it moves that index (-1 down .. +1 up) and how big (0..1).
// Fallback (no key / API error): keyword market match + word-list sentiment.
// Nothing is random: the same headline always gets the same result.

const { MARKETS, BY_SYMBOL } = require("./markets");

const POS = ["win", "wins", "won", "victory", "champion", "record", "award", "awards", "honour", "honor", "success", "successful", "breakthrough",
  "celebrate", "celebrates", "praised", "smash", "smashes", "tops", "best", "soars", "surge", "surges", "boost", "rise", "rises", "returns",
  "comeback", "sold out", "renewed", "engaged", "wedding", "welcomes", "hit", "beats", "gold", "triumph", "launch", "launches", "unveils", "reunion",
  "saves", "rescued", "growth", "recovers", "agreement", "deal", "approved", "wins big", "loved"];
const NEG = ["dies", "died", "death", "dead", "killed", "crash", "crashes", "scandal", "lawsuit", "sued", "sues", "arrested", "charged", "fired",
  "layoff", "layoffs", "job cuts", "cancel", "cancelled", "canceled", "flop", "slams", "backlash", "accused", "split", "divorce", "quits",
  "delayed", "delay", "outage", "hack", "hacked", "ban", "banned", "falls", "plunge", "plunges", "worst", "criticised", "criticized",
  "apology", "apologises", "injured", "injury", "loses", "lost", "defeat", "warning", "strike", "fine", "fined", "probe", "investigation",
  "breach", "shortage", "collapse", "collapses", "row", "fury", "outrage", "slump", "struggle", "struggles", "crisis", "dispute"];

// Headlines about human suffering are never turned into trades.
const SENSITIVE = ["dies", "died", "death", "dead", "killed", "kill", "murder", "murdered", "stabbed", "shot", "shooting", "rape", "raped",
  "sexual assault", "sexually", "abuse", "abused", "assault", "suicide", "overdose", "war", "terror", "terrorist", "bomb", "attack",
  "massacre", "genocide", "hostage", "earthquake", "flood", "wildfire", "hurricane", "disaster", "crash victims", "funeral", "cancer",
  "child", "children", "missing", "prison", "jailed", "sentenced", "trafficking", "refugee", "famine"];

const has = (text, word) => new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(text);

function keywordSentiment(title) {
  const t = title.toLowerCase();
  let p = 0, n = 0;
  for (const w of POS) if (has(t, w)) p++;
  for (const w of NEG) if (has(t, w)) n++;
  if (p === n) return 0;
  return Math.max(-1, Math.min(1, (p - n) / 2));
}

function keywordMarket(title) {
  const t = title.toLowerCase();
  let best = null, score = 0;
  for (const m of MARKETS) {
    let s = 0;
    for (const k of m.kw) if (has(t, k)) s += k.length > 6 ? 2 : 1;
    if (s > score) { score = s; best = m.s; }
  }
  return best;
}

// Index move -> impact percent used by the price engine (+-3..35).
function impactFrom(move, magnitude) {
  const mv = Math.max(-1, Math.min(1, Number(move) || 0));
  const mg = Math.max(0, Math.min(1, Number(magnitude) || 0));
  const pct = Math.sign(mv) * (3 + 32 * Math.abs(mv) * (0.35 + 0.65 * mg));
  return Math.round(Math.max(-35, Math.min(35, pct)) * 10) / 10;
}

function isSensitive(title) {
  const t = title.toLowerCase();
  return SENSITIVE.some((w) => has(t, w));
}

function fallbackClassify(title) {
  if (isSensitive(title)) return null;
  const symbol = keywordMarket(title);
  const sent = keywordSentiment(title);
  if (!symbol || sent === 0) return null; // nothing confident to say
  const move = BY_SYMBOL[symbol].inverse ? -sent : sent;
  return { symbol, move, magnitude: 0.3, impact: impactFrom(move, 0.3), by: "keywords" };
}

function buildPrompt(titles) {
  const markets = MARKETS.map((m) => `${m.s}: ${m.name} (${m.sector})${m.inverse ? " [rises on bad news]" : ""}`).join("\n");
  const list = titles.map((t, i) => `${i}. ${t}`).join("\n");
  return [
    {
      role: "system",
      content:
        "You map real news headlines to markets on ODDEX VIBE, a simulated exchange of sentiment indices. Each index tracks public mood around its topic.\n" +
        "For every headline pick the ONE market it most affects, then say how it moves that index:\n" +
        "move: -1 (strongly pushes the index down) to 1 (strongly pushes it up). Read the index name: bad news raises indices marked [rises on bad news].\n" +
        "magnitude: 0 (minor) to 1 (huge, surprising). Use 0 for pure trivia.\n" +
        "SKIP (leave out of items) any headline about death, violence, sexual abuse or assault, crime against people, prison sentences, war, terrorism, disasters, serious illness, children in danger or other human suffering. We never trade on tragedy.\n" +
        'If no market fits at all, use "TREND". Reply with JSON only: {"items":[{"i":0,"symbol":"FILM","move":0.6,"magnitude":0.4}]}\n\nMarkets:\n' + markets,
    },
    { role: "user", content: "Headlines:\n" + list },
  ];
}

// Validate model output; returns array aligned with titles (null = skip).
function parseClassification(text, count) {
  let data;
  try { data = JSON.parse(String(text).replace(/^```(?:json)?|```$/g, "").trim()); } catch { return new Array(count).fill(null); }
  const out = new Array(count).fill(null);
  for (const it of (data && data.items) || []) {
    const i = Number(it.i);
    if (!Number.isInteger(i) || i < 0 || i >= count) continue;
    const symbol = String(it.symbol || "").toUpperCase();
    if (!BY_SYMBOL[symbol]) continue;
    const move = Number(it.move), magnitude = Number(it.magnitude);
    if (!Number.isFinite(move) || !Number.isFinite(magnitude)) continue;
    if (Math.abs(move) < 0.1) continue; // neutral: no price move
    out[i] = { symbol, move, magnitude, impact: impactFrom(move, magnitude), by: "ai" };
  }
  return out;
}

async function aiClassify(titles, apiKey, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetchImpl("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: buildPrompt(titles),
        temperature: 0.1,
        max_tokens: 60 * titles.length + 50,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error("DeepSeek HTTP " + res.status);
    const data = await res.json();
    return parseClassification(data?.choices?.[0]?.message?.content || "", titles.length);
  } finally { clearTimeout(timer); }
}

// Classify a batch; AI first, keywords for anything the AI skipped or if it fails.
async function classifyAll(titles, apiKey, fetchImpl) {
  let ai = new Array(titles.length).fill(null), error = null;
  if (apiKey && titles.length) {
    try { ai = await aiClassify(titles, apiKey, fetchImpl); } catch (e) { error = e.message; }
  }
  const results = titles.map((t, i) => (isSensitive(t) ? null : ai[i] || (error || !apiKey ? fallbackClassify(t) : null)));
  return { results, error, usedAI: Boolean(apiKey) && !error };
}

module.exports = { isSensitive, keywordSentiment, keywordMarket, impactFrom, fallbackClassify, buildPrompt, parseClassification, aiClassify, classifyAll };
