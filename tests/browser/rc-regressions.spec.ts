import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
const demo = JSON.parse(fs.readFileSync("public/demo/metadata.json", "utf8"));
async function choose(page: Page, section: string, mode = "practice") {
  await page.goto(`/?mode=${mode}`);
  await page.getByRole("button", { name: "Choose test →" }).click();
  await page.getByRole("button", { name: section, exact: true }).click();
}
test("RC01 second window cannot overwrite an active answer", async ({
  page,
  context,
}) => {
  await choose(page, "Reading");
  await page
    .getByLabel("Answer for question 1", { exact: true })
    .selectOption("iv");
  const second = await context.newPage();
  await second.goto("/test");
  await expect(
    second.getByText("Already open in another window", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Answer for question 1", { exact: true })
    .selectOption("iii");
  await page.close();
  await second.reload();
  await expect(
    second.getByLabel("Answer for question 1", { exact: true }),
  ).toHaveValue("iii");
});
test("RC02 corrupt saved session shows actionable error without white screen", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "ielts.journal.ielts.session",
      JSON.stringify({ id: "broken", endsAt: Date.now() + 60000 }),
    ),
  );
  await page.goto("/test");
  await expect(
    page.getByRole("alert").filter({ hasText: "Stored exam data is invalid" }),
  ).toBeVisible();
});
test("RC03 empty answer key values cannot mark blank answers correct", async ({
  page,
}) => {
  const data = structuredClone(demo);
  data.sections.listening.key.answers["1"] = "";
  await page.goto("/import");
  await page.getByLabel("Test JSON").fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Answer must not be blank" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save to local Library" }),
  ).toHaveCount(0);
});
test("RC04 importing an existing ID requires explicit replacement choice", async ({
  page,
}) => {
  await page.goto("/import");
  await page.getByLabel("Test JSON").fill(JSON.stringify(demo));
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(page.getByText(/This test ID already exists/)).toBeVisible();
});
test("RC05 timer uses 60:00 at one hour", async ({ page }) => {
  await choose(page, "Writing", "mock");
  await expect(page.getByText("60:00", { exact: true })).toBeVisible();
});
test("RC06 playback speed survives moving to next recording and final replay works", async ({
  page,
}) => {
  await choose(page, "Listening");
  await page.getByLabel("Speed").selectOption("1.5");
  await page.getByLabel("Recording", { exact: true }).selectOption("1");
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((e) => (e as HTMLAudioElement).playbackRate),
    )
    .toBe(1.5);
  await page.getByLabel("Recording", { exact: true }).selectOption("3");
  await expect
    .poll(() =>
      page.locator("audio").evaluate((e) => (e as HTMLAudioElement).readyState),
    )
    .toBeGreaterThan(0);
  await page.locator("audio").evaluate((e) => {
    const a = e as HTMLAudioElement;
    a.currentTime = a.duration - 0.2;
  });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((e) => {
        const a = e as HTMLAudioElement;
        return a.currentTime > 0 && !a.paused;
      }),
    )
    .toBe(true);
});
test("RC07 Writing ignores standalone punctuation in word count", async ({
  page,
}) => {
  await choose(page, "Writing");
  await page
    .getByLabel("Task 1 answer")
    .fill("hello   world\n well-known don't 123 ... —");
  await expect(page.getByText("Words: 5", { exact: true })).toBeVisible();
});

test("RC08 changing Speaking question while microphone opens cannot attach audio to the previous prompt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    let calls = 0;
    navigator.mediaDevices.getUserMedia = async (c) => {
      calls++;
      if (calls === 2) await new Promise((r) => setTimeout(r, 1600));
      return get(c);
    };
  });
  await choose(page, "Speaking");
  await page.getByRole("button", { name: "Next question / part" }).click();
  await expect(
    page.getByRole("heading", { name: "Question 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("● Recording — saving every 500 ms"),
  ).toBeVisible();
  await page.waitForTimeout(2200);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ielts.journal.work.session")!),
  );
  expect(saved.recordings).toHaveLength(1);
  expect(saved.recordings[0].question).toBe(saved.paper.part1[1]);
});
test("RC09 simulated disk quota failure is visible and last answer survives refresh via recovery journal", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException(
        "QA injected quota exhaustion",
        "QuotaExceededError",
      );
    };
  });
  await choose(page, "Reading");
  await page
    .getByLabel("Answer for question 1", { exact: true })
    .selectOption("iv");
  await expect(page.getByText(/Local save failed:/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Answer for question 1", { exact: true }),
  ).toHaveValue("iv");
});

test("RC10 recording quota failure blocks finish and retries the actual captured blob", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.add;
    (window as unknown as { failAudio: boolean }).failAudio = true;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<typeof original>
    ) {
      if (
        this.name === "recordingChunks" &&
        (window as unknown as { failAudio: boolean }).failAudio
      )
        throw new DOMException(
          "QA audio quota exhaustion",
          "QuotaExceededError",
        );
      return original.apply(this, args);
    };
  });
  await choose(page, "Speaking");
  await expect(
    page.getByText("● Recording — saving every 500 ms", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Next question / part" }).click();
  await expect(page.getByText(/^Recording save failed:/)).toBeVisible();
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ielts.journal.work.session")!)
          .questionIndex,
    ),
  ).toBe(0);
  await expect(
    page.getByRole("heading", { name: "Question 1", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { failAudio: boolean }).failAudio = false;
  });
  await page.getByRole("button", { name: "Next question / part" }).click();
  await expect(
    page.getByRole("heading", { name: "Question 2", exact: true }),
  ).toBeVisible();
  const s = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ielts.journal.work.session")!),
  );
  expect(s.recordings).toHaveLength(1);
  expect(s.recordings[0].duration).toBeGreaterThan(0.45);
});

test("RC11 natural Mock audio transition starts at zero despite wall-clock drift", async ({ page }) => {
  await choose(page, "Listening", "mock");
  await expect.poll(() => page.locator("audio").evaluate((e) => (e as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await page.locator("audio").evaluate((e) => {
    const a = e as HTMLAudioElement;
    const s = JSON.parse(localStorage.getItem("ielts.journal.ielts.session")!);
    const originalNow = Date.now;
    const delta = s.startedAt + (a.duration + 5) * 1000 - originalNow();
    Date.now = () => originalNow() + delta;
    a.currentTime = a.duration - 0.1;
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ielts.journal.ielts.session")!).audioIndex)).toBe(1);
  await expect.poll(() => page.locator("audio").evaluate((e) => {
    const a = e as HTMLAudioElement;
    return !a.paused && a.currentTime > 0 && a.currentTime < 2;
  })).toBe(true);
});
