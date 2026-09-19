import { SAMPLES } from "./data/samples";
import { parseEval, resultToJson } from "./lib/parse";
import { cardToPngBlob, copyText, downloadBlob, slugify } from "./lib/exportImage";
import { formatCompactStats, formatShareText } from "./lib/share";
import { sanitizeThresholds } from "./lib/band";
import { DEFAULT_THRESHOLDS, type MetaFields, type ScorecardResult, type Thresholds } from "./types";
import { Actions } from "./components/Actions";
import { Composer } from "./components/Composer";
import { Header } from "./components/Header";
import { ScoreCard } from "./components/ScoreCard";
import { SisterStrip } from "./components/SisterStrip";
import { HandoffBanner } from "./components/HandoffBanner";
import { Toast } from "./components/Toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";

const EMPTY_META: MetaFields = { title: "", suite: "", model: "", date: "" };

export default function App() {
  const [raw, setRaw] = useState("");
  const [meta, setMeta] = useState<MetaFields>(EMPTY_META);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [result, setResult] = useState<ScorecardResult | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<"png" | "share" | "json" | null>(null);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setResult(parseEval(raw, meta, thresholds));
    }, 80);
    return () => window.clearTimeout(handle);
  }, [raw, meta, thresholds]);

  const loadSample = useCallback(
    async (id: string) => {
      const sample = SAMPLES.find((item) => item.id === id);
      if (!sample) return;
      try {
        const response = await fetch(sample.file);
        if (!response.ok) throw new Error("missing sample");
        const text = await response.text();
        setRaw(text);
        setSampleId(id);
        setMeta(EMPTY_META);
      } catch {
        showToast("Could not load that sample.");
      }
    },
    [showToast],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sample = params.get("sample");
    if (sample) void loadSample(sample);
    const shot = params.get("shot");
    if (shot === "card" || shot === "og") {
      document.body.classList.add(`shot-${shot}`);
    }
  }, [loadSample]);

  const onFile = useCallback(async (file: File) => {
    const text = await file.text();
    setSampleId(null);
    setRaw(text);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      if (!name.endsWith(".json") && !name.endsWith(".md") && !name.endsWith(".txt") && !name.endsWith(".markdown")) {
        showToast("Drop a .json, .md, or .txt file.");
        return;
      }
      void onFile(file);
    },
    [onFile, showToast],
  );

  const reset = useCallback(() => {
    setRaw("");
    setResult(null);
    setSampleId(null);
    setMeta(EMPTY_META);
    setThresholds(DEFAULT_THRESHOLDS);
    showToast("Cleared.");
  }, [showToast]);

  const withFrame = useCallback(async () => {
    const node = frameRef.current;
    if (!node || !result) throw new Error("Nothing to print yet.");
    node.classList.add("is-exporting");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      return await cardToPngBlob(node);
    } finally {
      node.classList.remove("is-exporting");
    }
  }, [result]);

  const downloadPng = useCallback(async () => {
    if (!result) return;
    setBusy("png");
    try {
      const blob = await withFrame();
      downloadBlob(blob, `eval-scorecard-${slugify(result.title ?? result.band)}.png`);
      showToast("PNG downloaded.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "PNG export failed.");
    } finally {
      setBusy(null);
    }
  }, [result, showToast, withFrame]);

  const copyShare = useCallback(async () => {
    if (!result) return;
    setBusy("share");
    try {
      await copyText(formatShareText(result));
      showToast("Share text copied.");
    } catch {
      showToast("Could not copy share text.");
    } finally {
      setBusy(null);
    }
  }, [result, showToast]);

  const copyJson = useCallback(async () => {
    if (!result) return;
    setBusy("json");
    try {
      await copyText(resultToJson(result));
      showToast("JSON copied.");
    } catch {
      showToast("Could not copy JSON.");
    } finally {
      setBusy(null);
    }
  }, [result, showToast]);

  const live = useMemo(() => {
    if (!result) return "Waiting for eval output";
    return `${result.band} · ${result.score}/100`;
  }, [result]);

  return (
    <div className="page">
      <div className="ambient" aria-hidden="true" />
      <Header />
      <SisterStrip current="eval-scorecard" payload={raw} />
      <HandoffBanner onPaste={(text) => { setRaw(text); setSampleId(null); }} />
      <main className="layout">
        <Composer
          raw={raw}
          meta={meta}
          thresholds={thresholds}
          sampleId={sampleId}
          dragging={dragging}
          onRawChange={(value) => {
            setSampleId(null);
            setRaw(value);
          }}
          onMetaChange={(patch) => setMeta((prev) => ({ ...prev, ...patch }))}
          onThresholdsChange={(patch) => setThresholds((prev) => sanitizeThresholds({ ...prev, ...patch }))}
          onSample={(id) => void loadSample(id)}
          onPickFile={() => fileRef.current?.click()}
          onDragState={setDragging}
          onDrop={onDrop}
        />
        <section className="stage" aria-label="Eval scorecard">
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
          <div className="stage-scroll">
            <div ref={frameRef} className="export-frame">
              <ScoreCard result={result} />
            </div>
          </div>
          {result ? <p className="stage-stats">{formatCompactStats(result)}</p> : null}
          <Actions
            disabled={!result}
            busy={busy}
            onDownloadPng={() => void downloadPng()}
            onCopyShare={() => void copyShare()}
            onCopyJson={() => void copyJson()}
            onReset={reset}
          />
        </section>
      </main>
      <footer className="site-foot">
        <p>Eval Scorecard · SMF Works</p>
        <p>
          Sister apps:{" "}
          <a href="https://github.com/smfworks/skill-lint" rel="noreferrer" target="_blank">
            Skill Lint
          </a>
          {" · "}
          <a href="https://github.com/smfworks/agent-receipt" rel="noreferrer" target="_blank">
            Agent Receipt
          </a>
          {" · "}
          <a href="https://github.com/smfworks/session-timeline" rel="noreferrer" target="_blank">
            Session Timeline
          </a>
          {" · "}
          <a href="https://github.com/smfworks/context-budget" rel="noreferrer" target="_blank">
            Context Budget
          </a>
          {" · "}
          <a href="https://github.com/smfworks/refuse-card" rel="noreferrer" target="_blank">
            Refuse Card
          </a>
        </p>
        <p>Intelligence is abundant. Judgment is the product.</p>
        <p>
          MIT · Built by{" "}
          <a href="https://smfworks.com" rel="noreferrer" target="_blank">
            SMF Works
          </a>
          {" · "}
          <a href="https://github.com/smfworks/eval-scorecard" rel="noreferrer" target="_blank">
            GitHub
          </a>
          {" · "}
          <a href="https://x.com/MichaelGannotti" rel="noreferrer" target="_blank">
            @MichaelGannotti
          </a>
        </p>
        <p className="fineprint">
          No secrets, no monetization, no medical or legal advice. A shareable
          grade is not a lab certification, not compliance, and not a substitute
          for human review.
        </p>
      </footer>
      <Toast message={toast} />
    </div>
  );
}
