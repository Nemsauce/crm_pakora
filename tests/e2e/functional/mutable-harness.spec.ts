import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { expect, test } from "@playwright/test";

const mutableDirectory = resolve(import.meta.dirname, "../mutable");

async function collectMutableSpecs(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMutableSpecs(path)));
    } else if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      files.push(path);
    }
  }

  return files.sort();
}

test("every mutable spec uses the staging origin guard fixture", async () => {
  const mutableSpecs = await collectMutableSpecs(mutableDirectory);

  expect(mutableSpecs.length).toBeGreaterThan(0);

  for (const filePath of mutableSpecs) {
    const fileName = relative(mutableDirectory, filePath);
    const source = await readFile(filePath, "utf8");
    expect(
      source,
      `${fileName} must import its test object from the staging fixture.`,
    ).toMatch(/from\s+["'][^"']*fixtures\/staging["']/);
    expect(source).not.toMatch(/from\s+["']@playwright\/test["']/);
  }
});
