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

## Scan accuracy and learning
- `src/templates.json` holds 122 labelled piece images from 7 board styles. Tested leave-one-style-out (train on 6 styles, test on the 7th) about 96% of pieces are right
  and the orange rings flag most mistakes. Pieces rendered from standard Chinese fonts were tried as extra training data and did **not** help reliably, so they are not used.
- A small tie-breaker prefers pieces on their starting squares (puzzle positions often keep them there).
- In "Set up position", tapping a piece opens a panel (likely types first); nothing is ever replaced by a stray tap. Changes are only remembered if you press
  **Teach the app** (the panel lists exactly what you changed). Saved corrections live in this browser (localStorage key `xq_user_templates_v2`), pieces read from them get a
  purple dotted ring, and "Forget saved corrections" removes them. Earlier automatic learning (v1) was removed because an accidental edit could be saved as a "correction".
  To improve the built-in memory, send new board images with the correct position.

## Layout
The board scales with the screen (never taller than the viewport): board left / panel right on desktop and landscape, board on top / panel below on portrait tablets and phones.
Cannon and soldier points have the usual corner marks.

## Scan pipeline note
Images are shrunk to 400px wide with an explicit area-average (`boxDownscale` in `src/vision.js`) instead of the browser's own resampling, so a given image gives the same
result on every device. (The browser's default downscale of large images is blurry/aliased and flipped a close horse-vs-cannon call on one test image.)
Memory: 130 labelled pieces from 8 board styles. A fresh scan also clears the previous game's history and last-move marks.

## Memory update (physical-board photo)
`src/templates.json` now has 138 real piece images from 9 board styles plus 39 rendered samples of the black-cannon variant 包 (entries with `p:0.04`: a small score penalty so
rendered samples only win when nothing real matches). On a photo where 包 was never seen, the cannon/horse call is a near tie (0.60 vs 0.57) and can flip with one pixel of detection
noise, so such pieces are ringed orange; tap them to choose the right type, then press "Teach the app" to remember it.

## Cờ úp (hidden pieces / jieqi)
Press **Cờ úp** in the panel. Everything except the two generals starts face-down (drawn as `?`) on the normal starting points, with each side's pieces shuffled.
- A face-down piece moves like the piece that normally starts on that point, then turns over and moves as what it really is. Nobody (you, the engine) knows its identity before that; captured pieces are revealed.
- Variant details I could verify (clubxiangqi.com): Red moves first; face-up advisors are not restricted to the palace and face-up elephants may cross the river; face-down pieces give check with the move of their starting point; flying-general rule as usual.
- Result: checkmate/stalemate loses; draws by 3-fold repetition, 120 plies without a capture, or only generals left; perpetual check loses. **Perpetual chase is not implemented for cờ úp** (it is for normal xiangqi).
- AI (`src/jieqiAI.js`): it only uses public information (which identities are still unrevealed for each side). It deals them randomly over the face-down points several times, searches each deal with the normal engine under the cờ úp movement rules, and plays the move with the best average score. Levels change search depth and number of deals; it is an approximation, not a perfect player. Measured: Medium beat Beginner in 53 of 64 test games (9 losses, 2 draws); Hard and above were only timed, not match-tested.
- Position setup, FEN and photo scan are for normal xiangqi only. Cờ úp games can be undone, reviewed move by move, copied and downloaded (notation: `?b9-c7=N` = a face-down piece moved and turned out to be a Horse, `x` capture, `+` check).
- Tests: `npm test` also runs `src/test.jieqi.js` (rules, engine/rules agreement, AI legality).

## Changes in this version
- Removed the Chinese river words (漢 界 / 楚 河) from the board and the title. The piece characters (車 馬 相 …) are kept so pieces stay recognisable; say if you want them replaced by letters or icons.
