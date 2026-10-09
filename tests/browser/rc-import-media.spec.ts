import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { zipSync, strToU8 } from "fflate";
const demo = JSON.parse(fs.readFileSync("public/demo/metadata.json", "utf8"));
for (const ext of ["mp3", "m4a", "wav"])
  test(`IM audio ${ext} uploads, maps, persists and plays in exam`, async ({
    page,
  }) => {
    const data = structuredClone(demo);
    data.id = `audio-${ext}`;
    data.book = `Original ${ext} import`;
    await page.goto("/import");
    await page.getByLabel("Test JSON").fill(JSON.stringify(data));
    await page
      .getByLabel("Source files")
      .setInputFiles(`tests/fixtures/audio.${ext}`);
    await page.getByRole("button", { name: "Attach media to JSON" }).click();
    await expect(page.getByLabel("Test JSON")).toHaveValue(/asset:/);
    await page.getByRole("button", { name: "Validate & preview" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save to local Library" }).click();
    await expect(
      page.getByText("Saved to Library.", { exact: false }),
    ).toBeVisible();
    await page.goto("/");
    await page
      .locator("section.local-row")
      .filter({ hasText: data.book })
      .getByRole("button", { name: "Choose test →" })
      .click();
    await page.getByRole("button", { name: "Listening", exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator("audio")
          .evaluate((e) => (e as HTMLAudioElement).currentTime),
      )
      .toBeGreaterThan(1);
    await page.reload();
    await expect
      .poll(() =>
        page
          .locator("audio")
          .evaluate((e) => (e as HTMLAudioElement).currentTime),
      )
      .toBeGreaterThan(1);
  });
for (const ext of ["txt", "docx"])
  test(`IM ${ext} extraction edited with real key becomes playable Reading`, async ({
    page,
  }) => {
    const source =
      "Original Passage\nThe garden opens in June.\n1. In which month does the garden open?";
    const buffer =
      ext === "txt"
        ? Buffer.from(source)
        : Buffer.from(
            zipSync({
              "word/document.xml": strToU8(
                '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
                  source
                    .split("\n")
                    .map((s) => `<w:p><w:r><w:t>${s}</w:t></w:r></w:p>`)
                    .join("") +
                  "</w:body></w:document>",
              ),
            }),
          );
    await page.goto("/import");
    await page.getByLabel("Source files").setInputFiles({
      name: `original.${ext}`,
      mimeType: "application/octet-stream",
      buffer,
    });
    await page.getByRole("button", { name: "Create section draft" }).click();
    await expect(page.getByLabel("Test JSON")).toHaveValue(/"reading"/);
    const data = JSON.parse(await page.getByLabel("Test JSON").inputValue());
    data.sections.reading.key.answers = { "1": "June" };
    data.id = `text-${ext}`;
    await page.getByLabel("Test JSON").fill(JSON.stringify(data));
    await page.getByRole("button", { name: "Validate & preview" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save to local Library" }).click();
    await expect(
      page.getByText("Saved to Library.", { exact: false }),
    ).toBeVisible();
    await page.goto("/");
    await page
      .locator("section.local-row")
      .filter({ hasText: data.book })
      .getByRole("button", { name: "Choose test →" })
      .click();
    await page.getByRole("button", { name: "Reading", exact: true }).click();
    await page
      .getByLabel("Answer for question 1", { exact: true })
      .fill("June");
    await page.reload();
    await expect(
      page.getByLabel("Answer for question 1", { exact: true }),
    ).toHaveValue("June");
  });
test("IM unknown audio references and missing assets fail preflight without starting clock", async ({
  page,
}) => {
  const data = structuredClone(demo);
  data.id = "missing-asset";
  data.sections.listening.paper.audio[0].url = "asset:does-not-exist";
  await page.goto("/import");
  await page.getByLabel("Test JSON").fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save to local Library" }).click();
  await expect(
    page.getByText("Saved to Library.", { exact: false }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Choose test →" }).last().click();
  await page.getByRole("button", { name: "Listening", exact: true }).click();
  await expect(page.locator("p.error")).toContainText("Missing local file");
});

test("IM two-column PDF and headers warn, corrected key saves a real Reading exam", async ({
  page,
}) => {
  const stream =
    "BT /F1 12 Tf 40 770 Td (QA HEADER 2026) Tj 0 -40 Td (Original passage. The garden opens in June.) Tj 290 0 Td (Tours take place on Monday.) Tj -290 -80 Td (1. When does the garden open?) Tj 0 -30 Td (2. On what day are tours held?) Tj 0 -500 Td (QA FOOTER page 1) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  await page.goto("/import");
  await page.getByLabel("Source files").setInputFiles({
    name: "columns.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf),
  });
  await expect(
    page.getByText(
      "PDF reading order, columns, diagrams and numbering require manual confirmation.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create section draft" }).click();
  await expect(page.getByLabel("Test JSON")).toHaveValue(/"reading"/);
  const data = JSON.parse(await page.getByLabel("Test JSON").inputValue());
  data.sections.reading.key.answers = { "1": "June", "2": "Monday" };
  await page.getByLabel("Test JSON").fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(
    page.getByRole("button", { name: "Save to local Library" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save to local Library" }).click();
  await expect(
    page.getByText("Saved to Library.", { exact: false }),
  ).toBeVisible();
  await page.goto("/");
  await page
    .locator("section.local-row")
    .filter({ hasText: data.book })
    .getByRole("button", { name: "Choose test →" })
    .click();
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  await page.getByLabel("Answer for question 1", { exact: true }).fill("June");
  await page
    .getByLabel("Answer for question 2", { exact: true })
    .fill("Monday");
  await page.reload();
  await expect(
    page.getByLabel("Answer for question 2", { exact: true }),
  ).toHaveValue("Monday");
});
test("IM uploaded image remains visible after saved test reload", async ({
  page,
}) => {
  const data = structuredClone(demo);
  data.id = "image-test";
  data.book = "QA Image";
  await page.goto("/import");
  await page.getByLabel("Test JSON").fill(JSON.stringify(data));
  await page
    .getByLabel("Source files")
    .setInputFiles("src-tauri/icons/icon.png");
  await page.getByRole("button", { name: "Attach media to JSON" }).click();
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save to local Library" }).click();
  await expect(
    page.getByText("Saved to Library.", { exact: false }),
  ).toBeVisible();
  await page.goto("/");
  await page
    .locator("section.local-row")
    .filter({ hasText: "QA Image" })
    .getByRole("button", { name: "Choose test →" })
    .click();
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  await expect(page.getByAltText("icon.png")).toBeVisible();
  await page.reload();
  await expect
    .poll(() =>
      page
        .getByAltText("icon.png")
        .evaluate((e) => (e as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});
