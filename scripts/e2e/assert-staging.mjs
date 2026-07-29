#!/usr/bin/env node

import {
  StagingGuardError,
  assertStagingDeployment,
} from "./staging-guard.mjs";

try {
  const config = await assertStagingDeployment(process.env);
  console.log(
    `E2E staging guard passed for ${config.appOrigin} and Supabase project ${config.projectRef}; marker ${config.markerTable}.${config.markerIdColumn}=${config.markerId} was verified read-only.`,
  );
} catch (error) {
  if (error instanceof StagingGuardError) {
    console.error(error.message);
  } else {
    console.error("E2E staging guard failed unexpectedly.", error);
  }

  process.exitCode = 1;
}
