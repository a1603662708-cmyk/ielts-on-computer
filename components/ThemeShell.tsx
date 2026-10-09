"use client";

import { useEffect } from "react";
import { hydrateStore, useTestStore } from "@/lib/store";

/**
 * Applies the stored contrast and text-size preferences to <html>, and
 * recovers an interrupted run. Both happen in an effect rather than during
 * render so server and client markup match on first paint.
 */
export function ThemeShell({ children }: { children: React.ReactNode }) {
  const contrast = useTestStore((s) => s.contrast);
  const textSize = useTestStore((s) => s.textSize);

  useEffect(() => {
    void hydrateStore();
    const id = setInterval(() => useTestStore.getState().checkpoint(), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.contrast = contrast;
    document.documentElement.dataset.textsize = textSize;
  }, [contrast, textSize]);

  return <>{children}</>;
}
