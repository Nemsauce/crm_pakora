import { expect, test as base } from "@playwright/test";

import { assertSafeStagingEnvironment } from "../../../scripts/e2e/staging-guard.mjs";
import { installStagingBrowserOriginGuard } from "../helpers/staging-network";

export const test = base.extend({
  page: async ({ page }, provide) => {
    const config = assertSafeStagingEnvironment(process.env);
    const assertOriginIsolation = await installStagingBrowserOriginGuard(
      page,
      config,
    );

    await provide(page);
    assertOriginIsolation();

    const currentUrl = new URL(page.url());
    expect(currentUrl.origin).toBe(config.appOrigin);
  },
});

export { expect };
