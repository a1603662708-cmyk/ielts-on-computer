import { QuestionReference } from "@/components/questions/QuestionReference";
import type { LibraryTest } from "@/types/exam";
import { AssetImage } from "@/components/AssetImage";
export function PaperPreview({ test }: { test: LibraryTest }) {
  return (
    <div>
      <h2>
        {test.book} / Test {test.test}
      </h2>
      {(["reading", "listening"] as const).map((section) => {
        const entry = test.sections[section];
        return (
          entry && (
            <section key={section}>
              <h3 className="font-bold uppercase">{section}</h3>
              {entry.paper.parts.map((part) => (
                <div className="local-row" key={part.part}>
                  <h4>
                    Part {part.part} — {part.passage?.title}
                  </h4>
                  {part.passage?.paragraphs.map((p, i) => (
                    <p key={i}>
                      {p.label} {p.text}
                    </p>
                  ))}
                  {part.groups.map((group, i) => (
                    <QuestionReference key={i} group={group} />
                  ))}
                </div>
              ))}
            </section>
          )
        );
      })}
      {test.sections.writing?.tasks.map((task, i) => (
        <section className="local-row" key={i}>
          <h3>Writing Task {i + 1}</h3>
          <p className="whitespace-pre-wrap">{task.prompt}</p>
          {task.image && (
            <AssetImage src={task.image} alt="Writing task image" />
          )}
        </section>
      ))}
      {test.sections.speaking && (
        <section className="local-row">
          <h3>Speaking</h3>
          <p>{test.sections.speaking.part1.join("\n")}</p>
          <p className="whitespace-pre-wrap my-5">
            {test.sections.speaking.cueCard}
          </p>
          <p>{test.sections.speaking.part3.join("\n")}</p>
        </section>
      )}
    </div>
  );
}
