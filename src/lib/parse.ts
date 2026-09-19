import type {
  Band,
  Criterion,
  MetaFields,
  ScorecardResult,
  SourceKind,
  Thresholds,
} from "../types.ts";
import { DEFAULT_THRESHOLDS, SCHEMA_VERSION } from "../types.ts";
import { bandFromCriterion, bandFromScore, clampScore, sanitizeThresholds } from "./band.ts";

const HINT_LIMIT = 5;
const CRITERIA_LIMIT = 12;

const SCORE_KEYS = [
  "score",
  "overall_score",
  "overallScore",
  "total",
  "total_score",
  "totalScore",
  "accuracy",
  "pass_rate",
  "passRate",
  "percentage",
  "pct",
  "points",
  "grade_score",
  "gradeScore",
  "value",
];

const PASS_KEYS = ["pass", "passed", "success", "ok", "okey"];
const VERDICT_KEYS = ["verdict", "status", "result", "outcome", "band", "grade"];
const HINT_KEYS = [
  "hints",
  "fix_hints",
  "fixHints",
  "recommendations",
  "suggestions",
  "improvements",
  "next_steps",
  "nextSteps",
  "fixes",
  "actions",
  "advice",
];
const CRITERIA_KEYS = [
  "criteria",
  "checks",
  "metrics",
  "results",
  "tests",
  "dimensions",
  "scores",
  "items",
  "rubric",
  "rubrics",
  "cases",
];
const TITLE_KEYS = ["title", "name", "run", "eval_name", "evalName"];
const SUITE_KEYS = ["suite", "harness", "eval", "benchmark", "bench", "task"];
const MODEL_KEYS = ["model", "judge", "system", "agent"];
const DATE_KEYS = ["date", "run_date", "runDate", "when", "timestamp"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const found = asString(obj[key]);
    if (found) return found;
  }
  return null;
}

function parsePassFail(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if (["pass", "passed", "ok", "success", "true", "green", "go", "clear", "yes"].includes(text)) {
    return true;
  }
  if (["fail", "failed", "error", "false", "red", "no", "block", "stop"].includes(text)) {
    return false;
  }
  return null;
}

function parseBandToken(value: unknown): Band | null {
  if (typeof value !== "string") return null;
  const text = value.trim().toUpperCase();
  if (text === "GREEN" || text === "YELLOW" || text === "RED") return text;
  if (["PASS", "CLEAR", "GO", "A", "A+", "A-"].includes(text)) return "GREEN";
  if (["HOLD", "REVIEW", "WARN", "B", "B+", "B-", "C", "C+"].includes(text)) return "YELLOW";
  if (["FAIL", "BLOCK", "STOP", "NO", "D", "F"].includes(text)) return "RED";
  return null;
}

export function scoreFromValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 0 && value <= 1) return clampScore(value * 100);
    return clampScore(value);
  }
  if (typeof value !== "string") return null;
  const pass = parsePassFail(value);
  if (pass === true) return 100;
  if (pass === false) return 0;
  const band = parseBandToken(value);
  if (band === "GREEN") return 90;
  if (band === "YELLOW") return 65;
  if (band === "RED") return 30;
  const pct = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return clampScore(Number(pct[1]));
  const frac = value.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den > 0) return clampScore((num / den) * 100);
  }
  const labeled = value.match(/(?:score|overall|grade|accuracy|total)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (labeled) {
    const n = Number(labeled[1]);
    if (n <= 100) return clampScore(n);
  }
  const bare = value.trim().match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const n = Number(bare[1]);
    if (n <= 100) return clampScore(n);
  }
  return null;
}

function pickScore(obj: Record<string, unknown>): number | null {
  for (const key of SCORE_KEYS) {
    if (key in obj) {
      const score = scoreFromValue(obj[key]);
      if (score !== null) return score;
    }
  }
  return null;
}

function pickPassed(obj: Record<string, unknown>): boolean | null {
  for (const key of PASS_KEYS) {
    const parsed = parsePassFail(obj[key]);
    if (parsed !== null) return parsed;
  }
  for (const key of VERDICT_KEYS) {
    const parsed = parsePassFail(obj[key]);
    if (parsed !== null) return parsed;
    const band = parseBandToken(obj[key]);
    if (band === "GREEN") return true;
    if (band === "RED") return false;
  }
  return null;
}

