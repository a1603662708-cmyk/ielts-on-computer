export async function extractText(
  file: File,
): Promise<{ text: string; warnings: string[] }> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "json" || ext === "md")
    return { text: await file.text(), warnings: [] };
  if (ext === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    return {
      text: result.value,
      warnings: [
        "DOCX layout, tables and images need manual verification.",
        ...result.messages.map((m) => m.message),
      ],
    };
  }
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
    const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const pdf = await loading.promise;
    const pages: string[] = [];
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item
                ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                : "",
            )
            .join(""),
        );
      }
    } finally {
      await loading.destroy();
    }
    const text = pages.join("\n\n");
    return {
      text,
      warnings: [
        text.trim()
          ? "PDF reading order, columns, diagrams and numbering require manual confirmation."
          : "No selectable text found. This may be a scanned PDF. OCR is not implemented; enter the text manually or attach page images.",
      ],
    };
  }
  throw new Error(
    "Use PDF, DOCX, TXT or JSON for text extraction. Images and audio are attached as local media.",
  );
}
