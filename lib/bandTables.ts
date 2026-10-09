import type { TestType } from "./schema";

/**
 * Estimated raw-score → band conversion tables (out of 40).
 * Listening is the same for Academic and General Training;
 * the Reading table here is the Academic one.
 */
import { LISTENING, ACADEMIC_READING } from "@/config/bands.json";

/**
 * Converts a raw score to a band. The tables are defined for a 40-question
 * test; when a practice file has a different question count the raw score is
 * scaled to 40 first so the band stays meaningful.
 */
export function toBand(raw: number, total: number, type: TestType): number {
  const table = type === "listening" ? LISTENING : ACADEMIC_READING;
  const scaled =
    total === 40 ? raw : Math.round((raw / Math.max(total, 1)) * 40);
  for (const row of table) {
    if (scaled >= row.min) return row.band;
  }
  return scaled >= 3 ? 2.0 : scaled >= 1 ? 1.0 : 0;
}

export function formatBand(band: number): string {
  return band.toFixed(1);
}

/** Only true for a full-length 40-question test; used to caption the score. */
export function isStandardLength(total: number): boolean {
  return total === 40;
}
