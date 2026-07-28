import { assertStagingDeployment } from "../../scripts/e2e/staging-guard.mjs";

export default async function mutableGlobalSetup() {
  if (process.env.E2E_RUN_MUTABLE !== "true") {
    throw new Error(
      "Mutable global setup may only run with E2E_RUN_MUTABLE=true.",
    );
  }

  await assertStagingDeployment(process.env);
}