function slugId(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || `c${index + 1}`;
}

function criterionFromUnknown(value: unknown, fallbackName: string, index: number, thresholds: Thresholds): Criterion | null {
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    const pass = parsePassFail(value);
    const score = pass === true ? 100 : pass === false ? 0 : scoreFromValue(value);
    return {
      id: slugId(fallbackName, index),
      name: fallbackName,
      score,
      pass,
      note: typeof value === "string" && score === null && pass === null ? value : "",
      band: bandFromCriterion(score, pass, thresholds),
    };
  }
  const rec = asRecord(value);
  if (!rec) return null;
  const name =
    firstString(rec, ["name", "title", "id", "metric", "check", "criterion", "label", "key"]) ??
    fallbackName;
  const max = scoreFromValue(rec.max ?? rec.out_of ?? rec.outOf ?? rec.total);
  let score = scoreFromValue(rec.score ?? rec.value ?? rec.points ?? rec.pct ?? rec.percentage);
  if (score !== null && max !== null && max > 0 && Number(rec.score ?? rec.points ?? rec.value) <= max && max !== 100) {
    const raw = Number(rec.score ?? rec.points ?? rec.value);
    if (Number.isFinite(raw) && raw <= max) score = clampScore((raw / max) * 100);
  }
  const pass = parsePassFail(rec.pass ?? rec.passed ?? rec.ok ?? rec.success ?? rec.verdict ?? rec.status);
  const note =
    firstString(rec, ["note", "comment", "detail", "reason", "message", "summary", "hint"]) ?? "";
  if (score === null && pass === null && !note) return null;
  const resolvedScore = score ?? (pass === true ? 100 : pass === false ? 0 : null);
  return {
    id: slugId(asString(rec.id) ?? name, index),
    name,
    score: resolvedScore,
    max: max && max !== 100 ? max : null,
    pass,
    note,
    band: bandFromCriterion(resolvedScore, pass, thresholds),
  };
}

function extractCriteria(obj: Record<string, unknown>, thresholds: Thresholds): Criterion[] {
  const out: Criterion[] = [];
  for (const key of CRITERIA_KEYS) {
    const value = obj[key];
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const row = criterionFromUnknown(item, `Criterion ${index + 1}`, index, thresholds);
        if (row) out.push(row);
      });
      if (out.length) return out.slice(0, CRITERIA_LIMIT);
    }
    const rec = asRecord(value);
    if (rec) {
      Object.entries(rec).forEach(([name, item], index) => {
        const row = criterionFromUnknown(item, name, index, thresholds);
        if (row) out.push(row);
      });
      if (out.length) return out.slice(0, CRITERIA_LIMIT);
    }
  }
  return out;
}

function extractHints(obj: Record<string, unknown>): string[] {
  const hints: string[] = [];
  for (const key of HINT_KEYS) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      hints.push(value.trim());
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) hints.push(item.trim());
        else {
          const rec = asRecord(item);
          const text = rec ? firstString(rec, ["hint", "text", "message", "note"]) : null;
          if (text) hints.push(text);
        }
      }
    }
    if (hints.length) break;
  }
  return hints.slice(0, HINT_LIMIT);
}

function extractOverall(obj: Record<string, unknown>): { score: number | null; passed: boolean | null; note: string | null } {
  const nestedKeys = ["overall", "summary", "aggregate", "totals", "result"];
  for (const key of nestedKeys) {
    const nested = asRecord(obj[key]);
    if (!nested) continue;
    const score = pickScore(nested) ?? scoreFromValue(nested);
    const passed = pickPassed(nested);
    const note = firstString(nested, ["note", "comment", "summary", "message"]);
    if (score !== null || passed !== null) return { score, passed, note };
  }
  return {
    score: pickScore(obj),
    passed: pickPassed(obj),
    note: firstString(obj, ["summary", "note", "comment"]),
  };
}

function cardId(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 4);
  return `ES-${hex}`;
}

function averageScores(criteria: Criterion[]): number | null {
  const scored = criteria.filter((row) => row.score !== null) as Array<Criterion & { score: number }>;
  if (!scored.length) return null;
  const sum = scored.reduce((acc, row) => acc + row.score, 0);
  return clampScore(sum / scored.length);
}

