# Phase 1 — upstream audit

Base: aknahin/ielts-on-computer, cloned without rewriting; MIT retained.
Stack: Next.js 16.3.3, React 19.2.8, strict TypeScript, Zustand, Zod, Tailwind 4.
2026-10-09: npm ci, localhost startup, ESLint, tsc and production build passed.
Upstream has no test command or test suite. Original Reading demo loaded in the browser.

Reusable: GroupView / BodyBlock / question controls; Passage word-token annotations;
SplitPane; NavBar; OptionsMenu; validation; score report; original JSON setup routes.
Listening template has no playable local audio: needs user audio or original demo audio.

Problems: audio resets on refresh, audio errors silently advance; sessionStorage loses data
on tab close; expired sessions discarded; results memory-only; annotation ranges overlap
between passages; scoring strips articles/punctuation without explicit configuration;
multiple-choice sets are all-or-nothing; no Writing/Speaking/library/import/history.
Home incorrectly refers to Cambridge samples although bundled content is original.

Plan: retain existing components/routes, extend schemas and stores, add IndexedDB,
then Listening, Reading, Writing, Speaking, Library, semi-manual importer, full mock,
history/errors, regression tests, optional native packaging. No copyrighted papers added.
Pure web apps cannot stop an OS clock change or deliberate DevTools tampering; detect
clock rollback and use monotonic elapsed time while open. Disclose the trust boundary.
