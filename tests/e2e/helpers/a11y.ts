import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function getSeriousAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  return result.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
}

export async function expectNoSeriousAccessibilityViolations(
  page: Page,
  context: string,
) {
  const blockingViolations = await getSeriousAccessibilityViolations(page);

  const details = blockingViolations
    .map(
      ({ id, impact, help, nodes }) =>
        `${id} (${impact}): ${help}\n${nodes
          .map(({ target, failureSummary }) =>
            `  ${target.join(" ")} — ${failureSummary ?? "sin resumen"}`,
          )
          .join("\n")}`,
    )
    .join("\n\n");

  expect(
    blockingViolations,
    `${context} contains blocking axe violations${details ? `:\n${details}` : ""}`,
  ).toEqual([]);
}
