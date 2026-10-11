import { test, expect, type Page } from "@playwright/test";
import type {
  RecordingSessionRecord,
  RecordingChunk,
} from "@/storage/recording-types";
type QAWindow = Window & { qaEmitted: Promise<string>[] };
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("ielts-local-v2");
      q.onsuccess = () => r(q.result);
    });
    const all = <T>(s: string) =>
      new Promise<T[]>((r) => {
        const q = db.transaction(s).objectStore(s).getAll();
        q.onsuccess = () => r(q.result);
      });
    const sessions = (
        await all<RecordingSessionRecord>("recordingSessions")
      ).sort((a, b) => a.startedAt - b.startedAt),
      chunks = await all<RecordingChunk>("recordingChunks");
    db.close();
    const hash = async (b: Blob) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await b.arrayBuffer()),
        ),
      ).join(",");
    return {
      sessions,
      chunks: await Promise.all(
        chunks.map(async (c) => ({
          sessionId: c.sessionId,
          sequence: c.sequence,
          hash: await hash(c.blob),
          bytes: c.blob.size,
        })),
      ),
      emitted: JSON.parse(
        localStorage.getItem("qa.emitted") || "[]",
      ) as { sessionId: string; hash: string }[],
    };
  });
}
for (const backend of ["webm", "pcm"])
  for (const action of ["stop", "next", "submit", "navigate"])
    test(`DUR ${backend} ${action}: every emitted sample is committed before leaving`, async ({
      page,
    }) => {
      if (backend === "pcm")
        await page.addInitScript(() =>
          Object.defineProperty(navigator, "userAgent", {
            get: () => "AppleWebKit Safari QA",
          }),
        );
      await page.addInitScript(() => {
        (window as unknown as QAWindow).qaEmitted = [];
        const capture = (b: Blob) => {
          const sessionId = JSON.parse(localStorage.getItem("ielts.journal.work.session")!).recordingId;
          (window as unknown as QAWindow).qaEmitted.push(
            b
              .arrayBuffer()
              .then((b) => crypto.subtle.digest("SHA-256", b))
              .then((h) => {
                const hash = Array.from(new Uint8Array(h)).join(",");
                const prior = JSON.parse(
                  localStorage.getItem("qa.emitted") || "[]",
                );
                prior.push({ sessionId, hash });
                localStorage.setItem("qa.emitted", JSON.stringify(prior));
                return hash;
              }),
          );
        };
        const start = MediaRecorder.prototype.start;
        MediaRecorder.prototype.start = function (...args) {
          this.addEventListener("dataavailable", (e) => {
            if (e.data.size) capture(e.data);
          });
          return start.apply(this, args);
        };
        const Original = AudioWorkletNode;
        window.AudioWorkletNode = class extends Original {
          constructor(...args: ConstructorParameters<typeof AudioWorkletNode>) {
            super(...args);
            this.port.addEventListener("message", ({ data }) => {
              if (data.buffer) capture(new Blob([data.buffer]));
            });
          }
        };
      });
      await page.goto("/");
      await page.getByRole("button", { name: "Choose test →" }).click();
      await page.getByRole("button", { name: "Speaking", exact: true }).click();
      await expect(
        page.getByText("● Recording — saving every 500 ms", { exact: true }),
      ).toBeVisible();
      await expect.poll(async () => (await snapshot(page)).chunks.length).toBeGreaterThanOrEqual(3);
      if (action === "stop")
        await page
          .getByRole("button", { name: "Stop recording", exact: true })
          .click();
      if (action === "next")
        await page
          .getByRole("button", { name: "Next question / part" })
          .click();
      if (action === "submit") {
        await page
          .getByRole("button", { name: "Options", exact: true })
          .click();
        await page
          .getByRole("menuitem", { name: "Submit test", exact: true })
          .click();
        await page.getByRole("button", { name: "Save and finish" }).click();
      }
      if (action === "navigate") {
        // Real same-origin anchor navigation, captured before React handles it.
        await page.evaluate(() => {
          const a = document.createElement("a");
          a.href = "/";
          a.textContent = "QA leave";
          document.body.append(a);
          a.click();
        });
        await expect(
          page.getByRole("heading", { name: "IELTS Local Test Simulator" }),
        ).toBeVisible();
      }
      await expect
        .poll(async () => (await snapshot(page)).sessions[0]?.status)
        .toBe("completed");
      const s = await snapshot(page);
      expect(s.sessions[0].mimeType).toContain(
        backend === "pcm" ? "wav" : "webm",
      );
      const chunks = s.chunks
        .filter((c) => c.sessionId === s.sessions[0].sessionId)
        .sort((a, b) => a.sequence - b.sequence);
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks.map((c) => c.hash)).toEqual(
        s.emitted.filter((c) => c.sessionId === s.sessions[0].sessionId).map((c) => c.hash),
      );
      expect(chunks.reduce((n, c) => n + c.bytes, 0)).toBe(s.sessions[0].bytes);
      if (action === "stop") {
        const audio = page.locator("audio").first();
        await audio.evaluate(async (a: HTMLAudioElement) => a.play());
        await expect
          .poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime))
          .toBeGreaterThan(0.1);
        await expect
          .poll(() =>
            audio.evaluate((a: HTMLAudioElement) =>
              Number.isFinite(a.duration),
            ),
          )
          .toBe(true);
        await page
          .getByRole("button", { name: "Delete recording", exact: true })
          .click();
        await expect
          .poll(async () => (await snapshot(page)).sessions.length)
          .toBe(0);
        expect((await snapshot(page)).chunks).toEqual([]);
        await page
          .getByRole("button", { name: "Start recording / retry microphone" })
          .click();
        await expect(
          page.getByText("● Recording — saving every 500 ms", { exact: true }),
        ).toBeVisible();
        await page.waitForTimeout(650);
        await page
          .getByRole("button", { name: "Stop recording", exact: true })
          .click();
        await expect
          .poll(async () => (await snapshot(page)).sessions[0]?.status)
          .toBe("completed");
      }
    });
