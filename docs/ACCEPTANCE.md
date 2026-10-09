# Acceptance record — 2026-10-09

## Foundation and sequence

The requested upstream repository was cloned, inspected, installed and launched before extension. Initial lint, strict TypeScript and production build passed. Upstream provided no test suite. Initial defects and retained components are recorded in INITIAL-AUDIT.md.

Phases implemented in requested order: upstream recovery → unified schema/storage/scoring → Listening → Reading → Writing → Speaking → Library → Import → Full Mock → History/Mistakes → regression/fixes → native packaging. Phase logs are retained in the workspace `work/phase-*.log`; failed gates were corrected and covered by the final combined checks. The source was not rewritten into another stack.

## Verified behavior

- Objective scoring: configured alternatives, case/whitespace handling, rejected misspellings and added articles, partial multiple-selection credit, duplicate protection, overlapping accepted alternatives.
- Timer: sleep/elapsed deadlines, audio track boundaries, monotonic behavior, clock rollback detection, expired sessions retained for automatic submission.
- Persistence: ordered IndexedDB writes and Blob recovery, synchronous last-input journal, idempotent submission, locked submitted answers.
- Navigation: boundaries, part mapping, current question, scoped passage annotations.
- Browser flows: Reading answer/flag/selection highlight/note, independent scrolling, refresh and persisted results; Writing task switch/count/spellcheck/export; actual HTML audio playback and Practice controls; Full Mock L→R→W with hidden intermediate scores; standalone expiry; MediaRecorder recording/playback/save; local import and narrow layout.
- Additional browser edges: failed audio preflight, denied microphone, rollback on recovery, Speaking prep→record transition, portable media ZIP round trip, PDF extraction, DOCX extraction, image/OCR warning, Listening annotations across reload.

Automated microphone tests use Chromium's synthetic input device to exercise the real MediaRecorder pipeline, not a recording substitute in the product.

## Native Mac verification

Apple Silicon (`aarch64-apple-darwin`) Tauri app built and actually launched from its app bundle. Static assets load through `tauri://localhost` with no server process. Actual Mac microphone captured ~15.4 seconds, generated a 387 KB WebM file, played through the native WebKit audio control, and exported through a native Save dialog into `work/native-recording-check.webm`. The app was quit and relaunched; the Speaking record remained visible in History.

The original-demo recording in desktop History is an acceptance run, not an IELTS result. No official Speaking or Writing band is generated.

## Boundaries

Tests exercise timing with short intervals and stored deadlines, rather than waiting through a real two-and-a-half-hour paper. Manual UX inspection covered the Reading layout and native application. No claim of official IELTS equivalence or inviolable offline anti-cheat is made.

OCR, automatic interpretation of arbitrary layouts, Writing PDF export, human/AI Writing and Speaking assessment, public Apple notarization and cloud synchronization are not implemented. Import remains an explicitly confirmed semi-manual workflow.

## Dependencies and review assistance

Next.js upgraded within major version to 16.4.0 and Sharp to 0.35.5 after audit identified vulnerabilities in the cloned versions. Final production dependency audit: no critical or high findings; three moderate entries remain in the Mammoth → argparse → sprintf-js dependency chain. The app imports Mammoth's browser build for text extraction; no claim of a completely advisory-free dependency tree is made.

Claude desktop was checked but its account was unavailable, so no Claude review is claimed. Local Ollama qwen3-vl:8b-instruct produced an auxiliary test checklist; suggestions conflicting with requirements (silently skipping corrupt audio, assuming recording can continue while closed) were rejected. All test execution, format conversion, speech synthesis, formatting and builds ran locally. The application requires no paid model API.

References: [upstream repository](https://github.com/aknahin/ielts-on-computer), [Tauri static Next.js integration](https://v2.tauri.app/start/frontend/nextjs/), [Tauri macOS bundle configuration](https://v2.tauri.app/distribute/macos-application-bundle/).

## Final gate results

- ESLint: passed, no warnings/errors in project sources.
- TypeScript strict: passed.
- Vitest: **14 tests passed**, 2 test files.
- Playwright: **16 tests passed**, 15.7 seconds in the final run.
- Next.js static production build: passed, 14 routes including 404.
- Tauri Apple Silicon release build: passed; final app approximately **13.51 MiB**.
- Local app signature: verified with `codesign --verify --deep --strict`.

The final source and test changes were checked again after readability formatting and read-only question preview improvements.

Delivery note: the output directory's file-provider metadata interfered with signing a copied bundle. The bundle was signed and verified at its build location instead; `outputs/IELTS Simulator.app` links to that verified bundle. A separate `IELTS-Simulator-macOS.zip` contains the complete signed app for relocation. The final output-directory app link was launched successfully. This packaging workaround does not change app permissions or disable macOS security.
