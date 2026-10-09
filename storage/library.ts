import { listRecords, saveRecord } from "./db";
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
