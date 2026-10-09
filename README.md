# IELTS Local Computer Test Simulator

Local-first extension of [aknahin/ielts-on-computer](https://github.com/aknahin/ielts-on-computer), based on commit `fe96c87483d59d69556ec94e22a7607c89cc5294`. The original question renderers, Reading passage annotations, split pane, navigation, options and JSON setup routes are retained and extended. MIT license and upstream attribution are preserved.

## Start

Requires Node.js 22.12+ for development. Tested on macOS Apple Silicon with Node 26.

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4173**. This is a loopback-only static file server, not an application backend. Use the same hostname and port each time to access the same browser storage.

For development: `npm run dev -- --hostname 127.0.0.1` (port 3000, a separate browser storage origin).

The built **IELTS Simulator.app** embeds the static site and runs without Node, Docker, a database server or a background service. `npm run build:mac` builds the Apple Silicon app using Tauri 2; see `docs/LOCAL-GUIDE.zh-CN.md` for exact paths and Rust setup.

## Features

- Listening and Academic Reading: original question renderers, strict configurable answer matching, 40-question raw score and estimated band, annotations, notes, flags, independent Reading panes, per-question navigation, volume and settings.
- Practice: pause, untimed objective/Writing sessions, select one passage/part, inspect answer key, replay and change audio speed, re-record Speaking.
- Mock: no practice controls or answer reveal, continuous audio, persisted clock and playback recovery. Full Mock moves Listening → Reading → Writing without revealing intermediate results. Speaking is separate.
- Writing: two tasks, one 60-minute timer, images/graphs, word counts, local autosave, spellcheck/autocorrect disabled, TXT/Markdown export. No fabricated band.
- Speaking: genuine MediaRecorder capture, per-question recordings, 1-minute preparation and 2-minute Part 2, playback, download, practice deletion/re-recording. No fabricated band.
- Library: v2 metadata schema, v1 question/answer compatibility, local media in IndexedDB, portable ZIP export/import with book/test/section folders.
- Import: PDF selectable text, DOCX text, TXT/JSON, image/audio associations; editable structured preview and explicit human confirmation. **No OCR**, no automatic AI interpretation, no copyrighted papers included.
- Persistent History and Mistakes: original answers, correct answers, original passage/question, notes, highlights, essays and recordings; filters and question-type error rates.

## Tests

```sh
npm run check       # ESLint, strict TypeScript, unit tests, production build
npx playwright install chromium
npm run test:e2e    # isolated browser profiles; does not touch your exam history
npm run build:mac   # Tauri Apple Silicon bundle
```

Playwright uses synthetic microphone input to exercise MediaRecorder. A separate native-app acceptance check used the actual Mac microphone, verified playback and native file export, and confirmed persistence after quitting/reopening.

## Data and import

Read [the local guide](docs/LOCAL-GUIDE.zh-CN.md), [v2 format](docs/FORMAT-V2.md), and the retained [upstream v1 format](docs/FORMAT.md). `public/demo/metadata.json` and `library/Original-Demo/Test-1/` contain original demonstration content. The short locally synthesized demo audio is for exercising the interface, not a representative full-length listening paper.

IndexedDB stores exams, media, history and results. A small synchronous recovery journal protects last-keystroke state on immediate refresh; no binary recordings are placed in localStorage. Preferences also use localStorage. Storage failures are surfaced in the interface. Browser and native-app databases are separate; move tests with the portable ZIP export. Clearing site data removes local work.

## Limitations

- Importing an arbitrary PDF is semi-manual; layout, types, answer keys and images must be checked. Scans need manual transcription or separate OCR outside this app.
- Writing/Speaking evaluation providers are interfaces only; there is no default AI evaluation or official band score.
- An offline app cannot prevent OS clock changes or deliberate editing of its storage. The timer uses monotonic time while open and detects clock rollback on recovery. This is a simulator, not a secure examination platform.
- A crashed/force-quit recorder can lose its final, not-yet-emitted chunk (roughly one second). Already saved recording chunks remain. Microphone recording cannot continue while the app is closed.
- Browser extensions can override text-field behavior. Use the native app or a clean browser profile for mock writing.
- The local macOS build is ad-hoc signed, not Apple-notarized for public distribution.
- Estimated band tables vary by paper; short tests are scaled and explicitly labelled. Adjust `config/bands.json` as needed.

See `docs/ACCEPTANCE.md` for actual checks and known dependency advisories.
