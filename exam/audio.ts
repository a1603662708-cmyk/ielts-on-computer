import type { Test } from "@/lib/schema";
import { resolveAsset } from "@/storage/db";
export async function prepareAudio(test: Test): Promise<Test> {
  if (test.type !== "listening") return test;
  if (!test.audio?.length)
    throw new Error("Attach a recording before starting Listening.");
  const audio: NonNullable<Test["audio"]> = [];
  for (const track of test.audio) {
    const url = await resolveAsset(track.url);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const element = new Audio();
        element.preload = "auto";
        const cleanup = () => {
          clearTimeout(timeout);
          element.removeAttribute("src");
          element.load();
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error(`Audio preflight timed out: Part ${track.part}`));
        }, 30000);
        element.oncanplaythrough = () => {
          const d = element.duration;
          cleanup();
          if (Number.isFinite(d) && d > 0) resolve(d);
          else reject(new Error("Invalid audio duration"));
        };
        element.onerror = () => {
          cleanup();
          reject(
            new Error(
              `Cannot play Part ${track.part}. Check the attached audio format.`,
            ),
          );
        };
        element.src = url;
        element.load();
      });
      audio.push({ ...track, duration });
    } finally {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
  }
  return { ...test, audio };
}
