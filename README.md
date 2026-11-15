# TrendCraft AI 👗 — Your Personal AI Fashion Stylist

A full-stack MERN app (React + Vite, Express, MongoDB, JWT auth). Upload your own clothes, then press **Generate outfits**: the app automatically picks matching pieces from *your* wardrobe, using Google Gemini when configured and a built-in rule-based engine otherwise. Each suggestion is shown as a fashion card made of **your original clothing photos**. There is no mannequin, avatar or dummy model.

## How outfit generation works
1. You choose an occasion, style mood, weather and colour direction. You do **not** pick clothes.
2. The server loads the signed-in user's wardrobe from MongoDB and sends item ids, names, categories, colours, styles and notes to Gemini.
3. Every id Gemini returns is validated against that user's own wardrobe. Invented, foreign, duplicate or structurally invalid outfits (for example a dress plus a top) are discarded.
4. If Gemini is not configured or fails, the local engine builds the looks instead. Every card is labelled **AI stylist · Gemini** or **Local styling engine**, and a notice explains why the AI was not used.
5. Scores are shown as *estimated* match values, not objective measurements.

## Requirements
- Node.js 20 LTS or newer
- MongoDB Community Server (local) **or** a MongoDB Atlas connection string
- VS Code (recommended)

## Setup on Windows (VS Code)
1. Extract the ZIP, then in VS Code choose **File → Open Folder…** and open the `trendcraft-ai` folder. Open a terminal with **Terminal → New Terminal** (PowerShell).
2. Create the server settings file:
   ```powershell
   Copy-Item server\.env.example server\.env
   ```
3. Open `server\.env` and set:
   - `MONGODB_URI`: leave the default for local MongoDB, or paste your Atlas string.
   - `JWT_SECRET`: replace with a long random string (24+ characters).
   - `AI_API_KEY`: see "Gemini API key" below (optional).
4. Install everything (root, client and server):
   ```powershell
   npm run setup
   ```
5. Make sure MongoDB is running (for local installs, the **MongoDB Server** Windows service should be *Running*; with Atlas, allow your IP in Network Access).
6. Optional demo data:
   ```powershell
   npm run seed
   ```
   Demo login: `demo@trendcraft.local` / `StyleDemo123!` (local demos only).
7. Start both servers:
   ```powershell
   npm run dev
   ```
   - App: http://localhost:5173
   - API health check: http://localhost:5000/api/health (shows whether AI is configured)

## Gemini API key
1. Create a key in Google AI Studio: https://aistudio.google.com/apikey
2. Put it in `server\.env` (never in client code, never in Git):
   ```env
   AI_API_KEY=your_key_here
   AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
   AI_MODEL=gemini-3.8-flash
   ```
   `GEMINI_API_KEY` is also accepted if you prefer the Google-specific variable name. If both are present, `AI_API_KEY` is used.
3. Restart `npm run dev`. The server prints `✓ AI styling enabled (model: …)` when a key is present.

The backend calls Gemini's OpenAI-compatible `chat/completions` endpoint with structured JSON output. If your Google project does not offer the configured model, you will see "The AI model or endpoint was not found" in the Outfit Studio; set `AI_MODEL` to a current model listed at https://ai.google.dev/gemini-api/docs/models and restart. The request is made once per click, times out after 45 seconds, and the local engine is used if anything fails.

Image understanding is not used: the stylist works from the name, category, colour, style and notes you enter for each piece.

## Using the app
- **My wardrobe**: add, edit, delete, search and filter pieces; photos are stored in `server/uploads/`.
- **Outfit studio**: pick occasion/mood, choose 3–5 looks, press **Generate outfits**, **Save this look**, or **Regenerate** for fresh combinations (previous looks are avoided while the page stays open).
- **Saved looks**: your saved outfits, shown with the current wardrobe photos.

## Test checklist
Run `npm test` first (service tests, no database needed). Then, with MongoDB and the app running:
1. Sign up (or log in as the demo user). **My wardrobe** shows your saved pieces; reload the page and log out/in: they are still there.
2. Add a piece with a photo: the photo appears in the grid. Edit and delete it.
3. Create a second account: its wardrobe is empty and none of the first account's pieces appear.
4. **Outfit studio** with an empty wardrobe shows the "wardrobe is empty" message; with only tops it explains that a bottom or dress is needed.
5. With 2+ tops and 2+ bottoms (or a dress), **Generate outfits** returns up to the number you chose, each showing your own photos and no mannequin.
6. Leave `AI_API_KEY` empty: cards say **Local styling engine** and a notice explains why. Set a valid key: cards say **AI stylist · Gemini**. Use a wrong key: you get a clear "API key rejected" notice and local results, never AI labels.
7. Press **Generate outfits** repeatedly very fast: only one request is sent.
8. Save a look, open **Saved looks**, delete one. Saving the same look twice does not create a duplicate.

## Troubleshooting
- **`MONGODB_URI is missing` / `JWT_SECRET must be set`**: create `server\.env` from `server\.env.example`.
- **Connection refused on 27017**: start the MongoDB service or use Atlas.
- **"Cannot reach the TrendCraft server"**: the API is not running or crashed; check the terminal for errors. If you changed `PORT`, add `VITE_API_PROXY=http://localhost:<port>` to `client\.env`.
- **Wardrobe empty after logging in**: pieces belong to the account that created them. The seeded demo pieces belong to `demo@trendcraft.local`.
- **Images not loading**: images are requested from `/uploads/…` through the Vite proxy; make sure the API is running. Pieces without a photo show a coloured placeholder.
- **Image upload rejected**: use JPG, PNG, WEBP or GIF under 5 MB.
- **Port already in use**: change `PORT` in `server\.env` (and `VITE_API_PROXY` as above), or `server.port` in `client/vite.config.js`.

## Reset demo data
Stop the server, then in `mongosh`:
```javascript
use trendcraft_ai
db.users.deleteOne({ email: "demo@trendcraft.local" })
db.wardrobeitems.deleteMany({})   // only on a local database containing no real data
db.savedoutfits.deleteMany({})
```
Then run `npm run seed` again. **Do not run destructive commands against a database containing real user data.**

## Project map
```text
trendcraft-ai/
  client/                 React + Vite + Tailwind frontend
    src/components/       Shell, Protected route, ItemImage, OutfitCard (fashion-card layout)
    src/hooks/            useWardrobe (loading / error / ready states)
    src/pages/            Landing, auth, dashboard, wardrobe, studio, saved, profile
    src/context/          Authentication state
    src/services/         Axios API client (reads /api through the Vite proxy)
  server/
    src/config/           env loading, MongoDB connection, upload path
    src/models/           User, wardrobe item, saved outfit
    src/middleware/       JWT auth
    src/routes/           Auth, wardrobe, outfit endpoints
    src/services/         Local styling engine + Gemini stylist + validation (styling.js)
    src/seed.js           Demo account and wardrobe seed
```

## Security notes
- Passwords are hashed with bcrypt; every wardrobe and saved-outfit query is filtered by the authenticated user's id.
- The Gemini key and JWT secret exist only in `server/.env`. Logs never print them.
- Uploads are limited to 5 MB and image MIME types; stored file extensions come from the verified MIME type and `/uploads` is served with `nosniff`.
- This is a local portfolio/demo project, not a production-hardened service. Add rate limiting, account verification/password reset, structured logging and cloud object storage before any public deployment.

## Code formatting
`npm run format` / `npm run format:check` use the included Prettier config.
