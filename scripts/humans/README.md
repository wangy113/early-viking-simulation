# Building the people

The people in the scene are MakeHuman bodies. They are built offline in Blender with the MPFB extension, then compressed for the web. The built files are committed in `public/assets/people/`, so you only need this to change how the people look.

## What is used, and the licences

Everything here is CC0, so no attribution is required. We still credit it in `public/assets/CREDITS.md`.

- Blender 4.2 LTS, from https://download.blender.org/release/Blender4.2/ (the tool only, nothing from it ships).
- MPFB 2.0.17, the MakeHuman plugin for Blender, from https://extensions.blender.org/add-ons/mpfb/ (the tool only).
- MakeHuman system assets, CC0: bodies, skins, eyes, eyebrows, eyelashes and hair. https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- The CC0 beard pack `bodyparts05` (Viking beard and moustache by RehmanPolanski, scruffy beard by WDG, Sigmund beard by grinsegold). https://static.makehumancommunity.org/assets/assetpacks/bodyparts05.html
- The Viking clothing is not from any pack. `make_human.py` builds it from each body's own surface.

Do not add packs marked CC-BY without adding the credit, and never add packs with other licences.

## Steps

1. Download and unpack Blender 4.2 for Linux, for example to `/opt/tools/blender-4.2.23-linux-x64/`.
2. Install MPFB: `blender --background --command extension install-file -r user_default -e add-on-mpfb-v2.0.17.zip`.
3. Unzip `makehuman_system_assets_cc0.zip` and `bodyparts05_cc0.zip` into MPFB's data folder, `~/.config/blender/4.2/extensions/.user/user_default/mpfb/data/`.
4. Run `BLENDER=/path/to/blender node scripts/build-people.mjs`. Add body names to rebuild only some, for example `m_steer`.

`scripts/humans/figures.json` lists the bodies: build, age, hair, beard and garments. Colours are set in `src/people.js`, so one body can wear several outfits.

## Checking the result

`npm run build`, then `node scripts/humans/closeups.mjs shots/people` saves a close-up of every person in the scene.
