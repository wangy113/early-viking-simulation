// Graphics quality. A ?quality= link wins, then the viewer's last choice on this device,
// then a guess from the device. The Quality button cycles the levels and reloads.
const TIERS = {
  low: { label: "Low", dpr: 1, tex: 1024, shadow: 1024, shadowArea: 18, water: 0 },
  medium: { label: "Medium", dpr: 1.25, tex: 1024, shadow: 2048, shadowArea: 26, water: 512 },
  high: { label: "High", dpr: 1.5, tex: 2048, shadow: 2048, shadowArea: 26, water: 1024 },
};
const ORDER = ["low", "medium", "high"];
const KEY = "gokstad.quality";

function gpuName() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  } catch { return ""; }
}
function guess() {
  const ua = navigator.userAgent, mem = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 0, gpu = gpuName();
  const phone = /iPhone|Android.*Mobile/.test(ua) || Math.min(screen.width, screen.height) < 600;
  const weakGpu = /SwiftShader|llvmpipe|Mali|PowerVR|Adreno \(TM\) [1-5]\d\d|Intel.*HD Graphics [2-6]\d\d|Intel.*UHD Graphics 6\d\d/i.test(gpu);
  if (phone || weakGpu || (mem && mem <= 4) || (cores && cores <= 4)) return "low";
  if (/CrOS|iPad|Android/.test(ua) || (mem && mem <= 8) || /Intel/i.test(gpu)) return "medium";
  return "high";
}
function stored() { try { return localStorage.getItem(KEY); } catch { return null; } }

const fromUrl = new URLSearchParams(location.search).get("quality");
const QUALITY = ORDER.includes(fromUrl) ? fromUrl : ORDER.includes(stored()) ? stored() : guess();
const TIER = TIERS[QUALITY];

function nextQuality() {
  const q = ORDER[(ORDER.indexOf(QUALITY) + 1) % ORDER.length];
  try { localStorage.setItem(KEY, q); } catch { /* the choice just will not be remembered */ }
  const url = new URL(location.href); url.searchParams.set("quality", q); location.replace(url);
}

export { QUALITY, TIER, TIERS, nextQuality };
