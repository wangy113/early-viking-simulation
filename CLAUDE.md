# Gokstad Ship Explorer

A Three.js web app in which online students (Missouri Baptist University, through Canvas) walk around and board a reconstruction of the Gokstad Viking ship, built about 890 and excavated in 1880. The full history, decisions and progress ledger are in `docs/HANDOFF.md`. Read it before large changes.

## Commands
- `npm run dev` starts the dev server.
- `npm run build` builds to `dist/`, which Pages deploys from `main`.
- `npm run lint:style` checks student-facing text against the writing style below.
- `npm run textures:fetch` downloads the CC0 sources named in `scripts/textures.config.json` into `assets-src/` (git ignored). In the cloud container run it with `NODE_USE_ENV_PROXY=1`. `npm run textures:build` writes the web versions to `public/assets/` and `src/assets-manifest.json`.
- `npm run shots -- <dir> stop1 overview deck` saves preview screenshots (set `HIDE_UI=1` to hide the interface, `PORT` to run several at once). Software WebGL is slow, so allow about two minutes per shot.
- Quality levels live in `src/quality.js` (Low, Medium, High). `?quality=low` forces one, the Quality button cycles them and remembers the choice on that device, otherwise the device is guessed. `?debug` shows frame rate, draw calls and triangles.
- `npx playwright test` builds, serves and runs the smoke and deep-link tests. Headless WebGL uses SwiftShader. Keep `--disable-gpu-rasterization` or 2D canvas painting takes minutes.

## Layout
- `src/content/stops.json` holds the stop text an instructor or SME may edit. Camera views and marker anchors are in `src/stops.js`, keyed by stop id.
- `src/ship.js` holds the measured hull (`SHIP`, `makeHullFns`). Units are meters. The bow faces -z toward the sea, the shoreline is at z = -16, and starboard is +x.
- Each milestone is a PR from the working branch into `main`, with screenshots for the user before merge.

## Visual direction
- Changed on 2026-10-08 by the user: the look is **near-realistic** (PBR materials, CC0 photo-scanned textures from Poly Haven and ambientCG, HDRI lighting, sun shadows, an ocean shader). It replaces the earlier watercolour style.
- People and animals are 3D figures built in code (`src/people.js`). They are illustrations, not portraits, with simple faces.
- Clothing, hair and colours follow `docs/people-research.md`, which grades each choice as found, other evidence or reconstruction. Update it with a source before changing how people look.
- Every texture or HDRI that ships must be CC0 and listed in `public/assets/CREDITS.md` with its source URL.

## Rules
- Use Three.js directly. Do not use HyperFrames, which is a video tool.
- Every stop carries evidence tags: `found` (Found with this ship), `other` (Known from other finds), `recon` (Reconstruction). Never present a reconstruction as a find.
- Only state verified facts (see handoff section 2). Do not add, without a source: how strakes were fastened to frames, a dragon head on the stems, a gangplank, a cauldron, exact keel length, draft.
- Shields hang on the aft half only. This is a deliberate teaching choice.
- Writing style for all on-screen and document text: no em dashes, no semicolons, no middle dots, no "not X, it is Y" constructions. Plain, short sentences.
- Accessibility is required. Every stop's content also appears in the Text version. All controls are visible buttons, and keys may duplicate them but never replace them. Focus stays visible. `prefers-reduced-motion` turns camera flights into jumps.
- No student data: no login, analytics, cookies, tracking or third-party requests. Fonts and libraries are bundled.
- Never repaint or regenerate textures per frame.
- Show the user a preview at each milestone before moving on.
