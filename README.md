# ODDEX VIBE — Backend

The backend service that powers [ODDEX VIBE](https://oddexvibe.com), a live browser-based trading simulator. This service handles the API, real-time data, AI commentary, and database operations.

**Live API:** https://oddex-backend-production.up.railway.app

**Frontend repo:** the ODDEX VIBE frontend (React/Vite) connects to this backend.

---

## What it does

- **API server** — handles requests from the ODDEX VIBE frontend
- **Price data** — serves and saves price history to the database
- **AI commentary** — connects to an LLM API to generate market sentiment (long / short / neutral) with short reasoning
- **Community backend** — powers leaderboard, community chat with auto-moderation, referrals, and online player presence
- **Always-on** — runs 24/7 with automatic restarts

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express |
| Database | Supabase (Postgres) |
| AI | LLM API for sentiment commentary |
| Deployment | Railway (24/7) |

---

## Main entry point

- `server.js` — the Express server root

---

## Database (Supabase)

Tables include: `accounts`, `leaderboard`, `price_history`, `feedback`, `chat_messages`, `presence`

---

## Status

Live and actively maintained, serving the ODDEX VIBE frontend in production.

## Author

Built end-to-end by **Saima Hamid** (Ninja Tech).
