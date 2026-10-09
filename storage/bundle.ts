import { downloadFile } from "./download";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { getAsset, putAsset } from "./db";
import { parseLibrary, type LibraryTest } from "@/types/exam";
function mediaRefs(test: LibraryTest) {
  const refs = new Set<string>();
  for (const type of ["reading", "listening"] as const) {
    const p = test.sections[type]?.paper;
    p?.audio?.forEach((a) => refs.add(a.url));
    p?.parts.forEach((part) =>
      part.groups.forEach((g) => {
        if (g.image) refs.add(g.image);
      }),
    );
  }
  test.sections.writing?.tasks.forEach((t) => {
    if (t.image) refs.add(t.image);
  });
  return [...refs];
}
function replaceRefs(
  test: LibraryTest,
  refs: Map<string, string>,
): LibraryTest {
  const result = structuredClone(test);
  for (const type of ["reading", "listening"] as const) {
    const p = result.sections[type]?.paper;
    p?.audio?.forEach((a) => {
      a.url = refs.get(a.url) ?? a.url;
    });
    p?.parts.forEach((part) =>
      part.groups.forEach((g) => {
        if (g.image) g.image = refs.get(g.image) ?? g.image;
      }),
    );
  }
  result.sections.writing?.tasks.forEach((t) => {
    if (t.image) t.image = refs.get(t.image) ?? t.image;
  });
  return result;
}
export async function exportLibraryBundle(test: LibraryTest) {
  const root = `${test.book.replace(/[^a-z0-9 -]/gi, "_")}/Test-${test.test}`;
  const files: Record<string, Uint8Array> = {};
  const map = new Map<string, string>();
  const manifest: { ref: string; path: string; mime: string }[] = [];
  for (const [i, ref] of mediaRefs(test).entries()) {
    const blob = ref.startsWith("asset:")
      ? await getAsset(ref)
      : await fetch(ref).then((r) => {
          if (!r.ok) throw new Error(`Cannot export ${ref}`);
          return r.blob();
        });
    const name = `${root}/assets/media-${i}`;
    const portable = `bundle:media-${i}`;
    map.set(ref, portable);
    files[name] = new Uint8Array(await blob.arrayBuffer());
    manifest.push({ ref: portable, path: name, mime: blob.type });
  }
  const portable = replaceRefs(test, map);
  files[`${root}/metadata.json`] = strToU8(JSON.stringify(portable, null, 2));
  files[`${root}/assets.json`] = strToU8(JSON.stringify(manifest));
  for (const [section, value] of Object.entries(portable.sections))
    files[`${root}/${section}/section.json`] = strToU8(
      JSON.stringify(value, null, 2),
    );
  const data = zipSync(files, { level: 1 });
  await downloadFile(
    new Blob([new Uint8Array(data)], { type: "application/zip" }),
    `${test.book}-Test-${test.test}.ielts.zip`,
  );
}
export async function importLibraryBundle(file: File) {
  // Refuse oversized expansion before allocating every decompressed entry.
  let expandedBytes = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      expandedBytes += entry.originalSize;
      if (expandedBytes > 750 * 1024 * 1024)
        throw new Error("Expanded bundle exceeds 750 MB.");
      if (entry.originalSize > 300 * 1024 * 1024)
        throw new Error("An expanded file exceeds 300 MB.");
      return true;
    },
  });
  const metadata = Object.keys(files).find(
    (n) => n.endsWith("/metadata.json") || n === "metadata.json",
  );
  if (!metadata) throw new Error("Bundle is missing metadata.json.");
  const test = parseLibrary(JSON.parse(strFromU8(files[metadata])));
  const manifestPath = metadata.replace("metadata.json", "assets.json");
  if (!files[manifestPath]) throw new Error("Bundle is missing assets.json.");
  const raw: unknown = JSON.parse(strFromU8(files[manifestPath]));
  if (!Array.isArray(raw)) throw new Error("Invalid media manifest.");
  const map = new Map<string, string>();
  for (const item of raw) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.ref !== "string" ||
      typeof item.path !== "string" ||
      typeof item.mime !== "string" ||
      !files[item.path]
    )
      throw new Error("Invalid or missing bundled media.");
    const blob = new Blob([new Uint8Array(files[item.path])], {
      type: item.mime,
    });
    map.set(item.ref, await putAsset(blob));
  }
  return replaceRefs(test, map);
}
