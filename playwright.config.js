import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 240_000,
  fullyParallel: true,
  workers: 2,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173/",
    // small and low quality so software WebGL keeps the page responsive
    viewport: { width: 800, height: 450 },
    launchOptions: {
      // Software WebGL. GPU rasterization of 2D canvases is very slow under SwiftShader.
      args: ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--disable-gpu-rasterization"],
    },
  },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
