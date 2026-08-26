"use client";

import type { Group } from "@/lib/schema";
import { NO_SELECTION, useTestStore } from "@/lib/store";
import { BodyBlock } from "./BodyBlock";
import { ChoiceList, FlagButton, GapInput, Instructions, LETTERS, QuestionShell } from "./parts";

const TF_NG = ["TRUE", "FALSE", "NOT GIVEN"];
const YN_NG = ["YES", "NO", "NOT GIVEN"];

export function GroupView({ group }: { group: Group }) {
  return (
    <section className="border-t border-[var(--border)] py-6 first:border-t-0">
      <Instructions text={group.instructions} />
      {group.intro && <p className="mb-4 font-semibold leading-relaxed">{group.intro}</p>}
      <GroupBody group={group} />
    </section>
  );
}

function GroupBody({ group }: { group: Group }) {
  switch (group.type) {
    case "mcq":
      return (
        <>
          {group.body && (
            <div className="mb-5">
              <BodyBlock body={group.body} />
            </div>
          )}
          {group.questions.map((q) => (
            <QuestionShell key={q.n} n={q.n} prompt={q.prompt}>
              <ChoiceList n={q.n} options={q.options} lettered />
            </QuestionShell>
          ))}
        </>
      );

    case "tf-ng":
    case "yn-ng":
      return (
        <>
          {group.questions.map((q) => (
            <QuestionShell key={q.n} n={q.n} prompt={q.prompt}>
              <ChoiceList
                n={q.n}
                options={group.type === "tf-ng" ? TF_NG : YN_NG}
                lettered={false}
                compact
              />
            </QuestionShell>
          ))}
        </>
      );

    case "gap":
      return (
        <>
          {group.limit && (
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Write {group.limit} for each answer
            </p>
          )}
          {group.body && (
            <div className="mb-5">
              <BodyBlock body={group.body} />
            </div>
          )}
          {/* Questions already rendered as `{{n}}` gaps inside the body only
              need a flag control, not a second input. */}
          {group.questions.map((q) =>
            q.prompt ? (
              <QuestionShell key={q.n} n={q.n}>
                <p className="leading-relaxed">{q.prompt}</p>
                <div className="mt-2">
                  <GapInput n={q.n} />
                </div>
              </QuestionShell>
            ) : null,
          )}
          {group.body && (
            <div className="mt-4 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-sm text-[var(--muted)]">Flag:</span>
              {group.questions.map((q) => (
                <span key={q.n} className="flex items-center gap-0.5 text-sm">
                  <span className="tabular-nums">{q.n}</span>
                  <FlagButton n={q.n} />
                </span>
              ))}
            </div>
          )}
        </>
      );

    case "mcq-multi":
      return <MultiSelect group={group} />;

    case "matching":
      return (
        <>
          {group.body && (
            <div className="mb-5">
              <BodyBlock body={group.body} />
            </div>
          )}
          <div className="mb-5 rounded border border-[var(--border-strong)] bg-[var(--bg-panel)] p-4">
            <p className="mb-2 font-bold">{group.optionsTitle ?? "Options"}</p>
            <ul className="space-y-1">
              {group.options.map((o) => (
                <li key={o.key} className="flex gap-3">
                  <span className="min-w-[2.5rem] shrink-0 font-semibold">{o.key}</span>
                  <span>{o.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {group.examples?.map((ex) => (
            <div key={ex.prompt} className="flex items-baseline gap-3 py-2 text-[var(--muted)]">
              <span className="min-w-[1.75rem] text-right text-sm font-semibold">Example</span>
              <span className="flex-1">{ex.prompt}</span>
              <span className="font-semibold">{ex.key}</span>
            </div>
          ))}

          {group.questions.map((q) => (
            <QuestionShell key={q.n} n={q.n}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex-1 leading-relaxed">{q.prompt}</span>
                <MatchingSelect n={q.n} options={group.options} />
              </div>
            </QuestionShell>
          ))}
        </>
      );
  }
}

function MatchingSelect({
  n,
  options,
}: {
  n: number;
  options: { key: string; text: string }[];
}) {
  const value = useTestStore((s) => {
    const v = s.session?.responses[n];
    return typeof v === "string" ? v : "";
  });
  const answer = useTestStore((s) => s.answer);

  return (
    <select
      aria-label={`Answer for question ${n}`}
      value={value}
      onChange={(e) => answer(n, e.target.value || undefined)}
      className="min-w-[8rem] rounded px-2 py-1.5"
    >
      <option value="">— choose —</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.key}
        </option>
      ))}
    </select>
  );
}

/**
 * "Choose TWO letters" — one selection shared across a range of question
 * numbers, stored against the first number in that range.
 */
function MultiSelect({ group }: { group: Extract<Group, { type: "mcq-multi" }> }) {
  const [from, to] = group.range;
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  const selected = useTestStore((s) => {
    const v = s.session?.responses[from];
    return Array.isArray(v) ? v : NO_SELECTION;
  });
  const answer = useTestStore((s) => s.answer);

  function toggle(letter: string) {
    const next = selected.includes(letter)
      ? selected.filter((l) => l !== letter)
      : [...selected, letter];
    // Ignore a click that would exceed the limit rather than silently
    // dropping an earlier choice.
    if (next.length > group.pick) return;
    answer(from, next.length > 0 ? next.sort() : undefined);
  }

  const remaining = group.pick - selected.length;

  return (
    <div className="py-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 font-bold tabular-nums">
          {from}–{to}
        </span>
        <div className="min-w-0 flex-1">
          <p className="leading-relaxed">{group.prompt}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {remaining > 0
              ? `Choose ${remaining} more.`
              : `${group.pick} of ${group.pick} chosen — deselect one to change your answer.`}
          </p>
          <div className="mt-2 space-y-1">
            {group.options.map((option, i) => {
              const letter = LETTERS[i];
              const checked = selected.includes(letter);
              return (
                <label
                  key={letter}
                  className={`flex cursor-pointer items-start gap-2.5 rounded px-2.5 py-1.5 ${
                    checked ? "bg-[var(--bg-panel)]" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(letter)}
                    className="mt-1"
                  />
                  <span className="font-semibold">{letter}</span>
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 flex-col">
          {numbers.map((n) => (
            <FlagButton key={n} n={n} />
          ))}
        </div>
      </div>
    </div>
  );
}
