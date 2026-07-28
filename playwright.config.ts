import { defineConfig, type Project } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.E2E_BASE_URL ??
  "http://localhost:3100";

const publicTestMatch = [
  "**/contracts/**/*.spec.ts",
  "**/visual/**/*.spec.ts",
];

function visualProject(
  name: string,
  width: number,
  height: number,
  theme: "light" | "dark",
): Project {
  return {
    name,
    testMatch: publicTestMatch,
    metadata: { theme },
    use: {
      browserName: "chromium",
      colorScheme: theme,
      viewport: { width, height },
    },
  };
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}-{platform}{ext}",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002,
    },
  },
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
      "./node_modules/.bin/next dev -p 3100",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { browserName: "chromium" },
    },
    {
      name: "functional",
      testMatch: [
        "**/contracts/**/*.spec.ts",
        "**/functional/**/*.spec.ts",
      ],
      metadata: { theme: "light" },
      use: {
        browserName: "chromium",
        colorScheme: "light",
        viewport: { width: 1440, height: 900 },
      },
    },
    visualProject("desktop-light", 1440, 900, "light"),
    visualProject("desktop-dark", 1440, 900, "dark"),
    visualProject("tablet-light", 768, 1024, "light"),
    visualProject("tablet-dark", 768, 1024, "dark"),
    visualProject("mobile-light", 375, 812, "light"),
    visualProject("mobile-dark", 375, 812, "dark"),
    {
      name: "reduced-motion",
      testMatch: "**/contracts/**/*.spec.ts",
      metadata: { theme: "dark" },
      use: {
        browserName: "chromium",
        colorScheme: "dark",
        contextOptions: { reducedMotion: "reduce" },
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
