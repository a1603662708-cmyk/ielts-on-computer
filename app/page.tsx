import Link from "next/link";

const CARDS = [
  {
    href: "/setup/listening",
    title: "Listening",
    detail: "4 parts · 40 questions · ~34 minutes",
    blurb:
      "Recordings play straight through, one part after another. They cannot be paused, rewound or replayed.",
  },
  {
    href: "/setup/reading",
    title: "Reading",
    detail: "3 passages · 40 questions · 60 minutes",
    blurb:
      "Passage on the left, questions on the right. Highlight text and make notes as you read.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">IELTS on computer</h1>
        <p className="mt-2 text-[var(--muted)]">
          A practice harness that mirrors the real test player. Choose a test, load your question
          and answer files, then sit it under exam conditions.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-6 transition-colors hover:border-[var(--border-strong)]"
          >
            <h2 className="text-xl font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">{card.detail}</p>
            <p className="mt-4 flex-1 text-sm leading-relaxed">{card.blurb}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)]">
              Load a test
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-[var(--muted)]">
        Question and answer files are plain JSON. See{" "}
        <code className="rounded bg-[var(--bg-panel)] px-1.5 py-0.5">docs/FORMAT.md</code> for the
        spec, and <code className="rounded bg-[var(--bg-panel)] px-1.5 py-0.5">samples/</code> for
        two complete Cambridge tests you can use as templates.
      </p>
    </main>
  );
}
