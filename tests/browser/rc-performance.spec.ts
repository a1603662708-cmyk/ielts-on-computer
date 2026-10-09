import { test, expect } from "@playwright/test";
import fs from "node:fs";
test("PF actual 50 submitted attempts, navigation latency, history load and no uncaught errors", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const started = performance.now();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Choose test →" }),
  ).toBeVisible();
  const firstLoadMs = performance.now() - started;
  const latencies: number[] = [];
  for (let i = 0; i < 50; i++) {
    if (i) await page.goto("/");
    await page.getByRole("button", { name: "Choose test →" }).click();
    await page.getByRole("button", { name: "Reading", exact: true }).click();
    if (i === 0)
      for (let j = 0; j < 20; j++) {
        const before = performance.now();
        await page
          .getByRole("button", { name: `Passage ${(j % 3) + 1}`, exact: true })
          .click();
        latencies.push(performance.now() - before);
      }
    await page.getByRole("button", { name: "Options", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Submit test", exact: true })
      .click();
    await page.getByRole("button", { name: "Submit now", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Results", exact: true }),
    ).toBeVisible();
  }
  const startHistory = performance.now();
  await page.goto("/history");
  await expect(page.locator("tbody tr")).toHaveCount(50);
  const historyMs = performance.now() - startHistory;
  const storage = await page.evaluate(() => navigator.storage.estimate());
  expect(errors).toEqual([]);
  latencies.sort((a, b) => a - b);
  fs.writeFileSync(
    "../outputs/qa-evidence/performance.json",
    JSON.stringify(
      {
        firstLoadMs,
        historyRows: 50,
        historyMs,
        navigationMedianMs: latencies[10],
        navigationP95Ms: latencies[19],
        storage,
        uncaughtErrors: errors,
      },
      null,
      2,
    ),
  );
});
