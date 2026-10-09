import type { Body, Group } from "@/lib/schema";
import { AssetImage } from "@/components/AssetImage";
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{\{\d+\}\})/g).map((chunk, i) => {
        const n = chunk.match(/^\{\{(\d+)\}\}$/)?.[1];
        return n ? (
          <span
            key={i}
            className="mx-1 inline-block min-w-24 border-b border-current text-center"
          >
            {n} ______
          </span>
        ) : (
          <span className="whitespace-pre-wrap" key={i}>
            {chunk}
          </span>
        );
      })}
    </>
  );
}
function ReferenceBody({ body }: { body: Body }) {
  switch (body.kind) {
    case "text":
      return (
        <div>
          {body.lines.map((l, i) => (
            <p className="my-2" key={i}>
              <Inline text={l} />
            </p>
          ))}
        </div>
      );
    case "list":
      return (
        <ul className="list-disc pl-5">
          {body.items.map((l, i) => (
            <li key={i}>
              <Inline text={l} />
            </li>
          ))}
        </ul>
      );
    case "notes":
      return (
        <div>
          <strong>{body.heading}</strong>
          {body.items.map((item, i) => (
            <p key={i} style={{ paddingLeft: item.indent * 20 }}>
              <Inline text={item.text} />
            </p>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="overflow-auto">
          <table className="review-table">
            <thead>
              <tr>
                {body.headers.map((h, i) => (
                  <th key={i}>
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((c, j) => (
                    <td key={j}>
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "flow":
      return (
        <ol>
          {body.steps.map((s, i) => (
            <li className="text-center my-2" key={i}>
              <div className="border p-3">
                <Inline text={s} />
              </div>
              {i < body.steps.length - 1 && "↓"}
            </li>
          ))}
        </ol>
      );
  }
}
export function QuestionReference({ group }: { group: Group }) {
  return (
    <div className="my-4">
      <p className="whitespace-pre-wrap font-medium">{group.instructions}</p>
      {group.intro && <p className="my-2">{group.intro}</p>}
      {group.image && (
        <AssetImage
          src={group.image}
          alt={group.imageAlt ?? "Question diagram"}
        />
      )}{" "}
      {group.body && <ReferenceBody body={group.body} />}
      {group.type === "gap" && group.limit && (
        <p className="muted">Write {group.limit}.</p>
      )}
      {group.type === "matching" && (
        <div className="notice my-3">
          <strong>{group.optionsTitle ?? "Options"}</strong>
          {group.options.map((o) => (
            <p key={o.key}>
              {o.key}. {o.text}
            </p>
          ))}
        </div>
      )}
      {group.type === "mcq-multi" ? (
        <div>
          <p>
            {group.range.join("–")}. {group.prompt}
          </p>
          {group.options.map((o, i) => (
            <p key={i}>
              {String.fromCharCode(65 + i)}. {o}
            </p>
          ))}
        </div>
      ) : (
        group.questions.map((q) => (
          <div className="my-3" key={q.n}>
            {q.prompt && (
              <p>
                <strong>{q.n}.</strong> {q.prompt}
              </p>
            )}
            {"options" in q &&
              q.options.map((o, i) => (
                <p className="pl-6" key={i}>
                  {String.fromCharCode(65 + i)}. {o}
                </p>
              ))}
            {group.type === "tf-ng" && (
              <p className="muted">TRUE / FALSE / NOT GIVEN</p>
            )}
            {group.type === "yn-ng" && (
              <p className="muted">YES / NO / NOT GIVEN</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
