// The 50 ODDEX VIBE markets. Keep tickers in sync with the frontend
// (Oddexvibe/src/v2/lib/assets.js).
//
// `inverse: true` means the index rises on bad news (Stress Index goes UP
// when layoffs hit). `kw` is the keyword fallback used when the AI is off.

const MARKETS = [
  { s: "VIBE",  name: "ODDEX Mood Index",          sector: "Index",         kw: [] },
  { s: "CELEB", name: "Celebrity Sentiment Index", sector: "Entertainment", kw: ["celebrity", "star", "actor", "actress", "singer", "rapper", "kardashian", "royal", "prince", "princess", "feud", "scandal"] },
  { s: "FILM",  name: "Film & Box Office Index",   sector: "Entertainment", kw: ["film", "movie", "box office", "cinema", "director", "oscar", "trailer", "sequel", "casting", "hollywood"] },
  { s: "STRM",  name: "Streaming Index",           sector: "Entertainment", kw: ["netflix", "disney+", "hbo", "prime video", "apple tv", "streaming", "spotify"] },
  { s: "TVIX",  name: "Television Index",          sector: "Entertainment", kw: ["tv", "series", "season", "episode", "sitcom", "snl", "talk show", "bbc one", "itv", "reality show"] },
  { s: "MEDIA", name: "Media Buzz Index",          sector: "Entertainment", kw: ["media", "newspaper", "journalist", "broadcaster", "interview", "podcast"] },
  { s: "ARTS",  name: "Arts & Culture Index",      sector: "Entertainment", kw: ["art", "museum", "gallery", "painting", "theatre", "theater", "opera", "auction", "festival", "book", "novel", "author"] },
  { s: "SPRT",  name: "Sports & Events Index",     sector: "Entertainment", kw: ["football", "soccer", "nba", "nfl", "cricket", "tennis", "f1", "ufc", "boxing", "match", "league", "cup", "olympic", "goal", "coach", "transfer", "wrestling", "wwe"] },
  { s: "FAND",  name: "Fandom Index",              sector: "Entertainment", kw: ["fans", "fandom", "spoiler", "comic-con", "anime", "k-pop", "kpop", "tour"] },
  { s: "WTCH",  name: "Watch Time Index",          sector: "Entertainment", kw: ["binge", "viewers", "ratings", "most-watched", "views"] },
  { s: "FANT",  name: "Fantasy & Sci-Fi Index",    sector: "Entertainment", kw: ["marvel", "star wars", "dc studios", "superman", "batman", "fantasy", "sci-fi", "dragon", "lord of the rings", "harry potter"] },
  { s: "NOST",  name: "Nostalgia Index",           sector: "Entertainment", kw: ["reboot", "remake", "reunion", "anniversary", "retro", "classic", "comeback", "revival"] },
  { s: "MSGS",  name: "Messaging Index",           sector: "Social",        kw: ["whatsapp", "imessage", "telegram", "messaging", "texts"] },
  { s: "RUMR",  name: "Rumor Mill Index",          sector: "Social",        kw: ["rumor", "rumour", "reportedly", "allegedly", "speculation", "leak", "leaked"], inverse: true },
  { s: "SOCL",  name: "Social Comfort Index",      sector: "Social",        kw: ["loneliness", "friendship", "community", "social anxiety"] },
  { s: "EMPA",  name: "Empathy Index",             sector: "Social",        kw: ["charity", "donation", "kindness", "volunteer", "rescue", "fundraiser"] },
  { s: "RESP",  name: "Response Rate Index",       sector: "Social",        kw: ["responds", "replies", "response", "statement"] },
  { s: "CHAT",  name: "Chat Activity Index",       sector: "Social",        kw: ["group chat", "discord", "reddit", "forum"] },
  { s: "CONF",  name: "Confidence Index",          sector: "Social",        kw: ["confidence", "survey", "poll", "optimism", "pessimism"] },
  { s: "TRST",  name: "Trust Index",               sector: "Social",        kw: ["trust", "misinformation", "fake", "deepfake", "scam", "fraud", "hoax"] },
  { s: "COMM",  name: "Communication Index",       sector: "Social",        kw: ["speech", "apology", "apologises", "apologizes", "open letter", "announces"] },
  { s: "DATE",  name: "Dating Sentiment Index",    sector: "Social",        kw: ["dating", "relationship", "engaged", "engagement", "wedding", "married", "divorce", "split", "breakup", "romance"] },
  { s: "VIRAL", name: "Viral Content Index",       sector: "Trends",        kw: ["viral", "goes viral", "tiktok", "meme", "trend", "challenge", "breaks the internet"] },
  { s: "COLL",  name: "Rare Collectibles Index",   sector: "Trends",        kw: ["collectible", "rare", "sells for", "auctioned", "memorabilia", "limited edition", "sneaker"] },
  { s: "CRTR",  name: "Creator Economy Index",     sector: "Trends",        kw: ["youtuber", "creator", "streamer", "twitch", "youtube", "subscribers"] },
  { s: "QUIET", name: "Low Attention Index",       sector: "Trends",        kw: [] },
  { s: "TREND", name: "Trending Topics Index",     sector: "Trends",        kw: ["trending", "everyone", "craze", "hype", "record-breaking", "sold out"] },
  { s: "LNCH",  name: "Product Launch Index",      sector: "Trends",        kw: ["launch", "launches", "unveils", "release", "released", "debut", "new iphone", "pre-order"] },
  { s: "INFL",  name: "Influencer Index",          sector: "Trends",        kw: ["influencer", "instagram", "followers", "brand deal", "sponsor"] },
  { s: "CALM",  name: "Calm & Rest Index",         sector: "Lifestyle",     kw: ["wellbeing", "wellness", "meditation", "holiday", "vacation", "mental health"] },
  { s: "MORN",  name: "Morning Energy Index",      sector: "Lifestyle",     kw: ["coffee", "breakfast", "morning", "daylight"] },
  { s: "WKND",  name: "Weekend Plans Index",       sector: "Lifestyle",     kw: ["weekend", "bank holiday", "things to do", "concert", "gig", "party", "christmas", "eid", "diwali"] },
  { s: "LIFE",  name: "Lifestyle Index",           sector: "Lifestyle",     kw: ["lifestyle", "horoscope", "fashion", "style", "beauty", "home", "royal family"] },
  { s: "STRS",  name: "Stress Index",              sector: "Lifestyle",     kw: ["stress", "burnout", "anxiety", "pressure", "crisis", "warning", "strike", "chaos"], inverse: true },
  { s: "NUTR",  name: "Nutrition Index",           sector: "Lifestyle",     kw: ["diet", "food", "recipe", "nutrition", "vegan", "sugar", "obesity", "restaurant", "chef"] },
  { s: "SLPD",  name: "Sleep Debt Index",          sector: "Lifestyle",     kw: ["sleep", "insomnia", "night shift", "clocks go back", "jet lag"], inverse: true },
  { s: "NIGHT", name: "Night Owl Index",           sector: "Lifestyle",     kw: ["nightlife", "late-night", "midnight", "club", "after dark"] },
  { s: "HOUS",  name: "Housing Pressure Index",    sector: "Lifestyle",     kw: ["rent", "renters", "mortgage", "house prices", "housing", "landlord", "eviction"], inverse: true },
  { s: "FIT",   name: "Fitness Index",             sector: "Lifestyle",     kw: ["fitness", "gym", "workout", "marathon", "running", "exercise", "athlete"] },
  { s: "CMUT",  name: "Commute Index",             sector: "Lifestyle",     kw: ["train", "rail", "traffic", "commute", "airport", "flights", "bus", "tube", "road"] },
  { s: "GROC",  name: "Grocery Index",             sector: "Lifestyle",     kw: ["grocery", "supermarket", "food prices", "inflation", "shopping"] },
  { s: "PROD",  name: "Productivity Index",        sector: "Work & Tech",   kw: ["productivity", "four-day week", "office", "economy", "growth", "jobs report"] },
  { s: "CONN",  name: "Connectivity Index",        sector: "Work & Tech",   kw: ["broadband", "5g", "wifi", "network", "satellite", "starlink", "mobile network"] },
  { s: "TEAM",  name: "Teamwork Index",            sector: "Work & Tech",   kw: ["team", "union", "partnership", "merger", "collaboration", "teams up"] },
  { s: "NETS",  name: "Internet Speed Index",      sector: "Work & Tech",   kw: ["outage", "down", "internet", "cloudflare", "aws", "servers", "crash"] },
  { s: "LANG",  name: "Language & Text Index",     sector: "Work & Tech",   kw: ["ai", "chatgpt", "chatbot", "openai", "language model", "translation", "writing"] },
  { s: "RMTE",  name: "Remote Work Index",         sector: "Work & Tech",   kw: ["remote work", "work from home", "return to office", "hybrid", "zoom"] },
  { s: "CSAT",  name: "Customer Service Index",    sector: "Work & Tech",   kw: ["customer", "complaint", "refund", "service", "airline", "bank"] },
  { s: "NOTF",  name: "Notification Index",        sector: "Work & Tech",   kw: ["notification", "alert", "app", "update", "smartphone", "iphone", "android", "screen time"], inverse: true },
  { s: "DDLN",  name: "Deadline Pressure Index",   sector: "Work & Tech",   kw: ["deadline", "layoff", "layoffs", "job cuts", "fired", "budget", "exams", "tax"], inverse: true },
];

const BY_SYMBOL = Object.fromEntries(MARKETS.map((m) => [m.s, m]));

module.exports = { MARKETS, BY_SYMBOL };
