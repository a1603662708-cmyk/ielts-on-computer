"use client";
import type { ReactNode } from "react";
import { downloadFile } from "@/storage/download";
export function DownloadLink({
  href,
  filename,
  children,
  className,
}: {
  href: string;
  filename: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      download={filename}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        void fetch(href)
          .then((r) => {
            if (!r.ok) throw new Error("File could not be loaded.");
            return r.blob();
          })
          .then((blob) => downloadFile(blob, filename))
          .catch((error) => window.alert(`Download failed: ${String(error)}`));
      }}
    >
      {children}
    </a>
  );
}
