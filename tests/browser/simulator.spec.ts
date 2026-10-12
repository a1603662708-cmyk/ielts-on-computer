import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
async function choose(page: Page, section: string, mode = "practice") {
  await page.goto(`/?mode=${mode}`);
  await page.getByRole("button", { name: "Choose test →" }).click();
  await page.getByRole("button", { name: section, exact: true }).click();
}
async function submitObjective(page: Page) {
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Submit test", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit now", exact: true }).click();
}
async function patchRecord(
  page: Page,
  key: string,
  patch: Record<string, unknown>,
) {
  await page.evaluate(
    async ({ key, patch }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("ielts-local-v2");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("records", "readwrite");
        const store = tx.objectStore("records");
        const request = store.get(key);
        request.onsuccess = () =>
          store.put({ ...request.result, ...patch }, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { key, patch },
  );
}
test("Reading: answer, flags, independent scrolling, highlights, notes, refresh, submit, history", async ({
  page,
}) => {
  await choose(page, "Reading");
  await page
    .getByLabel("Answer for question 1", { exact: true })
    .selectOption("iv");
  await page
    .getByRole("button", { name: "Flag question 1", exact: true })
    .click();
  await page.locator('[data-w="0"]').dblclick();
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await page.locator('[data-w="3"]').dblclick();
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page
    .getByPlaceholder("Write your notes here. They save automatically.")
    .fill("Review this sentence");
  await page.getByRole("button", { name: "Hide notes" }).click();
  const pane = page.locator("[data-passage-scroll]");
  const before = await pane.evaluate((e) => e.scrollTop);
  await page
    .getByRole("button", {
      name: "Go to question 10, not answered",
      exact: true,
    })
    .click();
  expect(await pane.evaluate((e) => e.scrollTop)).toBe(before);
  await page.reload();
  await expect(
    page.getByLabel("Answer for question 1", { exact: true }),
  ).toHaveValue("iv");
  await expect(page.locator('[data-w="0"]')).toHaveClass(/w-hl/);
  await expect(page.locator('[data-w="3"]')).toHaveClass(/w-note/);
  await page.getByRole("button", { name: "Passage 2", exact: true }).click();
  await expect(page.locator('[data-w="0"]')).not.toHaveClass(/w-hl/);
  await page.getByRole("button", { name: "Passage 1", exact: true }).click();
  await expect(page.locator('[data-w="0"]')).toHaveClass(/w-hl/);
  await page.screenshot({ path: "../outputs/reading-exam.png" });
  await submitObjective(page);
  await expect(
    page.getByRole("heading", { name: "Results", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Results", exact: true }),
  ).toBeVisible();
  await page.goto("/history");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByText("Review this sentence", { exact: false }),
  ).toBeVisible();
  await page.goto("/mistakes");
  await expect(
    page.getByRole("heading", { name: "Mistake notebook" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(39);
});
test("Writing: tasks, spellcheck, autosave, submission and export", async ({
  page,
}) => {
  await choose(page, "Writing");
  const area = page.getByRole("textbox", { name: "Task 1 answer" });
  await area.fill("This chart shows a steady increase in bus use.");
  await expect(area).toHaveAttribute("spellcheck", "false");
  await expect(page.getByText("Words: 9", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Task 2 · 0 words" }).click();
  await page
    .getByRole("textbox", { name: "Task 2 answer" })
    .fill(
      "Public libraries should provide both printed books and digital resources.",
    );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Task 2 answer" }),
  ).toHaveValue(/Public libraries/);
  await page
    .getByRole("button", { name: "Submit Writing", exact: true })
    .click();
  await page.getByRole("button", { name: "Save and submit" }).click();
  await expect(
    page.getByRole("heading", { name: "Writing saved" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export TXT" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.txt$/);
});
test("Listening: real audio, practice replay, answer recovery and errors", async ({
  page,
}) => {
  await choose(page, "Listening");
  await expect(page.locator("audio")).toHaveAttribute("controls", "");
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((e) => (e as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(1);
  await page
    .getByLabel("Answer for question 1", { exact: true })
    .fill("Morgan");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Practice paused.")).toBeVisible();
  await page
    .getByRole("button", { name: "Resume", exact: true })
    .last()
    .click();
  await page.reload();
  await expect(
    page.getByLabel("Answer for question 1", { exact: true }),
  ).toHaveValue("Morgan");
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await submitObjective(page);
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
});
test("Mock: no practice tools, audio cannot replay, refresh elapsed time, full chain hides scores", async ({
  page,
}) => {
  await page.goto("/?mode=mock");
  await page.getByRole("button", { name: "Choose test →" }).click();
  await page.getByRole("button", { name: "Full Mock: L → R → W" }).click();
  await page.getByRole("button", { name: "Start Fullscreen Mock" }).click();
  await expect(
    page.getByRole("heading", { name: "LISTENING · Part 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Answers", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("audio")).not.toHaveAttribute("controls", "");
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((e) => (e as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(2);
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((e) => (e as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(2);
  await submitObjective(page);
  await expect(
    page.getByRole("heading", { name: "READING · Part 1" }),
  ).toBeVisible();
  await page.goto("/history");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.goto("/mock");
  await expect(
    page.getByRole("heading", { name: "READING · Part 1" }),
  ).toBeVisible();
  await submitObjective(page);
  await expect(
    page.getByRole("textbox", { name: "Task 1 answer" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Submit Writing", exact: true })
    .click();
  await page.getByRole("button", { name: "Save and submit" }).click();
  await expect(
    page.getByRole("heading", { name: "Exam history" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
});
test("Expired Mock survives reload and autosubmits rather than dropping work", async ({
  page,
}) => {
  await choose(page, "Reading", "mock");
  await page
    .getByLabel("Answer for question 1", { exact: true })
    .selectOption("iv");
  await expect(page.getByText("Saved locally")).toBeVisible();
  await page.evaluate(() =>
    localStorage.removeItem("ielts.journal.ielts.session"),
  );
  await patchRecord(page, "ielts.session", { endsAt: Date.now() - 1000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.getByText("1 / 40", { exact: true })).toBeVisible();
});
test("Speaking: MediaRecorder creates playable bytes and retains them after refresh", async ({
  page,
}) => {
  await choose(page, "Speaking");
  await expect(
    page.getByText("● Recording — saving every 500 ms"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("ielts.journal.work.session")!)
            .recordings[0]?.duration ?? 0,
      ),
    )
    .toBeGreaterThan(1);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(page.locator("audio")).toBeVisible();
  await page.locator("audio").evaluate((e) => (e as HTMLAudioElement).play());
  await expect
    .poll(() =>
      page.locator("audio").evaluate((e) => (e as HTMLAudioElement).readyState),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Next question / part" }).click();
  await expect(
    page.getByText("● Recording — saving every 500 ms"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("ielts.journal.work.session")!)
            .recordings[1]?.duration ?? 0,
      ),
    )
    .toBeGreaterThan(1);
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Submit test", exact: true })
    .click();
  await page.getByRole("button", { name: "Save and finish" }).click();
  await expect(
    page.getByRole("heading", { name: "Speaking saved" }),
  ).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(2);
  await page.reload();
  await expect(page.locator("audio")).toHaveCount(2);
});
test("Importer: original structured JSON validates, saves, reloads and starts", async ({
  page,
}) => {
  const data = JSON.parse(fs.readFileSync("public/demo/metadata.json", "utf8"));
  data.id = "import-test";
  data.book = "My lawful local papers";
  data.test = 19;
  await page.goto("/import");
  await page.getByLabel("Test JSON").fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save to local Library" }).click();
  await expect(
    page.getByText("Saved to Library.", { exact: false }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "My lawful local papers / Test 19" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My lawful local papers / Test 19" }),
  ).toBeVisible();
});
test("Small layout keeps navigation and question controls accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await choose(page, "Reading");
  await expect(
    page.getByRole("navigation", { name: "Question navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(768);
});

test("Listening preflight failure is explicit and does not start the clock", async ({
  page,
}) => {
  await page.route("**/demo/part2.m4a", (route) => route.abort());
  await choose(page, "Listening");
  await expect(
    page.getByRole("alert").filter({ hasText: "Cannot play Part 2" }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
});
test("Mock clock rollback is detected after refresh", async ({ page }) => {
  await choose(page, "Reading", "mock");
  await expect(page.getByText("Saved locally")).toBeVisible();
  await page.evaluate(() => {
    const key = "ielts.journal.ielts.session";
    const s = JSON.parse(localStorage.getItem(key)!);
    s.lastSeen = Date.now() + 60000;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
});
test("Speaking permission denied gives a real error without creating a fake recording", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await choose(page, "Speaking");
  await expect(
    page.getByRole("alert").filter({ hasText: "NotAllowedError" }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
});
test("Speaking cue card automatically changes from preparation to recording", async ({
  page,
}) => {
  await choose(page, "Speaking");
  await expect(
    page.getByText("● Recording — saving every 500 ms"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await page.evaluate(() => {
    const key = "ielts.journal.work.session";
    const s = JSON.parse(localStorage.getItem(key)!);
    s.stage = "prep";
    s.questionIndex = 0;
    s.endsAt = Date.now() + 1800;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Prepare for one minute" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Speak for up to two minutes" }),
  ).toBeVisible();
  await expect(
    page.getByText("● Recording — saving every 500 ms"),
  ).toBeVisible();
});
test("Portable library bundle includes media and imports without external references", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose test →" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export test + media ZIP" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.goto("/import");
  await page.getByLabel("Source files").setInputFiles({
    name: "copy.ielts.zip",
    mimeType: "application/zip",
    buffer: fs.readFileSync(path!),
  });
  await expect(page.getByLabel("Test JSON")).toHaveValue(/asset:/);
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(
    page.getByRole("heading", { name: "3. Preview & save" }),
  ).toBeVisible();
});
