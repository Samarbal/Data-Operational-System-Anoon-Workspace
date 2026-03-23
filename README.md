# Space Noon (Next.js + Google Sheets)

## Setup

1. Install dependencies:
   - `npm install`
2. Copy env template:
   - `cp .env.example .env.local`
3. Fill required variables:
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `SESSION_SECRET` (recommended)
4. Share your Google Sheet with the service account email as `Editor`.

## Run

- Development: `npm run dev`
- Production build: `npm run build && npm run start`

## Deploy (Vercel)

1. Push repo to GitHub/GitLab/Bitbucket.
2. Import project in Vercel.
3. Set env vars in Vercel project settings (same as `.env.example`).
4. Deploy.

## Notes

- Legacy Apps Script business logic is executed server-side through a compatibility runtime.
- Data remains in the same Google Sheet (no schema changes).
- Frontend HTML/CSS/JS is preserved and loaded through Next.js App Router pages.
- `google.script.run` calls are bridged to `fetch` against Next.js API routes.
