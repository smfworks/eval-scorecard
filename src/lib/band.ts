import type { Band, Thresholds } from "../types.ts";
import { DEFAULT_THRESHOLDS } from "../types.ts";

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function sanitizeThresholds(input: Partial<Thresholds> | null | undefined): Thresholds {
  const green = clampScore(Number(input?.green ?? DEFAULT_THRESHOLDS.green));
  let yellow = clampScore(Number(input?.yellow ?? DEFAULT_THRESHOLDS.yellow));
  if (yellow > green) yellow = green;
  return { green, yellow };
}

/**
 * GREEN when score ≥ green, or every criterion passed.
 * YELLOW when score ≥ yellow.
 * RED below that.
 */
export function bandFromScore(
  score: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
  allPass?: boolean | null,
): Band {
  const t = sanitizeThresholds(thresholds);
  if (allPass === true) return "GREEN";
  if (score >= t.green) return "GREEN";
  if (score >= t.yellow) return "YELLOW";
  return "RED";
}

export function bandFromCriterion(
  score: number | null,
  pass: boolean | null | undefined,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Band | null {
  if (pass === true) return "GREEN";
  if (pass === false) return "RED";
  if (score === null || !Number.isFinite(score)) return null;
  return bandFromScore(score, thresholds, null);
}
