import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
function textPDF() {
  const text =
    "BT /F1 12 Tf 72 720 Td (A sample passage about a green library.) Tj 0 -25 Td (1. What colour is the library?) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(content.length);
    content += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = content.length;
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(content);
}
test("PDF extraction runs locally and requires manual review", async ({
  page,
}) => {
  await page.goto("/import");
  await page.getByLabel("Source files").setInputFiles({
    name: "original-fixture.pdf",
    mimeType: "application/pdf",
    buffer: textPDF(),
  });
  await expect(page.getByLabel("Extracted text")).toHaveValue(/green library/);
  await expect(
    page.getByText(
      "PDF reading order, columns, diagrams and numbering require manual confirmation.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create section draft" }).click();
  await expect(page.getByLabel("Test JSON")).toHaveValue(/What colour/);
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(page.getByText(/missing answers for 1/)).toBeVisible();
});
test("DOCX text extraction and image attachment do not guess OCR", async ({
  page,
}) => {
  const xml =
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Original passage: a quiet garden.</w:t></w:r></w:p><w:p><w:r><w:t>1. Where is the garden?</w:t></w:r></w:p></w:body></w:document>';
  const buffer = Buffer.from(zipSync({ "word/document.xml": strToU8(xml) }));
  await page.goto("/import");
  await page.getByLabel("Source files").setInputFiles({
    name: "sample.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer,
  });
  await expect(page.getByLabel("Extracted text")).toHaveValue(/quiet garden/);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("Source files")
    .setInputFiles({ name: "diagram.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/OCR is not implemented/)).toBeVisible();
});
test("Listening annotations and notes survive refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose test →" }).click();
  await page.getByRole("button", { name: "Listening", exact: true }).click();
  await page.getByText("Family", { exact: true }).dblclick();
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await expect(
    page.locator(".w-hl").filter({ hasText: "Family" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page
    .getByPlaceholder("Write your notes here. They save automatically.")
    .fill("Check booking number");
  await page.reload();
  await expect(
    page.locator(".w-hl").filter({ hasText: "Family" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Notes/ }).click();
  await expect(
    page.getByPlaceholder("Write your notes here. They save automatically."),
  ).toHaveValue("Check booking number");
});
