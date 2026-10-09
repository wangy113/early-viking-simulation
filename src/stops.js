import content from "./content/stops.json";
import { H, rudderPivot, mastZ, deck0 } from "./ship.js";
import { v3, cast } from "./cast.js";

// Where each stop's marker sits and where the camera goes. The text lives in content/stops.json.
const VIEWS = {
  hull: { anchor: () => H.pt(0.08, 0.55, 1).add(v3(0.3, 0.2, 0)), view: { pos: v3(6.2, 1.65, 3.2), look: () => H.pt(0.08, 0.4, 1) } },
  caulk: { anchor: () => cast.caulk.mesh.position.clone().add(v3(0, 1.4, 0)), view: { pos: v3(-6.2, 1.5, -6.8), look: () => cast.caulk.mesh.position.clone().add(v3(0, 0.6, 0)) } },
  oars: { anchor: () => H.pt(-0.2, 0.84, 1).add(v3(0.2, 0.2, 0)), view: { pos: v3(6.5, 1.8, -5.5), look: () => H.pt(-0.2, 0.8, 1) } },
  shields: { anchor: () => H.pt(0.38, 1, 1).add(v3(0.3, 0.5, 0)), view: { pos: v3(7.4, 2.0, 6.5), look: () => H.pt(0.38, 0.9, 1) } },
  rudder: { anchor: () => rudderPivot.clone().add(v3(0.2, 0.4, 0)), view: { pos: v3(6.2, 1.9, 13.2), look: () => rudderPivot.clone().add(v3(0, -0.6, 0)) } },
  mast: { anchor: () => v3(0, deck0 + 3.2, mastZ), view: { pos: v3(12, 3.2, 3), look: () => v3(0, deck0 + 3.5, mastZ) } },
  chest: { anchor: () => cast.chest.mesh.position.clone().add(v3(0, 2.4, 0)), view: { pos: v3(-6.6, 2.0, 7.2), look: () => cast.chest.mesh.position.clone().add(v3(0, 1.6, 0)) } },
  game: { anchor: () => cast.game.mesh.position.clone().add(v3(0, 1.4, 0)), view: { pos: v3(-5.2, 1.5, 4.8), look: () => cast.game.mesh.position.clone().add(v3(0, 0.5, 0)) } },
  cook: { anchor: () => cast.cook.mesh.position.clone().add(v3(0, 2.2, 0)), view: { pos: v3(-6.2, 1.6, -6.4), look: () => cast.cook.mesh.position.clone().add(v3(0.5, 0.8, 0)) } },
  tent: { anchor: () => v3(-11.5, 2.8, 7), view: { pos: v3(-6.5, 1.7, 12.5), look: () => v3(-11.5, 1.2, 7) } },
  horses: { anchor: () => cast.horse.mesh.position.clone().add(v3(1.2, 2.6, 0)), view: { pos: v3(-8.5, 1.8, 18.5), look: () => cast.horse.mesh.position.clone().add(v3(1.2, 1, 0)) } },
  boat: { anchor: () => v3(8.5, 1.4, -12.5), view: { pos: v3(12.5, 1.7, -7.5), look: () => v3(8.5, 0.4, -12.5) } },
};

const T = { found: ["found", "Found with this ship"], other: ["other", "Known from other finds"], recon: ["recon", "Reconstruction"] };
const STOPS = content.map((c) => {
  const v = VIEWS[c.id];
  if (!v) throw new Error(`No camera view for stop "${c.id}"`);
  return { ...c, ...v, body: c.body.map((p) => `<p>${p}</p>`).join("") };
});

export { T, STOPS };
