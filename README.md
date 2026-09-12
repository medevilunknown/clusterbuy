# ClusterBuy

ClusterBuy is a multi-role collective-procurement platform for Indian MSMEs. It supports buyer demand pooling, seller reverse auctions, warehouse quality control, live delivery tracking, settlements, and platform administration.

## Requirements

- Node.js 20+
- npm 10+
- A Supabase project

## Configure Supabase

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project settings. Do not commit `.env.local`.
3. The database schema is in `supabase/migrations/20260912000100_clusterbuy_schema.sql`.

Apply the schema to the linked cloud project:

```bash
npx supabase db query --project-ref YOUR_PROJECT_REF --file supabase/migrations/20260912000100_clusterbuy_schema.sql
```

The migration creates company/profile, demand/pool/quote, auction, order/lot/shipment/inspection/allocation/settlement, dispute, action-queue, and notification tables. It also adds primary and foreign keys, operational indexes, automatic `updated_at` timestamps, and enables Row Level Security. Public browser access remains locked down until role-specific RLS policies are added.

`lib/supabase/client.js` exposes a configured browser client once the two public environment variables are present. The application continues to use its server API for operational workflows; move those reads and writes to Supabase server-side clients together with the required role policies before removing the existing persistence adapter.

## Gemini material suggestions

Add `GEMINI_API_KEY` to `.env.local` to enable server-side material suggestions in the Buyer demand wizard. The key is never sent to the browser; the app calls its own `/api/ai/material-suggestions` route. `GEMINI_MODEL` is optional and defaults to `gemini-3.6-flash`.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000.

## Verify

```bash
npm run build
MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=your_database_name npm run test:ui
```

The Playwright suite checks all four dashboards and the connected order path, including buyer savings, auction anti-sniping, and map route metrics.
