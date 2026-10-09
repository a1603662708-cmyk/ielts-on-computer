import type { Passage } from "@/lib/schema";
import type { Session } from "@/lib/store";
import { tokenize, coverageSet } from "@/lib/words";
export function ReviewPassage({
  passage,
  part,
  session,
}: {
  passage: Passage;
  part: number;
  session: Session;
}) {
  const highlighted = coverageSet(
    session.highlights.filter((h) => (h.part ?? 1) === part),
  );
  const notes = session.notes.filter((n) => (n.part ?? 1) === part);
  return (
    <div className="my-4">
      <h4 className="font-bold">{passage.title}</h4>
      {tokenize(passage.paragraphs).paragraphs.map((p, i) => (
        <p className="my-3" key={i}>
          {p.label && <strong>{p.label} </strong>}
          {p.tokens.map((t, j) => (
            <span
              key={j}
              className={!t.space && highlighted.has(t.index) ? "w-hl" : ""}
              title={
                notes.find((n) => n.start <= t.index && n.end >= t.index)?.text
              }
            >
              {t.text}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
