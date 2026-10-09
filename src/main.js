import "@fontsource/spectral/400.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/700.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "./styles.css";
import { preloadAssets } from "./textures.js";

// Load every texture and the sky first, then build the scene.
const pct = document.getElementById("loadPct"), bar = document.getElementById("loadBar");
preloadAssets((f) => { pct.textContent = `${Math.round(f * 100)}%`; bar.style.width = `${f * 100}%`; })
  .then(() => import("./app.js"))
  .then(() => { document.getElementById("loader").hidden = true; })
  .catch((e) => { pct.textContent = ""; document.getElementById("loader").firstChild.textContent = "The scene could not load. Please refresh the page."; console.error(e); });