function allCriteriaPass(criteria: Criterion[]): boolean | null {
  if (!criteria.length) return null;
  if (criteria.every((row) => row.pass === true || (row.score !== null && row.score >= 80))) return true;
  if (criteria.some((row) => row.pass === false)) return false;
  return null;
}

function defaultHints(criteria: Criterion[], band: Band, score: number): string[] {
  const weak = criteria
    .filter((row) => row.pass === false || (row.score !== null && row.score < 80))
    .slice(0, HINT_LIMIT)
    .map((row) => {
      if (row.note) return `${row.name}: ${row.note}`;
      if (row.pass === false) return `Fix ${row.name} — it failed the check.`;
      return `Raise ${row.name} (now ${row.score}).`;
    });
  if (weak.length) return weak;
  if (band === "GREEN") return ["Keep the harness frozen and re-run after the next prompt change."];
  if (band === "YELLOW") return [`Score is ${score}. Tighten the weakest criterion and re-grade.`];
  return [`Score is ${score}. Treat this as a fail until the blocking criterion is fixed.`];
}

function summarize(band: Band, score: number, title: string | null, criteria: Criterion[]): string {
  const name = title ?? "This run";
  const fails = criteria.filter((row) => row.pass === false || (row.score !== null && row.score < 50)).length;
  if (band === "GREEN") return `${name} graded GREEN · ${score}/100.`;
  if (band === "YELLOW") {
    return fails
      ? `${name} graded YELLOW · ${score}/100 · ${fails} weak row${fails === 1 ? "" : "s"}.`
      : `${name} graded YELLOW · ${score}/100.`;
  }
  return `${name} graded RED · ${score}/100.`;
}

function buildResult(opts: {
  raw: string;
  sourceKind: SourceKind;
  title: string | null;
  suite: string | null;
  model: string | null;
  date: string | null;
  score: number | null;
  passed: boolean | null;
  criteria: Criterion[];
  hints: string[];
  thresholds: Thresholds;
  now: Date;
}): ScorecardResult {
  const thresholds = sanitizeThresholds(opts.thresholds);
  const allPass =
    opts.passed === true || (opts.passed !== false && allCriteriaPass(opts.criteria) === true);
  let score = opts.score;
  if (score === null) score = averageScores(opts.criteria);
  if (score === null && opts.passed === true) score = 100;
  if (score === null && opts.passed === false) score = 0;
  if (score === null) score = 0;
  score = clampScore(score);
  const finalBand = bandFromScore(score, thresholds, allPass);
  const criteria = opts.criteria.map((row) => ({
    ...row,
    band: row.band ?? bandFromCriterion(row.score, row.pass, thresholds),
  }));
  const hints = (opts.hints.length ? opts.hints : defaultHints(criteria, finalBand, score)).slice(0, HINT_LIMIT);
  const title = opts.title;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: cardId(`${opts.raw}\0${opts.now.toISOString()}`),
    title,
    suite: opts.suite,
    model: opts.model,
    date: opts.date,
    score,
    passed: opts.passed ?? allCriteriaPass(criteria),
    band: finalBand,
    criteria,
    hints,
    heuristic: true,
    gradedAt: opts.now.toISOString(),
    summary: summarize(finalBand, score, title, criteria),
    sourceKind: opts.sourceKind,
    thresholds,
  };
}

function applyMeta(result: ScorecardResult, meta: Partial<MetaFields>): ScorecardResult {
  const title = meta.title?.trim() || result.title;
  const suite = meta.suite?.trim() || result.suite;
  const model = meta.model?.trim() || result.model;
  const date = meta.date?.trim() || result.date;
  return {
    ...result,
    title,
    suite,
    model,
    date,
    summary: summarize(result.band, result.score, title, result.criteria),
  };
}

function parseCanonical(obj: Record<string, unknown>, thresholds: Thresholds, now: Date, raw: string): ScorecardResult | null {
  if (obj.schemaVersion !== SCHEMA_VERSION && obj.schemaVersion !== "eval-scorecard/v1") {
    return null;
  }
  const overall = extractOverall(obj);
  const criteria = extractCriteria(obj, thresholds);
  return buildResult({
    raw,
    sourceKind: "json",
    title: firstString(obj, TITLE_KEYS),
    suite: firstString(obj, SUITE_KEYS),
    model: firstString(obj, MODEL_KEYS),
    date: firstString(obj, DATE_KEYS),
    score: overall.score,
    passed: overall.passed,
    criteria,
    hints: extractHints(obj),
    thresholds,
    now,
  });
}

