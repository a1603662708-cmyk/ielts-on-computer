/**
 * Highlighting and notes (video 3:12–4:16).
 *
 * Rather than doing DOM Range surgery — which breaks on overlapping ranges,
 * doesn't serialise, and fights React's reconciler — a passage is tokenised
 * into word spans with stable global indices. An annotation is then just an
 * integer pair, and rendering is pure derived state.
 */

export type Token = {
  /** Global index across the whole passage; -1 for whitespace runs. */
  index: number;
  text: string;
  /** Whitespace tokens are rendered but are not selectable anchors. */
  space: boolean;
};

export type TokenizedParagraph = {
  label?: string;
  tokens: Token[];
};

export type Annotation = {
  id: string;
  /** Inclusive word-index range. */
  start: number;
  end: number;
};

export type Note = Annotation & { text: string };

/**
 * Splits paragraphs into word/whitespace tokens, numbering words continuously
 * across the whole passage so a range can span paragraph boundaries.
 */
export function tokenize(paragraphs: { label?: string; text: string }[]): {
  paragraphs: TokenizedParagraph[];
  wordCount: number;
} {
  let next = 0;
  const out: TokenizedParagraph[] = paragraphs.map((p) => {
    const tokens: Token[] = [];
    // Keep the whitespace so the rendered text preserves its original spacing.
    for (const chunk of p.text.split(/(\s+)/)) {
      if (chunk.length === 0) continue;
      if (/^\s+$/.test(chunk)) {
        tokens.push({ index: -1, text: chunk, space: true });
      } else {
        tokens.push({ index: next++, text: chunk, space: false });
      }
    }
    return { label: p.label, tokens };
  });
  return { paragraphs: out, wordCount: next };
}

function indexOfElement(el: Element | null): number | null {
  const found = el?.closest?.("[data-w]");
  const raw = found?.getAttribute("data-w");
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** The first `data-w` index found anywhere inside `node`, in document order. */
function firstIndexWithin(node: Node, backwards: boolean): number | null {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const own = el.getAttribute?.("data-w");
    if (own != null) return Number(own);
    const all = el.querySelectorAll("[data-w]");
    const pick = backwards ? all[all.length - 1] : all[0];
    if (pick) return Number(pick.getAttribute("data-w"));
  }
  return null;
}

/**
 * Resolves a selection boundary to a word index.
 *
 * A boundary can land three ways: inside a word's text node, on the word
 * element itself, or — when the user's drag stops exactly at a word edge —
 * on the *parent* with a child offset. The last case is why this can't just
 * walk upwards: it has to look down at `childNodes[offset]` first.
 */
function wordIndexOf(node: Node | null, offset: number, backwards: boolean): number | null {
  if (!node) return null;

  if (node.nodeType === Node.ELEMENT_NODE) {
    const children = node.childNodes;
    // `offset` is a child index here; a collapsed end boundary sits after the
    // preceding child, so step back one when resolving the end of a range.
    const at = backwards ? offset - 1 : offset;
    const child = children[Math.min(Math.max(at, 0), children.length - 1)];
    if (child) {
      const inside = firstIndexWithin(child, backwards);
      if (inside !== null) return inside;
      const viaParent = indexOfElement(
        child.nodeType === Node.ELEMENT_NODE ? (child as Element) : child.parentElement,
      );
      if (viaParent !== null) return viaParent;
    }
    return indexOfElement(node as Element);
  }

  return indexOfElement(node.parentElement);
}

export type SelectionRange = { start: number; end: number; rect: DOMRect };

/**
 * Reads the current selection and clamps it to whole-word boundaries.
 * Returns null when nothing useful is selected or the selection escapes
 * the passage container.
 */
export function readSelection(container: HTMLElement | null): SelectionRange | null {
  if (!container) return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const a = wordIndexOf(range.startContainer, range.startOffset, false);
  const b = wordIndexOf(range.endContainer, range.endOffset, true);
  if (a === null || b === null) return null;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return { start: Math.min(a, b), end: Math.max(a, b), rect };
}

export function clearSelection(): void {
  window.getSelection()?.removeAllRanges();
}

function overlaps(a: Annotation, start: number, end: number): boolean {
  // Touching ranges count as overlapping so adjacent highlights coalesce.
  return a.start <= end + 1 && start <= a.end + 1;
}

/** Adds a highlight, merging it with any it touches or overlaps. */
export function addHighlight(
  existing: Annotation[],
  start: number,
  end: number,
): Annotation[] {
  let lo = start;
  let hi = end;
  const kept: Annotation[] = [];

  for (const a of existing) {
    if (overlaps(a, start, end)) {
      lo = Math.min(lo, a.start);
      hi = Math.max(hi, a.end);
    } else {
      kept.push(a);
    }
  }

  kept.push({ id: `hl-${lo}-${hi}-${Date.now()}`, start: lo, end: hi });
  return kept.sort((x, y) => x.start - y.start);
}

/** Removes whichever highlight covers `index`. */
export function removeHighlightAt(existing: Annotation[], index: number): Annotation[] {
  return existing.filter((a) => index < a.start || index > a.end);
}

export function annotationAt<T extends Annotation>(list: T[], index: number): T | undefined {
  return list.find((a) => index >= a.start && index <= a.end);
}

/** Every annotation covering `index` — notes may stack. */
export function annotationsAt<T extends Annotation>(list: T[], index: number): T[] {
  return list.filter((a) => index >= a.start && index <= a.end);
}

/** Builds a lookup of word index → true for fast per-token class assignment. */
export function coverageSet(list: Annotation[]): Set<number> {
  const set = new Set<number>();
  for (const a of list) {
    for (let i = a.start; i <= a.end; i++) set.add(i);
  }
  return set;
}
