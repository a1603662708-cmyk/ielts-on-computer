import { test, expect } from "@playwright/test";
import fs from "node:fs";

const demo = JSON.parse(fs.readFileSync("public/demo/metadata.json", "utf8"));

test("Full test import: multiple files classify, preview, import, reload and start", async ({
  page,
}) => {
  const listening = structuredClone(demo.sections.listening);
  listening.paper.audio = [];
  const sections = ["reading", "listening", "writing", "speaking"] as const;
  const files = sections.map((section) => ({
    name: `${section}.json`,
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(
        section === "listening" ? listening : demo.sections[section],
      ),
    ),
  }));
  files.push({
    name: "listening-part-1.wav",
    mimeType: "audio/wav",
    buffer: fs.readFileSync("tests/fixtures/audio.wav"),
  });
  await page.goto("/import");
  await expect(page.getByRole("tab", { name: "Full test" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Drop your IELTS test files here" }),
  ).toBeVisible();
  await expect(page.getByLabel("Test JSON")).toHaveCount(0);
  await page.getByLabel("Full test files").setInputFiles(files);
  await expect(page.getByText("5 files added")).toBeVisible();
  for (const section of sections)
    await expect(
      page.getByRole("article", { name: `${section} section` }),
    ).toContainText("Ready");
  await page.getByLabel("Full test title").fill("Complete local fixture");
  await page.getByLabel("Full test book").fill("Four section import");
  await page.getByLabel("Full test number").fill("20");
  await page.getByLabel("Full test module").selectOption("General Training");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Import full test" }).click();
  await expect(
    page.getByText("Saved to Library.", { exact: false }),
  ).toBeVisible();
  await page.goto("/");
  await page.reload();
  const row = page
    .locator("section.local-row")
    .filter({ hasText: "Four section import" });
  for (const section of sections)
    await expect(row).toContainText(
      section[0].toUpperCase() + section.slice(1),
    );
  const audio = await page.evaluate(async () => {
    const request = indexedDB.open("ielts-local-v2");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = db.transaction("records").objectStore("records");
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const r = records.getAllKeys();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const values = await Promise.all(
      keys
        .filter((key) => String(key).startsWith("library:"))
        .map(
          (key) =>
            new Promise<{
              book: string;
              module: string;
              sections: { listening: { paper: { audio: { url: string }[] } } };
            }>((resolve, reject) => {
              const r = db
                .transaction("records")
                .objectStore("records")
                .get(key);
              r.onsuccess = () => resolve(r.result);
              r.onerror = () => reject(r.error);
            }),
        ),
    );
    const item = values.find((value) => value.book === "Four section import");
    if (!item) throw new Error("Imported test not found after refresh.");
    const ref = item?.sections.listening.paper.audio[0].url as string;
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const r = db
        .transaction("assets")
        .objectStore("assets")
        .get(ref?.slice(6));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    let playable = false;
    if (blob) {
      const url = URL.createObjectURL(blob);
      const element = new Audio(url);
      playable = await new Promise<boolean>((resolve) => {
        element.onloadedmetadata = () =>
          resolve(Number.isFinite(element.duration) && element.duration > 0);
        element.onerror = () => resolve(false);
        element.load();
      });
      URL.revokeObjectURL(url);
    }
    return {
      ref,
      size: blob?.size ?? 0,
      type: blob?.type,
      playable,
      module: item.module,
    };
  });
  expect(audio.ref).toMatch(/^asset:/);
  expect(audio.size).toBeGreaterThan(100);
  expect(audio.type).toBe("audio/wav");
  expect(audio.playable).toBe(true);
  expect(audio.module).toBe("General Training");
  await row.getByRole("button", { name: "Choose test →" }).click();
  await row.getByRole("button", { name: "Reading", exact: true }).click();
  await expect(page).toHaveURL(/\/test\/?$/);
  await expect(
    page.getByLabel("Answer for question 1", { exact: true }),
  ).toBeVisible();
});

test("Import modes keep their forms separate; partial tests show neutral missing sections and advanced data stays folded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 850 });
  await page.goto("/import");
  await expect(page.getByRole("tab", { name: "Full test" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Source files")).toHaveCount(0);
  await page.getByLabel("Full test files").setInputFiles([
    {
      name: "reading.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(demo.sections.reading)),
    },
    {
      name: "writing.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(demo.sections.writing)),
    },
  ]);
  await expect(
    page.getByRole("article", { name: "listening section" }),
  ).toContainText("Missing");
  await expect(
    page.getByRole("article", { name: "speaking section" }),
  ).toContainText("Missing");
  await expect(page.getByLabel("Full test JSON")).toHaveCount(0);
  await page.getByText("Advanced · Edit structured test data").click();
  await page
    .getByRole("button", { name: "Prepare structured test data" })
    .click();
  await expect(page.getByLabel("Full test JSON")).toHaveValue(/"reading"/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
  await page.getByRole("tab", { name: "Single section" }).click();
  await expect(
    page.getByRole("tab", { name: "Single section" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Source files")).toBeVisible();
  await expect(page.getByLabel("Test JSON")).toBeVisible();
  await expect(page.getByLabel("Full test files")).toHaveCount(0);
});

test("Full test drop zone accepts files, highlights review and can clear the selection", async ({
  page,
}) => {
  await page.goto("/import");
  await page.locator(".import-dropzone").evaluate((zone, source) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([source], "ambiguous-file.txt", { type: "text/plain" }),
    );
    zone.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
    );
  }, "A short passage\n1. What is the passage about?");
  await expect(page.getByText("1 file added")).toBeVisible();
  await expect(page.getByText("Unclassified files")).toBeVisible();
  await page.getByLabel("ambiguous-file.txt section").selectOption("reading");
  await expect(
    page.getByRole("article", { name: "reading section" }),
  ).toContainText("Ready");
  await page.getByRole("button", { name: "Clear files" }).click();
  await expect(page.getByText("1 file added")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Review detected sections" }),
  ).toHaveCount(0);
});
