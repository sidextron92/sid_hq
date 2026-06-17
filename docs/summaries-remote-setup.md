# Communication Summaries Remote Setup

The app reads communication summary HTML through Vercel API routes. The browser never connects directly to the MacBook.

## Current File Layout

The expected report path on the MacBook is:

```txt
Daily Reports/2026-06-16/Slack/summary.html
Daily Reports/2026-06-16/Email/summary.html
Daily Reports/2026-06-16/WhatsApp/summary.html
```

The Next.js API maps:

```txt
/api/summaries/2026-06-16/slack
```

to the MacBook read-only service endpoint:

```txt
{SUMMARIES_BASE_URL}/api/summary/2026-06-16/slack
```

The older static-file URL mode is still available by setting `SUMMARIES_USE_FILE_PATHS=true`, which maps to:

```txt
{SUMMARIES_BASE_URL}/Daily%20Reports/2026-06-16/Slack/summary.html
```

## Recommended Security Model

Do not SSH from Vercel into the MacBook, especially not with password auth.

Use a read-only HTTPS service in front of only the `Daily Reports` folder, protected by a bearer token. Expose that service to Vercel with Cloudflare Tunnel or Tailscale Funnel.

Recommended order:

1. Cloudflare Tunnel to a local read-only reports service.
2. Tailscale Funnel to a local read-only reports service.
3. Sync generated reports to a hosted private bucket or PocketBase collection.

Avoid:

1. Public SSH from Vercel.
2. Password-based SSH automation.
3. Exposing the MacBook filesystem directly.

## Required Vercel Environment Variables

```txt
SUMMARIES_BASE_URL=https://your-public-tunnel-host.example.com
SUMMARIES_API_KEY=long-random-token
SUMMARIES_INDEX_URL=https://your-public-tunnel-host.example.com/api/dates
```

Optional, if the remote service exposes summary URLs somewhere else:

```txt
SUMMARIES_SUMMARY_URL=https://your-public-tunnel-host.example.com/api/summary/{date}/{channel}
```

Optional, only for direct static-file mode:

```txt
SUMMARIES_USE_FILE_PATHS=true
SUMMARIES_REPORTS_ROOT=Daily Reports
```

## Required Date Endpoint

The date list endpoint expects:

```txt
GET /api/dates
```

Example:

```json
{
  "dates": [
    {
      "date": "2026-06-16",
      "channels": ["slack", "email", "whatsapp"]
    }
  ]
}
```

If this endpoint is missing or unreachable, the app will show local dummy dates and an inline warning.
