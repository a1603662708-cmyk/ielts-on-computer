"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { coordinateMock } from "@/exam/mock";
export function MockCoordinator() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    void coordinateMock()
      .then((path) => router.replace(path))
      .catch((e) => setError(String(e)));
  }, [router]);
  return (
    <main className="local-shell">
      <h1>Full Mock Test</h1>
      <p>{error || "Saving this section and continuing the exam…"}</p>
      {error && (
        <button onClick={() => window.location.reload()}>Retry recovery</button>
      )}
      <p className="muted">
        Listening → Reading → Writing. Scores are available after all three
        sections.
      </p>
    </main>
  );
}
