# What was fixed and changed

## Bugs found
| # | Where | Problem | Fix |
|---|-------|---------|-----|
| 1 | server `app.js` | CORS read `CLIENT_ORIGIN` but `.env.example` defines `CLIENT_URL`; opening the app as `127.0.0.1` (or another port) made every API call fail, so the wardrobe looked empty | Allows the configured origin(s) plus `localhost`/`127.0.0.1`; frontend now uses a same-origin Vite proxy |
| 2 | client `api.js` | API base and image host hard-coded to `http://localhost:5000` | `/api` + `/uploads` proxied by Vite; overridable with `VITE_API_URL` |
| 3 | Studio / Dashboard | Wardrobe fetch errors were swallowed (`.catch(()=>{})`), showing "0 pieces" | Shared `useWardrobe` hook with loading / error / retry states |
| 4 | client `AuthContext` | Any `/auth/me` failure (even a network blip) deleted the token and logged the user out; expired tokens mid-session left pages silently empty | Only a 401 ends the session; global 401 handler; retry screen for network errors |
| 5 | server routes | Async handlers had no error handling; a malformed id (e.g. `PATCH /api/wardrobe/abc`) or DB error could crash the API process | `asyncHandler`, ObjectId validation, safe error middleware |
| 6 | server uploads | Upload folder was `process.cwd()`-relative (broke when started from the repo root); file extension came from the user's file name (an `.html` file with an image MIME type was stored and served as HTML) | Path resolved from the source file; extension derived from MIME type; `nosniff`; orphan files removed on failed validation |
| 7 | server `.env` | `README` told users to copy `server/.env.example`, which did not exist; `.env` was loaded from the working directory | Added `server/.env.example`; `.env` always loaded from `server/` |
| 8 | seed / README | README demo password did not match the seeded password | README corrected |
| 9 | `/outfits/generate` | Only one outfit; AI errors silently fell back to "demo"; AI target was an OpenAI-style Groq default; AI outputs validated only loosely | Multi-outfit engine, Gemini integration, strict validation, honest labels and error codes |
| 10 | Studio | "Not for me/Love it" buttons called the generate endpoint and discarded the result; "Swap" rewrote `ownedItemIds` with fragile logic | Removed along with the manual selection flow |
| 11 | Saved looks | Snapshot trusted whatever the browser sent; deleted items left broken images | Snapshot built server-side from owned items; Saved page shows live items and notes missing pieces |

## Features changed
- Outfit Studio is automatic (no manual selection) and returns 3–5 looks as fashion cards with the original item photos.
- Mannequin component, styles and README sections removed.
- Gemini via the OpenAI-compatible endpoint, with structured JSON output and a plain-JSON retry.
- Local engine: distinct multi-outfit generation, history avoidance, weather/occasion/colour-direction awareness, graceful handling of incomplete wardrobes.
