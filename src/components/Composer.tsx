import type { DragEvent } from "react";
import { PASTE_PLACEHOLDER, SAMPLES } from "../data/samples";
import type { MetaFields, Thresholds } from "../types";

interface ComposerProps {
  raw: string;
  meta: MetaFields;
  thresholds: Thresholds;
  sampleId: string | null;
  dragging: boolean;
  onRawChange: (value: string) => void;
  onMetaChange: (patch: Partial<MetaFields>) => void;
  onThresholdsChange: (patch: Partial<Thresholds>) => void;
  onSample: (id: string) => void;
  onPickFile: () => void;
  onDragState: (value: boolean) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

export function Composer({
  raw,
  meta,
  thresholds,
  sampleId,
  dragging,
  onRawChange,
  onMetaChange,
  onThresholdsChange,
  onSample,
  onPickFile,
  onDragState,
  onDrop,
}: ComposerProps) {
  return (
    <section
      className={`composer${dragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragState(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        onDragState(false);
      }}
      onDrop={onDrop}
    >
      <div className="composer-head">
        <h2>Eval / judge output</h2>
        <p>Pick a sample, paste JSON or a markdown report, or drop a file.</p>
      </div>
      <div className="sample-row" role="list">
        {SAMPLES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            role="listitem"
            className={sampleId === sample.id ? "chip is-on" : "chip"}
            onClick={() => onSample(sample.id)}
          >
            <span className="chip-top">
              <i className={`dot is-${sample.expect.toLowerCase()}`} aria-hidden="true" />
              {sample.label}
            </span>
            <small>{sample.blurb}</small>
          </button>
        ))}
      </div>

      <div className="meta-grid">
        <label>
          Title
          <input
            type="text"
            value={meta.title}
            onChange={(event) => onMetaChange({ title: event.target.value })}
            placeholder="Optional run title"
            autoComplete="off"
          />
        </label>
        <label>
          Suite
          <input
            type="text"
            value={meta.suite}
            onChange={(event) => onMetaChange({ suite: event.target.value })}
            placeholder="Harness / suite"
            autoComplete="off"
          />
        </label>
        <label>
          Model
          <input
            type="text"
            value={meta.model}
            onChange={(event) => onMetaChange({ model: event.target.value })}
            placeholder="Model or judge"
            autoComplete="off"
          />
        </label>
        <label>
          Date
          <input
            type="text"
            value={meta.date}
            onChange={(event) => onMetaChange({ date: event.target.value })}
            placeholder="2026-09-19"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="threshold-row">
        <p className="editor-label">Band cutoffs</p>
        <label>
          GREEN ≥
          <input
            type="number"
            min={0}
            max={100}
            value={thresholds.green}
            onChange={(event) => onThresholdsChange({ green: Number(event.target.value) })}
          />
        </label>
        <label>
          YELLOW ≥
          <input
            type="number"
            min={0}
            max={100}
            value={thresholds.yellow}
            onChange={(event) => onThresholdsChange({ yellow: Number(event.target.value) })}
          />
        </label>
        <span className="threshold-hint">RED below yellow. All-pass still grades GREEN.</span>
      </div>

      <label className="editor-label" htmlFor="eval-input">
        JSON, markdown, or notes
      </label>
      <textarea
        id="eval-input"
        value={raw}
        onChange={(event) => onRawChange(event.target.value)}
        placeholder={PASTE_PLACEHOLDER}
        spellCheck={false}
        autoComplete="off"
      />
      <div className="composer-foot">
        <button type="button" className="text-btn" onClick={onPickFile}>
          Upload file
        </button>
        <span>{raw.trim() ? `${raw.length.toLocaleString()} chars` : "Client-side only · no API"}</span>
      </div>
      <p className="disclaimer">
        Heuristic grade — not a lab cert. Approximate parse. Judgment stays human.
      </p>
    </section>
  );
}
