// 최근 5회 / 10회 요약 표시.
// PC의 가로로 긴 표 대신, 모바일에서는 홀짝 분할 바 + 구간 막대로 보여준다.

import { ZONE10_LABELS, ZONE15_LABELS } from "../core/analyzer";
import type { WindowSummary as WindowSummaryType } from "../core/types";

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function OddEvenSplit({ w }: { w: WindowSummaryType }) {
  const oddPct = w.totalBalls ? (w.odd / w.totalBalls) * 100 : 50;
  return (
    <div className="split" role="img" aria-label={`홀수 ${w.odd}개, 짝수 ${w.even}개`}>
      <span
        className="split__part"
        style={{ width: `${oddPct}%`, background: "var(--primary)" }}
      >
        홀 {w.odd}
      </span>
      <span
        className="split__part"
        style={{ width: `${100 - oddPct}%`, background: "var(--zone-3)" }}
      >
        짝 {w.even}
      </span>
    </div>
  );
}

export function Zone10Bars({ w, showLevel = false }: { w: WindowSummaryType; showLevel?: boolean }) {
  const max = Math.max(...w.zone10Counts, 1);
  return (
    <div className="bars">
      {ZONE10_LABELS.map((label, i) => (
        <div className="bar" key={label}>
          <span className="bar__label">{label}</span>
          <span className="bar__track">
            <span
              className="bar__fill"
              style={{
                width: `${(w.zone10Counts[i] / max) * 100}%`,
                background: `var(--zone-${i})`,
              }}
            />
          </span>
          <span className="bar__value">
            {w.zone10Counts[i]}개
            {showLevel ? ` · ${w.zone10Levels[i]}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Zone15Bars({ w }: { w: WindowSummaryType }) {
  const max = Math.max(...w.zone15Counts, 1);
  return (
    <div className="bars">
      {ZONE15_LABELS.map((label, i) => (
        <div className="bar" key={label}>
          <span className="bar__label">{label}</span>
          <span className="bar__track">
            <span className="bar__fill" style={{ width: `${(w.zone15Counts[i] / max) * 100}%` }} />
          </span>
          <span className="bar__value">
            {w.zone15Counts[i]}개 · {pct(w.zone15Ratios[i])}
          </span>
        </div>
      ))}
    </div>
  );
}

export function WindowCard({
  title,
  w,
  showLevel = false,
}: {
  title: string;
  w: WindowSummaryType;
  showLevel?: boolean;
}) {
  return (
    <section className="card">
      <div className="row row--between" style={{ marginBottom: 10 }}>
        <h2 className="card__title">{title}</h2>
        <span className="faint nums">
          {w.rounds[0]}~{w.rounds[w.rounds.length - 1]}회
        </span>
      </div>
      <div className="stack">
        <OddEvenSplit w={w} />
        <Zone10Bars w={w} showLevel={showLevel} />
        {showLevel ? (
          <p className="faint" style={{ margin: 0 }}>
            높음/보통/낮음은 구간 크기를 보정한 출현률 기준입니다 (41~45는 숫자가 5개뿐이라 그대로
            비교하면 항상 적게 나옵니다).
          </p>
        ) : null}
      </div>
    </section>
  );
}
