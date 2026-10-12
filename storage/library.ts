import { db, flushSaves, listRecords, saveRecord } from "./db";
import { parseLibrary, type LibraryTest } from "@/types/exam";
export async function loadLibrary(): Promise<LibraryTest[]> {
  const saved = (await listRecords<LibraryTest>("library:")).map(parseLibrary);
  if (saved.some((t) => t.id === "original-demo")) return saved;
  const response = await fetch("/demo/metadata.json");
  if (!response.ok)
    throw new Error("Original demonstration could not be loaded.");
  return [parseLibrary(await response.json()), ...saved];
}
export async function saveLibrary(test: LibraryTest) {
  const validated = parseLibrary(test);
  await saveRecord(`library:${validated.id}`, validated);
}

export async function saveFullLibrary(
  test: LibraryTest,
  assets: { ref: string; blob: Blob }[],
) {
  const validated = parseLibrary(test);
  for (const asset of assets)
    if (!asset.ref.startsWith("asset:"))
      throw new Error("Invalid asset reference.");
  await flushSaves();
  const database = await db();
  const transaction = database.transaction(["records", "assets"], "readwrite");
  try {
    for (const asset of assets) {
      await transaction
        .objectStore("assets")
        .put(asset.blob, asset.ref.slice(6));
    }
    await transaction
      .objectStore("records")
      .put(validated, `library:${validated.id}`);
    await transaction.done;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* Already aborted by IndexedDB. */
    }
    await transaction.done.catch(() => {});
    throw error;
  }
}
