import { defineConfig, type Project } from "@playwright/test";

const runMutable = process.env.E2E_RUN_MUTABLE === "true";
const localBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const mutableBaseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.E2E_BASE_URL ??
  "http://localhost:3100";
const baseURL = runMutable ? mutableBaseURL : localBaseURL;
const parsedBaseURL = new URL(baseURL);
const baseURLHostname = parsedBaseURL.hostname;
const usesLocalWebServer =
  baseURLHostname === "localhost" || baseURLHostname === "127.0.0.1";
const isolatedPublicServerCommand = process.env.CI
  ? "env VERCEL_ENV= E2E_ATTESTATION_TOKEN= E2E_VERCEL_AUTOMATION_BYPASS_SECRET= E2E_ALLOW_MUTATIONS=false NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= ./node_modules/.bin/next start -p 3100"
  : "env VERCEL_ENV= E2E_ATTESTATION_TOKEN= E2E_VERCEL_AUTOMATION_BYPASS_SECRET= E2E_ALLOW_MUTATIONS=false NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= ./node_modules/.bin/next dev -p 3100";

if (!runMutable) {
  if (
    !usesLocalWebServer ||
    parsedBaseURL.protocol !== "http:" ||
    parsedBaseURL.username ||
    parsedBaseURL.password ||
    parsedBaseURL.pathname !== "/" ||
    parsedBaseURL.search ||
    parsedBaseURL.hash
  ) {
    throw new Error(
      "The read-only public Playwright suite requires a canonical HTTP localhost origin.",
    );
  }
} else if (usesLocalWebServer) {
  throw new Error(
    "Mutable Playwright projects require the attested remote Vercel Preview origin.",
  );
}

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

const publicProjects: Project[] = [
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
];

const mutableProjects: Project[] = [
  {
    name: "staging-guard",
    testMatch: "staging.setup.ts",
  },
  {
    name: "auth",
    testMatch: "auth.setup.ts",
    dependencies: ["staging-guard"],
    use: {
      browserName: "chromium",
      screenshot: "off",
      trace: "off",
      video: "off",
    },
  },
  {
    name: "mutable",
    testMatch: "**/mutable/**/*.spec.ts",
    dependencies: ["auth"],
    use: {
      browserName: "chromium",
      colorScheme: "light",
      trace: "off",
      video: "off",
      storageState: "playwright/.auth/admin.json",
      viewport: { width: 1440, height: 900 },
    },
  },
];

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
  globalSetup: runMutable ? "./tests/e2e/mutable.global-setup.ts" : undefined,
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  webServer: !runMutable
    ? {
        command: isolatedPublicServerCommand,
        url: `${baseURL}/login`,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  projects: runMutable ? mutableProjects : publicProjects,
});
