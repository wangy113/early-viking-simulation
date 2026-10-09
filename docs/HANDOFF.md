# HANDOFF: Gokstad Ship Explorer (3D Viking ship for online students)

> Purpose: let a cold agent (no memory of prior sessions) take this proof of concept to a real production environment from this file alone.
> Last updated: 2026-10-08 (production repo set up, visual direction changed to near-realistic)

## 1. Task & goal

Build a historically grounded, interactive 3D web experience in which online university students (Missouri Baptist University, delivered through Canvas) walk around and board a reconstruction of the **Gokstad Viking ship** (built about 890, excavated 1880, Sandefjord, Norway). The scene must feel alive. Students should see people at work and artifacts to discover, not an empty boat. That was an explicit requirement from the user. Students visit numbered stops, and each stop is tagged to separate evidence from imagination.

**Done means:**
- It is hosted on GitHub Pages and embedded in a Canvas page.
- It runs smoothly on student hardware, including Chromebooks and phones.
- It meets WCAG 2.1 AA and QM Standard 8.
- The history has been checked by a subject expert.
- A course objective and a Canvas activity (discussion or quiz) are attached.

A working single-file proof of concept exists. The production job is to harden it, not to restart.

## 2. Conventions & rules

- **This is a web app, not a video.** Use Three.js directly. Do **not** use HyperFrames. It is an HTML-to-MP4 video tool, and the user and I settled this.
- **Visual style: near-realistic (changed by the user on 2026-10-08).** The user shared a game-engine reference render and asked for depth and an almost realistic look. The watercolour `Painter` style is being replaced by PBR materials with CC0 photo-scanned textures (Poly Haven, ambientCG), HDRI lighting, sun shadows and an ocean shader. People and animals become 3D figures built in code, with simple faces. The proof of concept stays in the first commit on `main`.
- **Every stop carries evidence tags:** `Found with this ship` (from the Gokstad mound), `Known from other finds` (other Viking Age evidence) and `Reconstruction` (informed guess). Never present a reconstruction as a find.
- **Only state verified facts.** These claims were checked against sources and are safe:
  - length about 23.3 m (sources range 23.2 to 23.8) and beam about 5.2 m
  - 16 strakes a side, clinker built with iron rivets
  - 16 oar ports a side (32 oars), cut in the third strake from the top
  - 32 shields a side, alternately yellow and black, overlapping on the rail
  - a side rudder on the starboard quarter
  - tree rings show it was built about 890
  - excavated 1880 by Nicolay Nicolaysen
  - grave goods: a gaming board with horn pieces, kitchen equipment, a tent, a sledge, beds, three small boats, 12 horses, dogs and birds including peafowl and hawks
  - the mound was robbed in antiquity
  - the 1893 replica *Viking* sailed from Bergen and crossed the Atlantic in 27 days on its way to Chicago
  - the sail: the 1880s report describes white wool cloth with red stripes sewn on, possibly from the sail
- **Deliberately left out as unverified. Do not add them without a source:**
  - how the strakes were fastened to the frames (lashings or treenails)
  - a dragon head on the Gokstad stems
  - a gangplank
  - a cauldron
  - exact keel length
  - draft
