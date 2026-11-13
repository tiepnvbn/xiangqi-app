# Xiangqi Web App (Vite + React)
Play vs engine (4 levels), free position setup, FEN import/export, undo, and photo-to-position scanning.

## Run
    npm install && npm test && npm run dev

## Deploy (Vercel)
Push to Git, import in Vercel, then add `GEMINI_API_KEY` (free: create one at https://aistudio.google.com/apikey, no card needed) and redeploy. Optional: `GEMINI_MODEL` (default `gemini-3.8-flash`; retired/rate-limited models automatically fall back to `gemini-3.5-flash-lite`, then `gemini-3-flash-preview`). If no Gemini key is set, `ANTHROPIC_API_KEY` is used instead (paid). Note: Google may use free-tier content to improve its products, so don't scan private images. `vercel.json` sets COOP/COEP headers; `public/_headers` does the same on Netlify.
Photo scan uses `api/scan.js` (Vercel function). On Netlify, port it to a Netlify Function. Without the key, everything else still works.

## Structure
- `src/xq.js` rules (legal moves, check, flying general, mate = no legal moves), FEN, alpha-beta search
- `src/engine.worker.js` Web Worker running the built-in engine
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