function parseJsonObject(obj: Record<string, unknown>, thresholds: Thresholds, now: Date, raw: string): ScorecardResult {
  const canonical = obj.schemaVersion === SCHEMA_VERSION ? parseCanonical(obj, thresholds, now, raw) : null;
  if (canonical) return canonical;
  const wrap = asString(obj.raw) ?? asString(obj.markdown) ?? asString(obj.text) ?? asString(obj.report);
  if (wrap && !pickScore(obj) && !extractCriteria(obj, thresholds).length) {
    return parseEval(wrap, {}, thresholds, now);
  }
  const overall = extractOverall(obj);
  return buildResult({
    raw,
    sourceKind: "json",
    title: firstString(obj, TITLE_KEYS),
    suite: firstString(obj, SUITE_KEYS),
    model: firstString(obj, MODEL_KEYS),
    date: firstString(obj, DATE_KEYS),
    score: overall.score,
    passed: overall.passed,
    criteria: extractCriteria(obj, thresholds),
    hints: extractHints(obj),
    thresholds,
    now,
  });
}

function parseMarkdownTable(text: string, thresholds: Thresholds): Criterion[] {
  const rows: Criterion[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes("|")) continue;
    if (/^\s*\|?\s*:?-{2,}/.test(line)) continue;
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const headerish = cells.every((cell) => /^(name|criterion|check|metric|score|note|comment|pass|result|hint)$/i.test(cell));
    if (headerish) continue;
    const name = cells[0];
    if (/^#+/.test(name) || /^criteria$/i.test(name)) continue;
    let score: number | null = null;
    let pass: boolean | null = null;
    let note = "";
    for (const cell of cells.slice(1)) {
      if (score === null) score = scoreFromValue(cell);
      if (pass === null) pass = parsePassFail(cell);
      if (!scoreFromValue(cell) && parsePassFail(cell) === null && cell.length > 2) {
        note = note || cell;
      }
    }
    if (score === null && pass === null && !note) continue;
    rows.push({
      id: slugId(name, rows.length),
      name,
      score: score ?? (pass === true ? 100 : pass === false ? 0 : null),
      pass,
      note,
      band: bandFromCriterion(score, pass, thresholds),
    });
  }
  return rows.slice(0, CRITERIA_LIMIT);
}

function parseListCriteria(text: string, thresholds: Thresholds): Criterion[] {
  const rows: Criterion[] = [];
  const pattern =
    /^\s*(?:[-*]|\d+[.)])?\s*\*?\*?([A-Za-z][\w\s/-]{1,40}?)\*?\*?\s*[:—-]\s*(.+)$/;
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,3}\s+/.test(line) || line.includes("|")) continue;
    const match = line.match(pattern);
    if (!match) continue;
    const name = match[1].trim();
    const rest = match[2].trim();
    if (
      /^(fix|hint|recommend|next|overall|score|total|model|suite|date|title|judge notes)/i.test(
        name,
      )
    ) {
      continue;
    }
    const score = scoreFromValue(rest);
    const pass = parsePassFail(rest.split(/[—,:.]/)[0] ?? rest);
    if (score === null && pass === null && rest.length < 4) continue;
    const note = rest
      .replace(
        /^(?:pass|fail|passed|failed|green|yellow|red|\d+(?:\.\d+)?%?(?:\s*\/\s*\d+)?)\s*[—,:.]?\s*/i,
        "",
      )
      .trim();
    rows.push({
      id: slugId(name, rows.length),
      name,
      score: score ?? (pass === true ? 100 : pass === false ? 0 : null),
      pass,
      note,
      band: bandFromCriterion(score, pass, thresholds),
    });
  }
  return rows.slice(0, CRITERIA_LIMIT);
}

