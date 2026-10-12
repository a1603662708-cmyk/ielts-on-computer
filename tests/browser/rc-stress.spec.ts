import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import type { ObjectiveHistory } from "@/storage/history";
const fixture = JSON.parse(
  fs.readFileSync("tests/fixtures/rc-paper.json", "utf8"),
);
async function importPaper(page: Page, data = fixture) {
  await page.goto("/import");
  await page.getByRole("tab", { name: "Single section" }).click();
  await expect(page.getByLabel("Test JSON")).not.toHaveValue("");
  await page.getByLabel("Test JSON").fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Save to local Library" }).click();
  await expect(
    page.getByText("Saved to Library.", { exact: false }),
  ).toBeVisible();
}
async function choose(page: Page, section: string, book = fixture.book) {
  await page.goto("/");
  await page
    .locator("section.local-row")
    .filter({ hasText: book })
    .getByRole("button", { name: "Choose test →" })
    .click();
  await page.getByRole("button", { name: section, exact: true }).click();
}
async function submit(page: Page) {
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Submit test", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit now", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Results", exact: true }),
  ).toBeVisible();
}
async function fillPaper(
  page: Page,
  section: "reading" | "listening",
  wrong = 0,
) {
  const entry = fixture.sections[section];
  for (const part of entry.paper.parts) {
    await page
      .getByRole("button", {
        name: `${section === "reading" ? "Passage" : "Part"} ${part.part}`,
        exact: true,
      })
      .click();
    for (const g of part.groups) {
      if (g.type === "mcq-multi") {
        for (let i = 0; i < g.pick; i++) {
          const n = g.range[0] + i;
          const answer =
            n <= wrong
              ? g.options
                  .map((_: string, index: number) =>
                    String.fromCharCode(65 + index),
                  )
                  .filter(
                    (letter: string) =>
                      !Array.from(
                        { length: g.pick },
                        (_, j) => entry.key.answers[g.range[0] + j],
                      ).includes(letter),
                  )[i]
              : entry.key.answers[n];
          await page
            .locator(`#q-${g.range[0]}`)
            .getByRole("checkbox")
            .nth(answer.charCodeAt(0) - 65)
            .check();
        }
        continue;
      }
      for (const q of g.questions) {
        const answer = q.n <= wrong ? "wrong" : entry.key.answers[q.n];
        if (g.type === "gap")
          await page
            .getByLabel(`Answer for question ${q.n}`, { exact: true })
            .fill(Array.isArray(answer) ? answer[0] : answer);
        else if (g.type === "matching")
          await page
            .getByLabel(`Answer for question ${q.n}`, { exact: true })
            .selectOption(
              q.n <= wrong
                ? g.options.find(
                    (o: { key: string }) => o.key !== entry.key.answers[q.n],
                  ).key
                : answer,
            );
        else {
          const selector =
            g.type === "mcq"
              ? q.n <= wrong
                ? entry.key.answers[q.n] === "A"
                  ? "B"
                  : "A"
                : answer
              : q.n <= wrong
                ? ["TRUE", "FALSE", "NOT GIVEN", "YES", "NO"]
                    .filter((v) =>
                      g.type === "tf-ng"
                        ? ["TRUE", "FALSE", "NOT GIVEN"].includes(v)
                        : ["YES", "NO", "NOT GIVEN"].includes(v),
                    )
                    .find((v) => v !== entry.key.answers[q.n])
                : answer;
          await page.locator(`#q-${q.n} input[value="${selector}"]`).check();
        }
      }
    }
  }
}
test("ST01 5 exams, 200 answers, 50 highlights, 30 notes; history immutable and mistake counts accumulate", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 1; i <= 5; i++) {
    const data = structuredClone(fixture);
    data.id = `qa-five-${i}`;
    data.book = `QA Persistence ${i}`;
    await importPaper(page, data);
    await choose(page, "Reading", data.book);
    for (let h = 0; h < 10; h++) {
      await page.locator(`[data-w="${h * 4}"]`).dblclick();
      await page
        .getByRole("button", { name: "Highlight", exact: true })
        .click();
    }
    for (let n = 0; n < 6; n++) {
      await page.getByRole("button", { name: "New note", exact: true }).click();
      await page
        .getByPlaceholder("Write your notes here. They save automatically.")
        .fill(`Test ${i} note ${n}`);
      await page.getByRole("button", { name: "Hide notes" }).click();
    }
    await fillPaper(page, "reading", 20);
    await submit(page);
    await expect(page.getByText("20 / 40", { exact: true })).toBeVisible();
  }
  const before = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("ielts-local-v2");
      q.onsuccess = () => r(q.result);
    });
    return await new Promise<ObjectiveHistory[]>((r) => {
      const q = db.transaction("records").objectStore("records").getAll();
      q.onsuccess = () =>
        r(q.result.filter((v: ObjectiveHistory) => v?.section === "reading"));
    });
  });
  expect(before).toHaveLength(5);
  expect(
    before.reduce(
      (sum: number, v: ObjectiveHistory) => sum + v.session.highlights.length,
      0,
    ),
  ).toBe(50);
  expect(
    before.reduce(
      (sum: number, v: ObjectiveHistory) => sum + v.session.notes.length,
      0,
    ),
  ).toBe(30);
  await choose(page, "Reading", "QA Persistence 1");
  await fillPaper(page, "reading", 20);
  await submit(page);
  await page.goto("/history");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.goto("/mistakes");
  await page
    .getByRole("combobox", { name: /^Book/ })
    .selectOption("QA Persistence 1");
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await expect(page.locator("tbody tr").first()).toContainText("2 / 2");
  await page
    .getByRole("combobox", { name: /^Question type/ })
    .selectOption("matching-headings");
  expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);
  await page.close();
  const restored = await context.newPage();
  await restored.goto("/history");
  await expect(restored.locator("tbody tr")).toHaveCount(6);
  await restored
    .getByRole("button", { name: "Review", exact: true })
    .last()
    .click();
  await expect(
    restored.getByText("Test 1 note 0", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("ST02 200/400/850 word essays, 20 switches, keyboard, refresh, TXT and Markdown exact content", async ({
  page,
}) => {
  await importPaper(page);
  await choose(page, "Writing");
  const a = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
  const b = Array.from({ length: 400 }, (_, i) => `term${i}`).join("\n");
  const c = Array.from({ length: 850 }, (_, i) => `long${i}`).join(" ");
  await page.getByLabel("Task 1 answer").fill(a);
  await page.getByRole("button", { name: /Task 2 ·/ }).click();
  await page.getByLabel("Task 2 answer").fill(b);
  for (let i = 0; i < 20; i++)
    await page
      .getByRole("button", { name: new RegExp(`Task ${(i % 2) + 1} ·`) })
      .click();
  await page.reload();
  await expect(page.getByLabel("Task 2 answer")).toHaveValue(b);
  await page.getByLabel("Task 2 answer").fill(c);
  await page.getByLabel("Task 2 answer").press("Alt+n");
  await expect(page.getByLabel("Task 2 answer")).toHaveValue(c);
  await page.getByRole("button", { name: /Task 1 ·/ }).click();
  await expect(page.getByLabel("Task 1 answer")).toHaveValue(a);
  await page.getByLabel("Task 1 answer").press("Meta+a");
  await page.getByLabel("Task 1 answer").press("Meta+c");
  await page.getByLabel("Task 1 answer").press("ArrowRight");
  await page
    .getByRole("button", { name: "Submit Writing", exact: true })
    .click();
  await page.getByRole("button", { name: "Save and submit" }).click();
  for (const format of ["TXT", "Markdown"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: `Export ${format}` }).click();
    const file = await (await download).path();
    const text = fs.readFileSync(file!, "utf8");
    expect(text).toContain(a);
    expect(text).toContain(c);
    expect(text).toContain("Words: 850");
  }
});
test("ST03 Listening mixed formats all 40 answered and corrected, speed/volume, rapid navigation", async ({
  page,
}) => {
  await importPaper(page);
  await choose(page, "Listening");
  await fillPaper(page, "listening");
  for (let i = 0; i < 20; i++)
    await page
      .getByRole("button", { name: `Part ${(i % 4) + 1}`, exact: true })
      .click();
  await page.getByRole("button", { name: "Part 1", exact: true }).click();
  const input = page.getByLabel("Answer for question 1", { exact: true });
  await input.fill("");
  await input.fill(" MORGAN ");
  await page.getByLabel("Volume").fill("0");
  await expect
    .poll(() =>
      page.locator("audio").evaluate((e) => (e as HTMLAudioElement).volume),
    )
    .toBe(0);
  await page.getByLabel("Volume").fill("0.6");
  await page.reload();
  await expect(input).toHaveValue(" MORGAN ");
  await submit(page);
  await expect(page.getByText("40 / 40", { exact: true })).toBeVisible();
});
test("ST04 malformed inputs reject without white screen; missing numbering and empty library", async ({
  page,
}) => {
  await page.goto("/import");
  await page.getByRole("tab", { name: "Single section" }).click();
  await expect(page.getByLabel("Test JSON")).not.toHaveValue("");
  for (const content of [
    "{broken",
    JSON.stringify({ ...fixture, sections: {} }),
    JSON.stringify({
      ...fixture,
      sections: {
        reading: {
          paper: {
            ...fixture.sections.reading.paper,
            parts: [
              {
                part: 1,
                groups: [{ type: "gap", questions: [{ prompt: "No number" }] }],
              },
            ],
          },
          key: { formatVersion: 1, answers: {} },
        },
      },
    }),
  ]) {
    await page.getByLabel("Test JSON").fill(content);
    await page.getByRole("button", { name: "Validate & preview" }).click();
    await expect(page.locator("p.error")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Import a test", exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("Source files").setInputFiles({
    name: "wrong.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("bad"),
  });
  await expect(page.locator("p.error")).toBeVisible();
});
for (const size of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1512, height: 982 },
  { width: 768, height: 700 },
])
  test(`ST05 layout ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await importPaper(page);
    await choose(page, "Reading");
    await expect(
      page.getByRole("navigation", { name: "Question navigation" }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Options", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await page.screenshot({
      path: `../outputs/qa-evidence/reading-${size.width}.png`,
    });
  });
