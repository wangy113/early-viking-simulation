// Runs in the page (with ?debug): plays every task loop and lists the people's body parts
// that end up on the wrong side of the hull. Inside the ship counts for people on the beach,
// outside the planking counts for people on deck. Used by tests and scripts/humans/collide.mjs.
export const hullCheck = () => {
  const T = window.__THREE, ray = new T.Raycaster(), out = [];
  // body parts with a rough radius, so a head counts when its surface touches the planks
  const parts = { head: 0.12, neck_01: 0.07, spine_03: 0.15, hand_l: 0.06, hand_r: 0.06, lowerarm_l: 0.05, lowerarm_r: 0.05, foot_l: 0.06, foot_r: 0.06, calf_l: 0.07, calf_r: 0.07 };
  // only the long hull planking counts, not the mast, chests or the small boat
  const hull = window.__solids.filter((m) => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return b.max.z - b.min.z > 12 && b.max.y - b.min.y > 1; });
  for (const [name, a] of Object.entries(window.__cast)) {
    const people = []; a.mesh.traverse((o) => { if (o.userData?.human) people.push(o.userData.human); });
    if (!people.length) continue;
    const bad = new Map();
    for (let i = 0; i < 24; i++) {
      a.update((i / 24) * a.period); a.mesh.updateMatrixWorld(true);
      people.forEach((h, k) => {
        const onDeck = h.g.getWorldPosition(new T.Vector3()).y > 0.6;
        for (const [p, r] of Object.entries(parts)) {
          const w = h.b[p].getWorldPosition(new T.Vector3());
          const out = new T.Vector3(Math.sign(w.x) || 1, 0, 0);
          const dir = onDeck ? out.clone().negate() : out;
          w.addScaledVector(dir, -r);
          ray.set(w, dir); ray.far = onDeck ? Math.abs(w.x) : 4;
          const hit = ray.intersectObjects(hull, false)[0];
          if (hit) { const key = `${k}:${p}`; bad.set(key, Math.max(bad.get(key) || 0, onDeck ? hit.distance : 0.01)); }
        }
      });
    }
    if (bad.size) out.push(`${name}: ${[...bad.keys()].join(" ")}`);
  }
  return out;
};
