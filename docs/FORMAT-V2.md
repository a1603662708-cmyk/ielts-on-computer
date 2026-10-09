# Local library format v2

Runtime validation: `types/exam.ts` plus the retained `lib/schema.ts`. Every paper is data-driven. There is no question bank embedded in a React page.

```json
{
  "formatVersion": 2,
  "id": "my-book-19-test-1",
  "book": "Cambridge IELTS 19",
  "test": 1,
  "module": "Academic",
  "title": "My lawfully held Test 1",
  "createdAt": 1791532800000,
  "sections": {}
}
```

The example above is metadata only, not a usable test. Add at least one real section. Use the original demo as a complete structural example. All four sections are optional individually; Full Mock requires complete Listening, Reading and Writing.

## Listening / Reading

`sections.reading` and `sections.listening` contain `{ "paper": <v1 questions>, "key": <v1 answers> }`. The original `docs/FORMAT.md` describes the six base renderer types. Enhancements:

- `questionType`: optional descriptive subtype, used for mistake filters (e.g. `matching-headings`, `map-labelling`, `flow-chart-completion`).
- `image`, `imageAlt`: optional group diagram/map/plan visual. Use the importer to store the image locally. Labels on the image correspond to question prompts or letter choices below it.
- `body.kind = "flow"`, `body.steps = ["Start", "Filter through {{7}}", "Collect sample"]`: flow-chart nodes with arrows and inline answer boxes.
- Audio entries use `{ "part": 1, "url": "asset:<id>" }`. One recording may cover the whole test; four recordings can be assigned to Parts 1–4. The preflight adds decoded durations. Local audio URL references survive refresh through IndexedDB Blob resolution.
- `key.normalization = { "trimWhitespace": true, "caseInsensitive": true }`. Spelling and punctuation remain significant; no automatic article removal. `answers["1"] = ["colour", "color"]` accepts either spelling. Spaced slash alternatives are supported for v1 compatibility.
- Multi-select answers are stored as an array on the first question in the range; scoring uses one-to-one matching and awards a mark for each matched answer. A duplicate cannot score twice.

Mapping of question formats:

| IELTS format | Renderer / body |
|---|---|
| Single choice / multiple choices | `mcq` / `mcq-multi` |
| True / False / Not Given | `tf-ng` |
| Yes / No / Not Given | `yn-ng` |
| Headings / information / features / sentence endings | `matching` |
| Form / notes / summary / sentences / short answer | `gap` with text, notes, list or standalone prompts |
| Table | `gap` with `body.kind: table` |
| Flow chart | `gap` with `body.kind: flow` |
| Map / plan / diagram | Group `image` plus `gap` or `matching` labels |

Questions and parts must have unique numbers. Full Mock needs Listening Parts 1–4, Reading Passages 1–3 and question numbers 1–40 with complete keys in each objective section.

## Writing

`sections.writing` contains `title`, `durationSeconds` and a two-item `tasks` array. Each task has `prompt`, optional `image`, and `minWords` (150 / 250). Mock always uses one shared 3600-second clock. Task prompts and all visual types (charts, tables, maps, processes, mixed diagrams) can be supplied as text plus an image.

## Speaking

`sections.speaking` contains `title`, `part1: string[]`, `cueCard: string` and `part3: string[]`. The simulator records Part 1 and Part 3 questions separately. Part 1 and Part 3 each have a five-minute section budget; question slots divide this budget evenly. Part 2 has a 60-second note preparation phase followed by 120 seconds of speech. You can advance early. Mock does not allow a previously captured answer to be replaced.

## Portable ZIP

Use **Export test + media ZIP**. The archive contains:

```
Book/Test-1/metadata.json
Book/Test-1/reading/section.json
Book/Test-1/listening/section.json
Book/Test-1/writing/section.json
Book/Test-1/speaking/section.json
Book/Test-1/assets.json
Book/Test-1/assets/media-0
...
```

Media refs are remapped on import. A raw JSON file containing `asset:` IDs alone is not portable across browsers/apps; export ZIP to include bytes. ZIP transfers the test, not exam history. Export essays and recordings individually from History.
