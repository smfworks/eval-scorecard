import type { SampleMeta } from "../types.ts";

export const PASTE_PLACEHOLDER = `Paste eval JSON, a markdown report, or judge notes.

{
  "suite": "agent-bench",
  "model": "hermes-local",
  "score": 92,
  "criteria": [
    { "name": "Task completion", "score": 100, "note": "All tasks finished." },
    { "name": "Tool accuracy", "score": 94, "note": "One extra search." }
  ],
  "hints": ["Drop the redundant search on task 7."]
}
`;

export const SAMPLES: SampleMeta[] = [
  {
    id: "agent-bench-pass",
    file: "/samples/agent-bench-pass.json",
    label: "Agent bench",
    blurb: "Clean pass · GREEN",
    expect: "GREEN",
  },
  {
    id: "tool-use-mixed",
    file: "/samples/tool-use-mixed.json",
    label: "Tool use",
    blurb: "Mixed calls · YELLOW",
    expect: "YELLOW",
  },
  {
    id: "safety-fail",
    file: "/samples/safety-fail.json",
    label: "Safety suite",
    blurb: "Policy hits · RED",
    expect: "RED",
  },
  {
    id: "rubric-graded-essay",
    file: "/samples/rubric-graded-essay.json",
    label: "Essay rubric",
    blurb: "Points / max · YELLOW",
    expect: "YELLOW",
  },
];
