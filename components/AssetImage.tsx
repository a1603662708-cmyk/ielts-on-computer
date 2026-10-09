"use client";
/* Local Blob URLs and static export need a native image element. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { resolveAsset } from "@/storage/db";
export function AssetImage({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let value = "";
    void resolveAsset(src)
      .then((u) => {
        value = u;
        if (alive) setUrl(u);
        else if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      })
      .catch((e) => setError(String(e)));
    return () => {
      alive = false;
      if (value.startsWith("blob:")) URL.revokeObjectURL(value);
    };
  }, [src]);
  return error ? (
    <p role="alert">Image unavailable: {error}</p>
  ) : url ? (
    <img
      src={url}
      alt={alt}
      className="max-h-[65vh] max-w-full object-contain"
    />
  ) : (
    <p>Loading image…</p>
  );
}
