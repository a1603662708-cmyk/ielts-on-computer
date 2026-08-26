import type { TestType } from "./schema";

/**
 * Official raw-score → band conversion tables (out of 40).
 * Listening is the same for Academic and General Training;
 * the Reading table here is the Academic one.
 */
type BandRow = { min: number; band: number };

const LISTENING: BandRow[] = [
  { min: 39, band: 9.0 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8.0 },
  { min: 32, band: 7.5 },
  { min: 30, band: 7.0 },
  { min: 26, band: 6.5 },
  { min: 23, band: 6.0 },
  { min: 18, band: 5.5 },
  { min: 16, band: 5.0 },
  { min: 13, band: 4.5 },
  { min: 10, band: 4.0 },
  { min: 8, band: 3.5 },
  { min: 6, band: 3.0 },
  { min: 4, band: 2.5 },
];

const ACADEMIC_READING: BandRow[] = [
  { min: 39, band: 9.0 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8.0 },
  { min: 33, band: 7.5 },
  { min: 30, band: 7.0 },
  { min: 27, band: 6.5 },
  { min: 23, band: 6.0 },
  { min: 19, band: 5.5 },
  { min: 15, band: 5.0 },
  { min: 13, band: 4.5 },
  { min: 10, band: 4.0 },
  { min: 8, band: 3.5 },
  { min: 6, band: 3.0 },
  { min: 4, band: 2.5 },
];

/**
 * Converts a raw score to a band. The tables are defined for a 40-question
 * test; when a practice file has a different question count the raw score is
 * scaled to 40 first so the band stays meaningful.
 */
export function toBand(raw: number, total: number, type: TestType): number {
  const table = type === "listening" ? LISTENING : ACADEMIC_READING;
  const scaled = total === 40 ? raw : Math.round((raw / Math.max(total, 1)) * 40);
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
