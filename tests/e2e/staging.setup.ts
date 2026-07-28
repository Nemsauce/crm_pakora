import { expect, test as setup } from "@playwright/test";

import { assertStagingDeployment } from "../../scripts/e2e/staging-guard.mjs";

setup("verify the staging-only database marker read-only", async () => {
  const config = await assertStagingDeployment(process.env);

  expect(config.markerVerified).toBe(true);
  expect(config.deploymentAttested).toBe(true);
});