- **People are illustrations, not portraits.** The About page says so. Clothing follows general Viking Age evidence: tunic, trousers with leg wraps, and an apron dress with paired oval brooches for women.
- **Writing style for all on-screen and document text (user's standing rule):** no em dashes, no semicolons, no middle-dot separators, no "not X, it is Y" constructions. Plain, short sentences. The current page text follows this, so keep it that way.
- **Accessibility is not optional:**
  - Every stop's content also appears in the Text version modal.
  - All controls are visible buttons. The user dislikes hidden single-key shortcuts, so keys may duplicate buttons but never replace them.
  - Keyboard focus is visible.
  - `prefers-reduced-motion` turns camera flights into jumps.
- **Performance rule learned the hard way:** never repaint watercolour textures per frame. Paint once (now at load, in production as baked PNGs) and swap atlas frames. A per-frame repaint ran at 6 fps in the earlier tabernacle test.
- **No student data.** It's a static site with no login, analytics, cookies or tracking. Grading happens in Canvas, not in the page.
- **Approval gates.** Show the user a preview at each milestone before moving on. The user works with audit-before-change and approval gates.

## 3. Key files & paths

- **Proof of concept (the whole app, one file, about 990 lines):** `C:\Users\WangJ\Downloads\viking-ship-explorer\index.html`
- **This handoff:** `C:\Users\WangJ\Downloads\viking-ship-explorer\HANDOFF.md`
- **Earlier related test** (same painter, a video version, for reference only): `C:\Users\WangJ\Downloads\tabernacle-3d-test\index.html`
- **User's Learning Studio skill** (pedagogy and design pass for teaching sites): `C:\Users\WangJ\.claude\skills\learning-studio\`
- **MBU Canvas CLI and gotchas:** see the memory note `mbu-canvas-cli.md` in `C:\Users\WangJ\.claude\projects\C--Users-WangJ\memory\`
- **Headless Chrome used for screenshots:** `C:\Users\WangJ\.cache\hyperframes\chrome\chrome-headless-shell\win64-152.0.7977.30\chrome-headless-shell-win64\chrome-headless-shell.exe`
- **Production repo:** https://github.com/wangy113/early-viking-simulation (public). Live site: https://wangy113.github.io/early-viking-simulation/
- **Repo layout and commands:** see `CLAUDE.md` at the repo root. Stop text is in `src/content/stops.json`.

### Map of `index.html` (line numbers as of 2026-10-08)

| Lines | Section |
|---|---|
| 1 to 160 | HTML, CSS (paper palette tokens on `:root`), top bar, move pad, stop panel, intro, Text version and About modals |
| 168 | `Painter`: seeded watercolour washes, pencil lines, `solid` underpainting for opaque figures |
| 229 | `C` palette (oak, iron, wool colours, shield yellow and black, sail) |
| 236 to 306 | `figure()`: a side-view Norse figure in cubit units (feet at origin, up is negative) with legs, wraps, tunic or apron dress, head, hair, beard, cap or scarf. Also `pose()` and `walkPose()` (planted-foot walk cycle) |
| 307 | `outfits` per character |
| 335 | `ACTORS`: 11 pose sheets (`wright`, `caulk`, `oars`, `shield`, `steer`, `rope`, `chest`, `game`, `cook`, `horse`, `dog`). Each has width and height in cubits, N poses and a loop period |
| 473 | `Actor`: paints all poses into one atlas at load, then swaps `texture.offset` per frame. Billboards toward the camera and mirrors toward its `face` target |
| 524 | `SHIP` dimensions and `makeHullFns()`: hull surface `pt(u, s, side)`, normals, deck height. `u` runs along the length (-1 is the bow, at negative z), `s` runs from the keel (0) to the gunwale (1) |
| 556 | `buildHull()`: 16 clinker strake meshes a side, keel and stem tubes. Reused for the small boat |
| about 590 to 690 | frames, deck, rail, oar ports, shields (aft half only, by design), rudder, mast fish, mast, crutches, stowed oars, yard rig and sail with a raise animation, sea chests |
| 692 | small boat |
| 698 to 760 | ground, grass, rollers, sea, foam, sky dome, fjord mountains, tent, smoke, gulls |
| 762 | cast placement (`addActor`) |
| 784 | `STOPS`: the 12 stops (id, title, tags, anchor, camera view, HTML body, notice prompt) |
| 811 to 930 | camera state, flights, markers (projected and hidden when behind the ship), panel, buttons, modals, drag-look, click-to-walk, keys, move pad, board or ashore constraints, resize, paper overlay |
| 936 | `frame()` loop |
| 980 | deep links: `#stop=N`, `#sail`, `#deck` |

Units are meters, with figure cards drawn in cubits (`CUB = 0.46`). The bow faces -z toward the sea, the shoreline is at z = -16, and starboard is +x.

## 4. Progress ledger

Status key: ✅ done, ⏳ in progress, ⬜ not started, ⚠️ needs review

| Unit | Description | Status | Notes |
|------|-------------|--------|-------|
| PoC scene | Ship, beach, camp, sea, mountains, sky in the watercolour style | ✅ done | verified by headless screenshots of stops 1, 2, 3, 5, 6, 7, 9, the deck and the intro |
| PoC cast | 11 animated figures with contact actions (hammer on hull, tool in seam, oar on shoulders, shield to rail, hand on tiller, rope, chest heave, game move, stirring pot, grazing horse, trotting dog) | ✅ done | flat billboards that mirror toward their task, so they look the same from every angle |
| PoC stops | 12 tagged stops with notice prompts, Text version, About and sources | ✅ done | ⚠️ content needs SME review |
| PoC controls | drag-look, click-to-walk, arrow pad, keys, Board or Step ashore, Bird's-eye view, Guide me, Raise the sail, deep links | ✅ done | not tested on touch devices |
| History check | SME and primary-source review of all 12 stops and the About page | ⚠️ needs review | key facts web-checked on 2026-10-08, see section 2 |
| Repo + hosting | GitHub repo, Pages, custom path | ⏳ in progress | PoC on `main`. The user must set Settings, Pages, Source to GitHub Actions |
| Code split | split the single file into modules, pin Three.js locally | ✅ done | Vite, three 0.181.2 and fonts bundled, stops.json, style lint, Playwright tests, CI. Scene pixel-matches the PoC |
| Baked textures | paint textures and atlases once to PNG/WebP and load them | dropped | replaced by CC0 photo-scanned PBR textures (realistic direction) |
| Realistic look test | ship, beach, sea, sky with PBR, HDRI, shadows, Water | ✅ done | approved by the user. M3 finished the whole scene, also approved |
| 3D people | code-built jointed figures with the 11 task loops | ⏳ in progress | `src/people.js`. Poses reuse the PoC pose math. Painted billboards and the painter are removed |
| Performance | profile, merge geometry, cap DPR, target 30+ fps on a Chromebook and 60 on a laptop | ⏳ in progress | Quality tiers, merged meshes, automatic resolution scaling and off-screen pause done. Needs a real Chromebook measurement with `?debug` |
| Mobile/touch | tap-to-walk, pinch, layout of the top bar and panel on phones | ⬜ not started | the top bar wraps on narrow screens and needs a menu |
| Accessibility audit | WCAG 2.1 AA and QM 8: keyboard path to every stop, focus trap in modals, screen-reader test with NVDA, contrast, captions if audio is added | ⬜ not started | the Text version exists, but focus trapping is not implemented |
| Canvas integration | iframe embed in a sandbox course, full-screen link, `#stop=N` links from module pages | ⬜ not started | |
| Pedagogy | course objective, pre and post activity, discussion or quiz in Canvas | ⬜ not started | ask the user which course (possibly HIS 1510) |
| Cross-browser QA | Chrome, Edge, Firefox, Safari (iOS) | ⬜ not started | |

## 5. Done this session (2026-10-08)

- Built `index.html` from scratch as a single static page: Three.js 0.181.2 from jsDelivr through an import map, and Google Fonts Spectral and Source Sans 3.
- Procedural Gokstad hull: 16 clinker strakes a side with overlap offset, keel, curved stems, 17 frames, deck, rail, 32 oar ports, 32 shields per side placed on the aft half only, starboard rudder, mast fish, mast, three crutches, stowed oars, a yard that swings from fore-and-aft (lowered) to athwartships (raised), and a striped sail.
- Eleven animated characters, painted into texture atlases at load, plus smoke, gulls, a moving sea and foam.
- Twelve stops, each with evidence tags, an explanation and a Notice question. There's also a Text version modal, an About page with sources, and an intro explaining the tags and controls.
- Fixed during self-review:
  - Figures had their heads inside the flared hull, so I moved them out.
  - The shields hid every oar port, so I now hang them on the aft half only and the stop text uses this as a teaching moment.
  - The yard pointed the wrong way when lowered.
  - Markers cluttered the view, so occluded ones are now hidden.
  - The `#sail` deep link was being cleared by `history.replaceState`.
  - The rudder looked like a post stuck in the sand.

## 6. Next steps

1. **Set up the repo.** Create a GitHub repository (suggested name `gokstad-ship-explorer`). Commit `index.html` as is, enable GitHub Pages, and confirm it loads over HTTPS. This gives the user a shareable URL right away.
2. **Get the user's decisions** on the open questions in section 7, especially which course and objective, before any content changes.
3. **Restructure for production without changing the look:**
   - Use Vite with plain JS modules: `painter.js`, `figures.js`, `actors.js`, `ship.js`, `world.js`, `stops.js` (content as data, ideally `stops.json` so an instructor or SME can edit text without touching code), `controls.js` and `ui.js`.
   - Vendor Three.js locally so the app does not depend on a CDN at class time.
   - Use the GitHub Actions Pages deploy.
4. **Bake textures.** Add a Node or Playwright script that runs the painter once and writes PNG/WebP atlases to `assets/`. Load those at runtime and keep the painter as the build tool. Check that the baked output matches the current screenshots.
5. **Performance pass:**
   - Merge static geometry: the strakes per side, the shields, and the oar ports into an `InstancedMesh`.
   - Cap the pixel ratio at 1.5.
   - Replace the per-frame raycast for each of the 12 markers with a cheaper check (raycast every few frames, or only against the hull).
   - Measure on a low-end Chromebook.
6. **Accessibility and mobile:**
   - Trap focus in modals and return focus to the triggering button.
   - Move focus to the stop panel heading. It needs `tabindex="-1"`, because `focus()` on an `h2` currently does nothing.
   - Collapse the top bar into a menu on phones.
   - Add touch tap-to-walk and check that drag-look works.
   - Test with NVDA and keyboard only.
7. **Content and history:**
   - Send the 12 stop texts and the About page to the user or a subject expert for review.
   - Consider replacing Wikipedia citations with the Museum of Cultural History (University of Oslo) publications and Nicolaysen 1882.
   - Decide whether to add the burial chamber (it stood aft of the mast) as a stop. This would need sensitive wording and a source.
8. **Canvas:** embed in a sandbox course with an iframe at 100% width and about 640 px high, plus an "Open full screen" link. Then link individual stops from module pages with `#stop=N`. Check that Canvas does not strip the iframe or the `allow="fullscreen"` attribute.

## 7. Open questions & decisions

**Awaiting the user:**
- Which course and module is this for? For now the Canvas piece is a general exploration activity with no course attached.
- How long should a visit take (a short activity or a 30-minute lab)?
- Narration audio: not now, may be added later. If added, captions are required.
- Should the figures get richer animation (more poses, front and back views), or is the flat paper-theatre cutout look acceptable?

**Decided (do not relitigate):**
- Three.js web app, not HyperFrames, not video.
- The audience is online students, not the user's YouTube channel. The user said so explicitly.
- Near-realistic style (changed from storybook watercolour by the user on 2026-10-08).
- A living scene with people and artifacts, not an empty boat.
- The ship is the Gokstad ship specifically.
- Evidence tags on every stop.
- Shields hang on the aft half only, which is a deliberate teaching choice.

## 8. Gotchas & warnings

- **Never repaint textures per frame.** The earlier tabernacle test drew figures on demand and ran at about 6 fps (167 ms per frame). The current atlas approach fixed this.
- **Transparent ground decals draw over figure cards** when the cards have `depthWrite: false`. Give decals `renderOrder = -1`. Figure cards use `alphaTest` to avoid this.
- **Figure cards need the `solid` paper underpainting** (`P.solid = true`), or the watercolour washes are see-through and the hull shows through people.
- **The hull flares out above head height.** Place figures from the hull point at the height of their hands or heads, not their feet, or their heads end up inside the planks. See `hullOut(u, s, side, d)` with `s` around 0.36 to 0.46.
- **Billboards are flat.** A character whose task is on one side mirrors using its `face` target. Two-person cards, such as the chest handover with one man on deck, look offset when viewed end-on from bow or stern.
- **`history.replaceState` in `goToStop()` rewrites the hash.** Read any other hash flags (`#sail`, `#deck`) before calling it.
- **The texture atlas width is capped at 8192 px.** `Actor` wraps poses into rows automatically. Keep card width times `k` reasonable.
- **Headless screenshots:** run `python -m http.server 8765` in the folder, then `chrome-headless-shell.exe --headless --use-angle=d3d11 --window-size=1600,900 --virtual-time-budget=9000 --screenshot=<path> "http://localhost:8765/#stop=N"`. The `#stop=N` deep link skips the intro modal.
- **Verify any new historical claim** with a source before adding it. Search results conflicted on a few points, such as shield counts (32 on the hull per side against 64 in the grave overall) and construction dates, so check rather than assume.
- **This machine has low RAM** (about 2 GB free of 15 GB). Keep build tooling light.

## 9. Session log

## 2026-10-08: Proof of concept built and self-reviewed
- The user explored Three.js and first asked about HyperFrames. We decided a plain Three.js web app is right for an interactive student experience.
- The user chose the ship idea from a list of Viking ideas, then clarified that it must be alive like the tabernacle test, with people working and artifacts.
- Built `index.html` with 11 animated figures and 12 evidence-tagged stops. Did two rounds of screenshot review and fixes, verified key facts by web search, and wrote this handoff for a production build in a real environment.

## 2026-10-08: Production repo, scaffold and new visual direction
- Repo: `wangy113/early-viking-simulation`. The PoC was committed unchanged as the first commit on `main`, with a Pages workflow.
- Decisions: keep the 12 stops, no audio for now, no course yet (general exploration activity), realistic look replaces watercolour, people are code-built 3D figures, textures are CC0 photo scans.
- M1 scaffold: Vite, modules under `src/`, bundled Three.js and fonts (no third-party requests), `stops.json`, style lint, Playwright tests and CI. The 3D scene pixel-matched the PoC.
- Headless screenshots in the cloud container need `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader --disable-gpu-rasterization`. Without the last flag the painter takes minutes and the page looks hung.

## 2026-10-08: Realistic scene and 3D people
- The user approved the realistic look test and the full 12-stop scene.
- M4: people and animals are jointed 3D figures in `src/people.js` (rigid segments aimed joint to joint, wool, linen and leather materials). They reuse the proof of concept's `pose()` and `walkPose()` data, so the 11 task loops behave the same. The painted billboards, `painter.js`, `figures.js` and `actors.js` are gone.
- `#cam=x,y,z,lookX,lookY,lookZ` places the camera for preview screenshots.

## 2026-10-08: M5 performance and quality levels
- `src/quality.js` picks Low, Medium or High from the device (phones, weak GPUs, 4 GB or less memory and 4 or fewer cores get Low). A visible Quality button cycles the levels.
- Low: 1K textures, a cheap glossy sea with no reflection pass, 1024 shadow map, lighter terrain, pixel ratio 1. Medium: 1K textures, reflecting sea at 512, 2048 shadows. High: 2K textures, reflecting sea at 1024.
- Each person's head and clothing details are merged by material, body parts sharing a material are one skinned mesh, and the shields are three meshes.
- Measured in headless Chromium (1280x720): download 29.4 MB on High and 9.3 MB on Low and Medium. Draw calls 480 to 840 on High and 250 to 440 on Low, down from 690 to 1390. Software rendering cannot give real frame rates, so the Chromebook test is still needed.

## 2026-10-09: Realistic people
- The user asked to make the humans real first. Free Daz models were ruled out by their licence (no web or interactive use). The people are now MakeHuman bodies, which are CC0.
- `scripts/build-people.mjs` runs Blender 4.2 with MPFB headless for each body in `scripts/humans/figures.json`, then compresses the result with meshopt. The output is in `public/assets/people/` (about 2.3 MB of bodies and 2.5 MB of textures). Setup steps are in `scripts/humans/README.md`.
- The Viking clothing is built in `scripts/humans/make_human.py` from each body's surface: shells for the tunic, trousers, leg wraps, shoes, cap, underdress, straps and shawl, and fitted flared rings for skirts, the apron dress and the cloak. Body faces under the clothing are removed. Anchor nodes on the bones carry the brooches, beads, buckle, knife and cloak pin.
- `src/humans.js` loads the bodies, assigns materials (MakeHuman skin and hair, Poly Haven wool, twill, linen and leather) and poses them from the same `pose()` data. The spine bends toward the shoulder point, arms and legs use two-bone reach with the proof of concept's elbows and knees as hints, feet stay flat, and the fingers close into a grip.
- Fixed a bug from M5: a comment had swallowed the terrain rotation, so the beach was missing on the live site.
- Fixed after the user's review: the shipwright's head and hammer hand and one chest lifter's hand reached through the planks. They stand further out now, and `tests/hull-check.js` (run by the smoke tests and `scripts/humans/collide.mjs`) fails if any body part crosses the hull. Hands now go exactly to the proof of concept's hand points, where the tools are placed, with the middle of the fist on that point.
- Walking ashore now follows the ground height, so the camera no longer sinks under the rising land near the woods. Walking stops short of the woods.

## 2026-10-09: M6 accessibility and mobile
- The horse and dog wait for the user to add a `SKETCHFAB_TOKEN`. Chosen models, both CC-BY: "Horse Rigged (Game Ready)" by abhayexe and "Animated Dog, Shiba Inu" by quander.
- Dialogs are native `<dialog>` elements with focus return. A stop's title takes focus when it opens.
- New buttons: All stops (a list of every stop) and Pause motion (starts paused under reduced motion).
- Phones: the tools fold into a Menu, the stop panel is a bottom sheet, touch targets are 44 pixels, and two fingers pinch to walk.
- `tests/a11y.spec.js`: axe-core WCAG 2.1 AA scans, a keyboard-only path, Pause motion, and a 320 pixel reflow and touch-target check. `docs/accessibility.md` has the manual checklist for NVDA, VoiceOver, zoom and high contrast.
- The About page has an accessibility statement.

## 2026-10-09: M7 review packet and exploration activity
- The user will share the app with students as a plain link, so no iframe embed is needed.
- `docs/sme-review.md`: every claim in the stops and the About page with its tag, status (verified or check), sources, things the scene shows without saying, and questions for a subject expert.
- `docs/exploration-activity.md`: "Evidence or imagination?", with an objective, before, during and after tasks, a discussion prompt and five quiz questions with answers.
- `docs/canvas-link.md`: the link, suggested link text and the deep links.

## 2026-10-09: Real trees and people touch-ups
- The woods use Poly Haven's Pine Tree 01, Fern 02 and Pine Sapling Small (CC0). `scripts/trees/render_impostors.py` renders three pines, two ferns and two young pines from 8 directions under the scene's sky in Blender, and `scripts/build-trees.mjs` packs them into atlases in `public/assets/trees/` (0.6 MB on Low, 1.9 MB otherwise). Firs were removed on 2026-10-09 because fir never grew wild in Norway. In `src/world.js` each tree is one card that turns to the camera and blends the two nearest renders, so 1,800 trees cost two triangles each.
- People: tunic skirts blend widely across the middle, so they hang over the lap when seated. The cook's linen skirt is now built only below the apron dress and shares its weighting, so it never pokes through. Her shawl is thinner, the steersman's cloak covers his tunic, and wool and linen are matt.

### 2026-10-09: accuracy pass, undergrowth, cook's dress
- A history check against Nicolaysen 1882 and pollen and charcoal studies led to these changes. The firs are gone, because fir never grew wild in Norway and spruce was rare or absent near Gokstad around 900. The carried oar is now 5.3 m, like the one complete Gokstad oar. The crewman's shield is 94 cm across. The gaming board has a 13 by 13 grid with pieces set out for tafl. The tent's crossed boards end in heads painted yellow and black, and the tiller is painted the same way (p. 63). The small boat has a side rudder (p. 65). The dog is a smaller, greyish-brown spitz type. Stop 11 now says peafowl and hawks.
- Undergrowth: ferns and young pines grow in patches around the trees, as two more impostor atlases.
- The cook's apron dress is fitted at the top, eases in below the bust and flares to the hem. Woad blues are deeper.
- For the horse and dog models: do not use a named breed. The dog should be a northern spitz type about 45 cm at the shoulder, greyish-brown. The horse should be about 1.3 to 1.45 m, stocky. Not a dun Fjord horse.
- Still open: broadleaf trees (oak, birch, alder, hazel) and juniper have no free model yet. Nicolaysen records a pine landing stage, which is a source for a gangplank. It stays out until the user decides.
- 2026-10-09, user decision: the remaining accuracy items are closed for this project. The woods stay pine only, the gangplank stays out, and the do-not-add list is unchanged.
