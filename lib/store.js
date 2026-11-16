// Writes market-moving headlines into Supabase `market_news` with the
// service key (server only). The first write of a headline wins, so every
// player sees the same timestamp and the same price shock.

async function writeNews(rows, { url, key, fetchImpl = fetch } = {}) {
  if (!url || !key || !rows.length) return { written: 0, skipped: !url || !key ? "no supabase credentials" : null };
  const endpoint = url.replace(/\/$/, "") + "/rest/v1/market_news?on_conflict=headline";
  const send = (body) => fetchImpl(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      // Legacy service_role keys are JWTs and go in Authorization too; new
      // sb_secret_ keys are not JWTs and only go in the apikey header.
      ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}),
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(body),
  });
  let res = await send(rows);
  if (!res.ok) {
    // Older table without source/url columns: retry with the core fields.
    const text = await res.text();
    if (/source|url/i.test(text)) res = await send(rows.map(({ headline, symbol, impact }) => ({ headline, symbol, impact })));
    else throw new Error("Supabase " + res.status + ": " + text.slice(0, 200));
    if (!res.ok) throw new Error("Supabase " + res.status + ": " + (await res.text()).slice(0, 200));
  }
  const inserted = await res.json().catch(() => []);
  return { written: Array.isArray(inserted) ? inserted.length : 0 };
}

module.exports = { writeNews };
