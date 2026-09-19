export type Band = "GREEN" | "YELLOW" | "RED";

export type SourceKind = "json" | "markdown" | "freeform";

export interface Thresholds {
  /** Inclusive. Default 80. */
  green: number;
  /** Inclusive. Default 50. */
  yellow: number;
}

export interface Criterion {
  id: string;
  name: string;
  score: number | null;
  max?: number | null;
  pass?: boolean | null;
  note: string;
  band: Band | null;
}

export interface MetaFields {
  title: string;
  suite: string;
  model: string;
  date: string;
}

export interface ScorecardResult {
  schemaVersion: "eval-scorecard/v1";
  id: string;
  title: string | null;
  suite: string | null;
  model: string | null;
  date: string | null;
  score: number;
  passed: boolean | null;
  band: Band;
  criteria: Criterion[];
  hints: string[];
  heuristic: true;
  gradedAt: string;
  summary: string;
  sourceKind: SourceKind;
  thresholds: Thresholds;
}

export interface SampleMeta {
  id: string;
  file: string;
  label: string;
  blurb: string;
  expect: Band;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  green: 80,
  yellow: 50,
};

export const SCHEMA_VERSION = "eval-scorecard/v1" as const;

export const BAND_META: Record<
  Band,
  { label: string; sub: string; zone: string; emoji: string; className: string }
> = {
  GREEN: {
    label: "GREEN",
    sub: "CLEAR",
    zone: "SHIP",
    emoji: "🟢",
    className: "is-green",
  },
  YELLOW: {
    label: "YELLOW",
    sub: "REVIEW",
    zone: "HOLD",
    emoji: "🟡",
    className: "is-yellow",
  },
  RED: {
    label: "RED",
    sub: "BLOCK",
    zone: "STOP",
    emoji: "🔴",
    className: "is-red",
  },
};