function parseHintSection(text: string): string[] {
  const hints: string[] = [];
  const lines = text.split(/\r?\n/);
  let inHints = false;
  for (const line of lines) {
    if (/^#{1,3}\s*(fix|hints?|recommend|next steps|improvements|actions)/i.test(line)) {
      inHints = true;
      continue;
    }
    if (inHints && /^#{1,3}\s+/.test(line)) break;
    const item = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)/);
    if (item && (inHints || /^(please |try |add |fix |raise |stop |refuse |cap |validate |drop )/i.test(item[1]))) {
      hints.push(item[1].trim());
    }
  }
  return hints.slice(0, HINT_LIMIT);
}

function parseMarkdownOrFreeform(text: string, thresholds: Thresholds, now: Date): ScorecardResult {
  const sourceKind: SourceKind = /#{1,3}\s+|^\s*\|.+\|/.test(text) ? "markdown" : "freeform";
  const titleMatch = text.match(/^#{1,2}\s+(.+)$/m);
  const scoreMatch =
    text.match(/(?:overall(?:\s+score)?|score|total|accuracy|grade)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?/i) ??
    text.match(/\b(\d+(?:\.\d+)?)\s*%/);
  let score: number | null = null;
  if (scoreMatch) {
    const num = Number(scoreMatch[1]);
    const den = scoreMatch[2] ? Number(scoreMatch[2]) : null;
    score = den && den > 0 ? clampScore((num / den) * 100) : clampScore(num <= 1 ? num * 100 : num);
  }
  const passed = parsePassFail(
    text.match(/\b(pass(?:ed)?|fail(?:ed)?|success|ok)\b/i)?.[1] ?? null,
  );
  const bandToken = parseBandToken(text.match(/\b(GREEN|YELLOW|RED)\b/i)?.[1] ?? null);
  if (score === null && bandToken === "GREEN") score = 90;
  if (score === null && bandToken === "YELLOW") score = 65;
  if (score === null && bandToken === "RED") score = 30;

  const tableRows = parseMarkdownTable(text, thresholds);
  const listRows = parseListCriteria(text, thresholds);
  const criteria = tableRows.length >= listRows.length ? tableRows : listRows;
  const hints = parseHintSection(text);

  const suite = text.match(/\b(?:suite|harness|bench(?:mark)?)\s*[:=]\s*([^\n,]+)/i)?.[1]?.trim() ?? null;
  const model = text.match(/\b(?:model|judge)\s*[:=]\s*([^\n,]+)/i)?.[1]?.trim() ?? null;
  const date = text.match(/\b(?:date)\s*[:=]\s*([^\n,]+)/i)?.[1]?.trim() ?? null;

  return buildResult({
    raw: text,
    sourceKind,
    title: titleMatch?.[1]?.trim() ?? null,
    suite,
    model,
    date,
    score,
    passed: passed ?? (bandToken === "GREEN" ? true : bandToken === "RED" ? false : null),
    criteria,
    hints,
    thresholds,
    now,
  });
}

export function parseEval(
  raw: string,
  meta: Partial<MetaFields> = {},
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): ScorecardResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const t = sanitizeThresholds(thresholds);

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const criteria = parsed
          .map((item, index) => criterionFromUnknown(item, `Criterion ${index + 1}`, index, t))
          .filter((row): row is Criterion => row !== null);
        return applyMeta(
          buildResult({
            raw: trimmed,
            sourceKind: "json",
            title: null,
            suite: null,
            model: null,
            date: null,
            score: null,
            passed: null,
            criteria,
            hints: [],
            thresholds: t,
            now,
          }),
          meta,
        );
      }
      const rec = asRecord(parsed);
      if (rec) return applyMeta(parseJsonObject(rec, t, now, trimmed), meta);
    } catch {
      // Fall through to text heuristics.
    }
  }

  return applyMeta(parseMarkdownOrFreeform(trimmed, t, now), meta);
}

export function resultToJson(result: ScorecardResult): string {
  return `${JSON.stringify(
    {
      schemaVersion: result.schemaVersion,
      id: result.id,
      title: result.title,
      suite: result.suite,
      model: result.model,
      date: result.date,
      score: result.score,
      passed: result.passed,
      band: result.band,
      criteria: result.criteria,
      hints: result.hints,
      heuristic: true,
      gradedAt: result.gradedAt,
      summary: result.summary,
      sourceKind: result.sourceKind,
      thresholds: result.thresholds,
    },
    null,
    2,
  )}\n`;
}
