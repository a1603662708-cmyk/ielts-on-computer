"use client";

import { Fragment } from "react";
import type { Body } from "@/lib/schema";
import { GapInput } from "./parts";

/**
 * Renders a body block, turning every `{{n}}` placeholder into an inline
 * answer input. This is what lets notes, tables and flow charts reuse the
 * `gap` group type instead of needing one group type each.
 */
export function BodyBlock({ body }: { body: Body }) {
  switch (body.kind) {
    case "text":
      return (
        <div className="space-y-3">
          {body.lines.map((line, i) => (
            <p key={i} className="leading-loose">
              <Interpolated text={line} />
            </p>
          ))}
        </div>
      );

    case "list":
      return body.ordered ? (
        <ol className="list-decimal space-y-2 pl-6 leading-loose">
          {body.items.map((item, i) => (
            <li key={i}>
              <Interpolated text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-2 pl-6 leading-loose">
          {body.items.map((item, i) => (
            <li key={i}>
              <Interpolated text={item} />
            </li>
          ))}
        </ul>
      );

    case "notes":
      return (
        <div className="rounded border border-[var(--border)] p-4">
          {body.heading && <p className="mb-3 font-bold">{body.heading}</p>}
          <ul className="space-y-2 leading-loose">
            {body.items.map((item, i) => (
              <li key={i} style={{ paddingLeft: `${item.indent * 1.5}rem` }}>
                {item.indent > 0 && <span aria-hidden className="mr-2">•</span>}
                <Interpolated text={item.text} />
              </li>
            ))}
          </ul>
        </div>
      );

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {body.headers.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 py-2 font-bold"
                  >
                    <Interpolated text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className="border border-[var(--border)] px-3 py-2 align-top leading-loose"
                    >
                      <Interpolated text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/**
 * Splits text on `{{n}}` and newlines, substituting inputs and line breaks.
 * Everything else renders verbatim.
 */
function Interpolated({ text }: { text: string }) {
  const withGaps = text.split(/(\{\{\d+\}\})/g);

  return (
    <>
      {withGaps.map((chunk, i) => {
        const gap = chunk.match(/^\{\{(\d+)\}\}$/);
        if (gap) {
          return <GapInput key={i} n={Number(gap[1])} inline width="9rem" />;
        }
        // Preserve authored line breaks inside a single cell or note item.
        return (
          <Fragment key={i}>
            {chunk.split("\n").map((line, j, all) => (
              <Fragment key={j}>
                {line}
                {j < all.length - 1 && <br />}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
