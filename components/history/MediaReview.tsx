"use client";
import { useEffect, useState } from "react";
import { resolveAsset } from "@/storage/db";
export function AudioReview({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let value = "";
    let active = true;
    void resolveAsset(url)
      .then((u) => {
        value = u;
        if (active) setSrc(u);
        else if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      })
      .catch((e) => setError(String(e)));
    return () => {
      active = false;
      if (value.startsWith("blob:")) URL.revokeObjectURL(value);
    };
  }, [url]);
  return (
    <div className="my-4">
      <p>{label}</p>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        src && <audio src={src} controls preload="metadata" />
      )}
    </div>
  );
}
