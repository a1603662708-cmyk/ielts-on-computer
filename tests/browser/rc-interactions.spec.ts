import { test, expect, type Page } from "@playwright/test";
async function selectWords(page: Page, start: number, end: number) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator(`[data-w="${start}"]`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const a = await page.locator(`[data-w="${start}"]`).boundingBox();
  const b = await page.locator(`[data-w="${end}"]`).boundingBox();
  console.log("bounds", start, end, a, b);
  if (!a || !b) throw new Error("word not visible");
  await page.mouse.move(a.x + 1, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 15 });
  await page.mouse.up();
  console.log(
    "selected",
    await page.evaluate(() => window.getSelection()?.toString()),
  );
}
test("IX annotations across lines, overlap, delete, edit and keyboard modal focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose test →" }).click();
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  await expect(page.locator('[data-w="0"]')).toBeVisible();
  await selectWords(page, 0, 20);
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  console.log(
    "annotations",
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ielts.journal.ielts.session")!)
          .highlights,
    ),
  );
  await expect(page.locator('[data-w="18"]')).toHaveClass(/w-hl/);
  await selectWords(page, 10, 28);
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-w="25"]')).toHaveClass(/w-hl/);
  await page.locator('[data-w="12"]').click();
  await page
    .getByRole("button", { name: "Delete Highlight", exact: true })
    .click();
  await expect(page.locator('[data-w="12"]')).not.toHaveClass(/w-hl/);
  await page.getByRole("button", { name: "New note", exact: true }).click();
  const note = page.getByPlaceholder(
    "Write your notes here. They save automatically.",
  );
  await note.fill("first draft");
  await note.fill("edited note");
  await page.reload();
  await page.getByRole("button", { name: "Notes (1)", exact: true }).click();
  await expect(note).toHaveValue("edited note");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm deleting" }).click();
  await expect(
    page.getByRole("button", { name: "Notes (1)", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Submit test", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Keep working", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("IX last-second answer, double Start and Mock recording cannot be repeated after reload", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/?mode=mock");
  await page.getByRole("button", { name: "Choose test →" }).click();
  await page.getByRole("button", { name: "Reading", exact: true }).dblclick();
  await expect(
    page.getByLabel("Answer for question 1", { exact: true }),
  ).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const jump = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ielts.journal.ielts.session")!).endsAt -
      Date.now() -
      1000,
  );
  await page.clock.fastForward(jump);
  await expect(
    page.getByRole("timer", { name: "Time remaining" }),
  ).toContainText("00:01");
  await page
    .getByLabel("Answer for question 1", { exact: true })
    .selectOption("iv");
  await page.clock.fastForward(1000);
  await expect(
    page.getByRole("heading", { name: "Results", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 / 40", { exact: true })).toBeVisible();
  await page.goto("/history");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.clock.resume();
  await page.goto("/?mode=mock");
  await page.getByRole("button", { name: "Choose test →" }).click();
  await page.getByRole("button", { name: "Speaking", exact: true }).click();
  await expect(
    page.getByText("● Recording — saving every 500 ms", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByText(/This response has already been recorded/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record again", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText(/This response has already been recorded/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record again", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next question / part" }).click();
  await expect(
    page.getByRole("heading", { name: "Question 2", exact: true }),
  ).toBeVisible();
});
