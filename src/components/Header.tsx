export function Header() {
  return (
    <header className="mast">
      <div className="mast-brand">
        <span className="mark" aria-hidden="true" />
        <div>
          <p className="eyebrow">SMF Works · Human-AI lab</p>
          <h1>Eval Scorecard</h1>
        </div>
      </div>
      <p className="lede">
        Paste eval, judge, or harness output. Get a green / yellow / red grade
        card with fix hints you can share — Skill Lint&apos;s twin for runs, not
        skills.
      </p>
    </header>
  );
}
