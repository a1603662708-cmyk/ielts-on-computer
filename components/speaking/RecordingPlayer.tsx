"use client";
import { useState, useEffect } from "react";
import type { Recording } from "@/exam/workStore";
import { downloadFile } from "@/storage/download";
import { getAsset, resolveAsset } from "@/storage/db";
export function RecordingPlayer({ entry }: { entry: Recording }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let url = "";
    void resolveAsset(entry.asset)
      .then((u) => {
        url = u;
        if (alive) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch((e) => setError(String(e)));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry.asset, entry.duration]);
  return (
    <div className="my-3">
      <p className="text-sm">
        Part {entry.part} · {entry.duration.toFixed(1)}s ·{" "}
        {new Date(entry.startedAt).toLocaleTimeString()}
        {entry.interrupted ? " · Interrupted" : ""}
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        url && (
          <>
            <audio key={url} controls src={url} preload="none" />
            <button
              className="text-sm underline"
              onClick={() => {
                void getAsset(entry.asset)
                  .then((blob) =>
                    downloadFile(
                      blob,
                      `speaking-${entry.id}.${blob.type.includes("mp4") ? "m4a" : "webm"}`,
                    ),
                  )
                  .catch((e) => setError(String(e)));
              }}
            >
              Download recording
            </button>
          </>
        )
      )}
    </div>
  );
}
