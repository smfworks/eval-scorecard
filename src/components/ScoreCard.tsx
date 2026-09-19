import type { ScorecardResult } from "../types";
import { BAND_META } from "../types";
import { formatStampTime } from "../lib/share";

interface ScoreCardProps {
  result: ScorecardResult | null;
}

function barcodeBars(id: string): number[] {
  const bars: number[] = [];
  for (let i = 0; i < 36; i += 1) {
    const code = id.charCodeAt(i % id.length) + i * 17;
    bars.push(1 + (code % 4));
  }
  return bars;
}

function rowMark(pass: boolean | null | undefined, band: string | null): string {
  if (pass === true || band === "GREEN") return "✓";
  if (pass === false || band === "RED") return "✕";
  return "!";
}

export function ScoreCard({ result }: ScoreCardProps) {
  const band = result?.band ?? null;
  const meta = band ? BAND_META[band] : null;
  const tone = meta?.className ?? "is-empty";
  const rows = result?.criteria.slice(0, 8) ?? [];
  const hints = result?.hints.slice(0, 5) ?? [];

  return (
    <article className={`ticket ${tone}`}>
      <div className="ticket-rail" aria-hidden="true" />
      <header className="ticket-head">
        <div>
          <p className="r-kicker">Eval scorecard</p>
          <h2>Grade card</h2>
        </div>
        <p className="ticket-seq">{result?.id ?? "ES-————"}</p>
      </header>

      <div className="perf" aria-hidden="true">
        <span />
      </div>

      <div className="ticket-body">
        <div className="stamp-row">
          <div className={`wax ${tone}`}>
            <div className="wax-ring" />
            <div className="wax-core">
              <span className="wax-kicker">SMF WORKS</span>
              <strong>{meta?.label ?? "—"}</strong>
              <span className="wax-sub">{meta?.sub ?? "AWAIT PASTE"}</span>
            </div>
          </div>
          <dl className="codes">
            <div>
              <dt>Overall</dt>
              <dd>{result ? `${result.score}%` : "—"}</dd>
            </div>
            <div>
              <dt>Title</dt>
              <dd>{result?.title ?? "—"}</dd>
            </div>
            <div>
              <dt>Suite / model</dt>
              <dd>
                {result?.suite || result?.model
                  ? [result.suite, result.model].filter(Boolean).join(" · ")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <section className="r-hero">
          <p className="r-label">Summary</p>
          <h3>{result?.summary ?? "Paste a run. Instant band. No API."}</h3>
        </section>

        <section className="r-block">
          <p className="r-label">Criteria</p>
          {result && rows.length ? (
            <ul className="criteria">
              {rows.map((row) => (
                <li key={row.id} className={row.band ? `is-${row.band.toLowerCase()}` : undefined}>
                  <span className={`mark-tick is-${row.pass === false ? "error" : row.band === "YELLOW" ? "warn" : row.pass === true || row.band === "GREEN" ? "pass" : "warn"}`}>
                    {rowMark(row.pass, row.band)}
                  </span>
                  <span className="crit-name">{row.name}</span>
                  <span className="crit-score">{row.score === null ? "—" : row.score}</span>
                  <span className="crit-note">{row.note || "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="r-placeholder">
              GREEN ≥ 80 or all pass. YELLOW 50–79. RED below 50. Heuristic only.
            </p>
          )}
        </section>

        {result ? (
          <section className="coupon">
            <p className="r-label">Fix hints</p>
            {hints.length ? (
              <ul className="hints">
                {hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            ) : (
              <p className="coupon-line">No hints extracted.</p>
            )}
          </section>
        ) : null}
      </div>

      <div className="perf" aria-hidden="true">
        <span />
      </div>

      <div className="barcode" aria-hidden="true">
        {barcodeBars(result?.id ?? "ES-0000").map((width, index) => (
          <i key={index} style={{ width }} />
        ))}
      </div>

      <footer className="r-foot">
        <p>Eval Scorecard · SMF Works</p>
        <p className="r-link">smfworks.com</p>
        <p className="r-motto">{result ? formatStampTime(result.gradedAt) : "Heuristic demo"}</p>
        <p className="r-motto">Heuristic grade — not a lab cert.</p>
      </footer>
    </article>
  );
}
