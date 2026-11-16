# Oddex Backend

The news backend for OddexVibe. It takes real news and turns it into market events the game can react to, and serves them over a simple API.

## How it works

Every 3 minutes the server reads publisher RSS feeds (BBC, Variety, The Verge, TechCrunch, ESPN), takes only headlines it has not seen yet, and asks DeepSeek which of the 50 ODDEX markets each one affects and how it moves that index. If DeepSeek is not set or fails, a keyword matcher takes over. Nothing is random: the same headline always gives the same result.

Market-moving headlines are written to the Supabase table `market_news` with the service key. The game reads that table, so every player sees the same headline at the same time and the same price move.

## Settings (Railway variables)

- `DEEPSEEK_API_KEY`: scores headlines. Without it the keyword fallback is used.
- `SUPABASE_SERVICE_KEY`: lets the server write `market_news`. Find it in Supabase under Project Settings, API, `service_role` key. Keep it secret, never put it in the frontend.
- `SUPABASE_URL`: optional, defaults to the ODDEX project.

## Endpoints

- `GET /news`: latest market-moving headlines.
- `GET /status`: feed health, classifier in use, rows written. No secrets.

## Running it locally

You need Node.js 18 or newer.

```
npm install
npm test
npm start
```

## Deployment

Deployed on Railway. Pushing to the main branch updates the live service.

## Related

Works with OddexVibe (https://oddexvibe.com) and the oddex-scraper.

## Author

Saima Hamid, Ninja Tech, Lahore. https://ninjatechdev.com
