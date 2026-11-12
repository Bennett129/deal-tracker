# Deal Tracker

Tracks PC game prices across 30+ stores, charts their history and emails you when a game on your wishlist drops in price.

**Stack:** Next.js 16 (App Router), Tailwind CSS, shadcn/ui, Drizzle ORM, Postgres (Neon), Inngest (scheduled jobs), Resend, Recharts, [CheapShark API](https://apidocs.cheapshark.com).

## Features

- Browse the best current deals and search any PC game
- Game page with current price at every store and a price-history chart
- Passwordless sign-in by email link
- Wishlist with an optional target price per game
- Scheduled job every six hours: snapshots prices, then sends one digest email per user
- Alerts for three reasons: price hit your target, a new all-time low, or a drop of 5% or more
- No repeat emails: a price you have already been told about is not announced again
- Every link to a store goes through CheapShark's redirect, as their API terms require

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. No accounts are needed:

- **Database:** without `DATABASE_URL` the app uses PGlite (Postgres running in-process) and creates its tables on first use.
- **Email:** without `RESEND_API_KEY` emails are printed to the terminal running `npm run dev`. That includes the sign-in link: copy it from there.

### Try the whole flow in two minutes

1. Sign in (copy the link from the terminal), open a game and add it to your wishlist.
2. `npm run sync` records current prices.
3. `npm run sync -- --demo-drop` pretends the last recorded price was 25% higher, so the real price looks like a drop. An alert email appears in the terminal and the chart shows the step down. (Development only.)

### Scheduled runs

The six-hourly schedule is an Inngest function (`src/inngest/functions.ts`). To run it locally, start the Inngest dev server next to the app:

```bash
npm run inngest
```

Then open http://localhost:8288 to trigger the function and watch each step.

## Going live

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string. Run `npm run db:migrate` once. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Send real email through Resend |
| `SESSION_SECRET` | Signs session cookies. Required in production. |
| `SYNC_SECRET` | Bearer token for `POST /api/sync`. Required in production. |
| `NEXT_PUBLIC_APP_URL` | Public URL, used for links in emails |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | From your Inngest app, for the schedule |

## Where things are

- `src/lib/cheapshark.ts`: API client and the redirect-link builder
- `src/lib/alerts.ts`: the rule that decides whether to alert (pure, unit tested)
- `src/lib/sync.ts`: price snapshot job and alert digest
- `src/inngest/`: the schedule
- `src/db/schema.ts`: tables

Prices are in US dollars. Price data and deal links are provided by CheapShark.
