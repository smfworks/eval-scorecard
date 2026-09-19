import type { ScorecardResult } from "../types.ts";
import { BAND_META } from "../types.ts";

const SHARE_URL = "https://github.com/smfworks/eval-scorecard";

export function formatStampTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

export function formatShareText(result: ScorecardResult): string {
  const meta = BAND_META[result.band];
  const name = result.title ?? result.suite ?? "untitled run";
  const lines = [
    `${meta.emoji} ${result.band} · ${result.score}/100`,
    `Eval Scorecard · ${name}`,
  ];
  if (result.model) lines.push(`Model ${result.model}`);
  lines.push("");
  for (const row of result.criteria.slice(0, 8)) {
    const mark = row.band === "GREEN" || row.pass === true ? "✓" : row.band === "RED" || row.pass === false ? "✕" : "·";
    const score = row.score === null ? "—" : String(row.score);
    lines.push(`${mark} ${row.name} ${score}${row.note ? ` — ${row.note}` : ""}`);
  }
  if (result.hints.length) {
    lines.push("", "Fix hints");
    for (const hint of result.hints.slice(0, 5)) {
      lines.push(`→ ${hint}`);
    }
  }
  lines.push("", "Heuristic grade — not a lab cert.", "Eval Scorecard · SMF Works", SHARE_URL);
  return lines.join("\n");
}

export function formatCompactStats(result: ScorecardResult): string {
  const weak = result.criteria.filter((row) => row.pass === false || (row.score !== null && row.score < 80)).length;
  return `${result.band} · ${result.score}/100 · ${result.criteria.length} rows · ${weak} to fix`;
}
