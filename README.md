# Xiangqi Web App (Vite + React)
Play vs engine (4 levels), free position setup, FEN import/export, undo, and photo-to-position scanning.

## Run
    npm install && npm test && npm run dev

## Deploy (Vercel)
Push to Git, import in Vercel, then add `GEMINI_API_KEY` (free: create one at https://aistudio.google.com/apikey, no card needed) and redeploy. Optional: `GEMINI_MODEL` (default `gemini-3.8-flash`; retired/rate-limited models automatically fall back to `gemini-3.5-flash-lite`, then `gemini-3-flash-preview`). If no Gemini key is set, `ANTHROPIC_API_KEY` is used instead (paid). Note: Google may use free-tier content to improve its products, so don't scan private images. `vercel.json` sets COOP/COEP headers; `public/_headers` does the same on Netlify.
Photo scan uses `api/scan.js` (Vercel function). On Netlify, port it to a Netlify Function. Without the key, everything else still works.

## Structure
- `src/xq.js` rules for the UI: legal moves, check/attackers, flying general, FEN, repetition + perpetual-check + draw rules (`outcome`)
- `src/engine.js` the built-in engine (make/unmake, iterative-deepening PVS alpha-beta, transposition table, quiescence, killer/history ordering, repetition-aware)
- `src/engine.worker.js` Web Worker running the engine
- `src/App.jsx` board, edit mode, FEN, scan UI
- `api/scan.js` image -> FEN via Gemini (free) or Claude vision

## Upgrading to Pikafish (strongest AI)
Not bundled (WASM + .nnue must be downloaded from a Pikafish WASM build). Replace `engine.worker.js` with a worker that loads it and speaks UCI:
`position fen <fen>` then `go depth N` (or `go movetime ms`); convert the returned `bestmove` (e.g. `h2e2`) to `[from,to]` indices. Keep the `{id,move}` reply shape.

## Not included yet
Repetition/perpetual-check draw rules, board flipping for Black, ONNX in-browser scanner, PWA.

## Scan is slow / times out
Set `GEMINI_MODEL=gemini-3.5-flash-lite` in Vercel for faster (slightly less accurate) scans. `vercel.json` raises the function limit to 60s.

## Photo/screenshot scan (hybrid)
`src/vision.js` finds the piece circles locally (gradient Hough transform), fits the 9x10 lattice, decides red/black by disc colour and
sends only a small contact sheet of cropped pieces to `/api/scan` (`mode: 'tiles'`) so Gemini just reads each character.
Positions therefore never depend on the model. If detection is not confident (e.g. faint printed scans), it falls back to the full-image scan.
Tested on 6 board styles (flat screenshots, wood, dark, pink); printed/scanned diagrams use the fallback.

## On-device recognition (no network)
`src/vision.js` also recognises the characters locally: each piece is compared with `src/templates.json` (108 labelled piece images from 6 board styles),
then placement rules (general in palace, advisors/elephants on their points, pawn rules) and piece-count limits pick the best reading and also decide
board orientation/alignment. Pieces it is unsure about get an orange ring. Gemini is only used when the local result is not confident.
To teach it a new board style, add labelled tiles to `templates.json` (format: `{c: class letter, s: scale, d: base64 int8 vector}`).

## Engine levels and rules
Levels: Beginner, Easy (shallow + random mistakes), Medium (~0.5s), Hard (~1.5s, about 7 moves deep), Expert (~4s), Master (~10s).
Verified: perft(1..4) = 44 / 1,920 / 79,666 / 3,290,240 and identical move lists to `xq.js` on thousands of random positions.
Rules: check, checkmate/stalemate (loss), flying general, 3-fold repetition = draw, **perpetual check loses** (the side that checks every move of the cycle),
no-capture 60-move draw, no attacking pieces = draw. Not implemented: perpetual *chase* rules (repeated chasing is treated like normal repetition).
The built-in engine is much stronger than a simple depth-limited search but far weaker than Pikafish; see "Upgrading to Pikafish" above.

## Game features
- **Board flip**: "Flip board" button; the board also turns automatically when you choose to play Black.
- **Move history**: coordinate notation (`Ch2-e2`, `x` capture, `+` check, `#` mate). Click any move (or use the arrow keys / buttons) to review that position,
  then "Back to game" or "Play from this position" to branch from it. "Copy moves" / "Download game" export a text record with the start FEN.
- **Perpetual chase (simplified)**: besides perpetual check, repeatedly *chasing* (each move creates a new threat to capture an undefended or higher-value piece)
  loses on the third repetition; generals and pawns never count as chasers and uncrossed pawns are not valid targets. Check outranks chase; equal behaviour = draw.
  This models the usual Asian-rules idea but not every official exception, so treat it as a practical approximation.
- **Offline (PWA)**: a service worker (vite-plugin-pwa) precaches the app, engine, icons and recognition data after the first visit; the app can be installed from the browser menu.
  Playing, review and on-device photo scanning work offline; only the optional AI fallback needs a connection.
