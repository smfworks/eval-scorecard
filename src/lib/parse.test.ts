import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { bandFromScore, clampScore, sanitizeThresholds } from "./band.ts";
import { parseEval, scoreFromValue } from "./parse.ts";

const sampleDir = join(fileURLToPath(new URL(".", import.meta.url)), "../../public/samples");
const frozen = new Date("2026-09-19T12:00:00Z");

function loadSample(id: string): string {
  return readFileSync(join(sampleDir, `${id}.json`), "utf8");
}

describe("banding", () => {
  it("uses 80 / 50 cutoffs by default", () => {
    assert.equal(bandFromScore(100), "GREEN");
    assert.equal(bandFromScore(80), "GREEN");
    assert.equal(bandFromScore(79), "YELLOW");
    assert.equal(bandFromScore(50), "YELLOW");
    assert.equal(bandFromScore(49), "RED");
    assert.equal(bandFromScore(0), "RED");
  });

  it("promotes all-pass to GREEN even below the green cutoff", () => {
    assert.equal(bandFromScore(61, { green: 80, yellow: 50 }, true), "GREEN");
  });

  it("respects custom thresholds", () => {
    const tight = sanitizeThresholds({ green: 90, yellow: 70 });
    assert.equal(bandFromScore(88, tight), "YELLOW");
    assert.equal(bandFromScore(91, tight), "GREEN");
    assert.equal(bandFromScore(69, tight), "RED");
  });

  it("clamps scores to 0–100", () => {
    assert.equal(clampScore(140), 100);
    assert.equal(clampScore(-3), 0);
  });
});

describe("scoreFromValue", () => {
  it("reads percents, fractions, ratios, and pass/fail", () => {
    assert.equal(scoreFromValue("85%"), 85);
    assert.equal(scoreFromValue("17/20"), 85);
    assert.equal(scoreFromValue(0.92), 92);
    assert.equal(scoreFromValue("pass"), 100);
    assert.equal(scoreFromValue("FAIL"), 0);
    assert.equal(scoreFromValue("score: 73"), 73);
  });
});

describe("sample bands", () => {
  it("agent-bench-pass lands GREEN", () => {
    const result = parseEval(loadSample("agent-bench-pass"), {}, undefined, frozen);
    assert.ok(result);
    assert.equal(result.band, "GREEN");
    assert.equal(result.score, 92);
    assert.equal(result.sourceKind, "json");
    assert.ok(result.criteria.length >= 4);
    assert.ok(result.hints.length >= 1);
    assert.equal(result.heuristic, true);
    assert.equal(result.schemaVersion, "eval-scorecard/v1");
  });

  it("tool-use-mixed lands YELLOW", () => {
    const result = parseEval(loadSample("tool-use-mixed"), {}, undefined, frozen);
    assert.ok(result);
    assert.equal(result.band, "YELLOW");
    assert.equal(result.score, 67);
    assert.ok(result.criteria.some((row) => row.id.includes("arg") || row.name.includes("arg")));
    assert.ok(result.hints.length >= 2);
  });

  it("safety-fail lands RED", () => {
    const result = parseEval(loadSample("safety-fail"), {}, undefined, frozen);
    assert.ok(result);
    assert.equal(result.band, "RED");
    assert.equal(result.score, 28);
    assert.ok(result.criteria.some((row) => row.pass === false));
    assert.ok(result.hints.some((hint) => /refuse|jailbreak|harm/i.test(hint)));
  });

  it("rubric-graded-essay converts points/max and lands YELLOW", () => {
    const result = parseEval(loadSample("rubric-graded-essay"), {}, undefined, frozen);
    assert.ok(result);
    assert.equal(result.band, "YELLOW");
    assert.equal(result.score, 70);
    assert.equal(result.criteria.length, 4);
    const thesis = result.criteria.find((row) => row.name === "thesis");
    assert.equal(thesis?.score, 60);
  });
});

describe("parseEval", () => {
  it("returns null for empty paste", () => {
    assert.equal(parseEval("   "), null);
  });

  it("parses a markdown report", () => {
    const md = `# Nightly judge

Overall score: 81
Model: hermes-local
Suite: smoke

| Criterion | Score | Note |
| --- | --- | --- |
| Tools | 90 | Clean schemas |
| Safety | 72 | One soft warn |

## Fix hints
- Tighten the safety refuse line.
`;
    const result = parseEval(md, {}, undefined, frozen);
    assert.ok(result);
    assert.equal(result.sourceKind, "markdown");
    assert.equal(result.score, 81);
    assert.equal(result.band, "GREEN");
    assert.ok(result.criteria.length >= 2);
    assert.ok(result.hints.some((hint) => /safety/i.test(hint)));
  });

  it("parses freeform judge notes", () => {
    const notes = `Judge notes — fail
Score 34
Grounding: 20 — invented a citation
Safety: fail — dumped env
Fix: refuse .env reads
`;
    const result = parseEval(notes, { title: "Manual judge" }, undefined, frozen);
    assert.ok(result);
    assert.equal(result.title, "Manual judge");
    assert.equal(result.score, 34);
    assert.equal(result.band, "RED");
    assert.ok(result.criteria.length >= 1);
  });

  it("is deterministic for the same paste and clock", () => {
    const paste = loadSample("tool-use-mixed");
    const a = parseEval(paste, {}, undefined, frozen);
    const b = parseEval(paste, {}, undefined, frozen);
    assert.deepEqual(a, b);
  });
});
