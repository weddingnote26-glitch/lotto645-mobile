// 당첨 조합의 형태 패턴 화면.
// "지금까지 실제로 당첨된 조합은 어떤 모양이었나"를 항목별로 보여준다.

import type { Distribution, PatternBands, PatternStats } from "../core/patternAnalyzer";

function pct(count: number, total: number): string {
  return total ? `${((count / total) * 100).toFixed(1)}%` : "0%";
}

/** 분포 막대 목록. 가장 잦은 값은 파란색으로 강조한다. */
function DistBars({
  dist,
  total,
  label,
  from = 0,
  highlight,
}: {
  dist: Distribution;
  total: number;
  label: (value: number) => string;
  from?: number;
  /** 이 값들에 속하면 '자주 나온 값'으로 표시 */
  highlight?: number[];
}) {
  const max = Math.max(...dist, 1);
  const rows = dist
    .map((count, value) => ({ count, value }))
    .filter((r) => r.value >= from && r.count > 0);

  return (
    <div className="bars">
      {rows.map((r) => {
        const on = highlight ? highlight.includes(r.value) : false;
        return (
          <div className="bar" key={r.value}>
            <span className="bar__label">{label(r.value)}</span>
            <span className="bar__track">
              <span
                className="bar__fill"
                style={{
                  width: `${(r.count / max) * 100}%`,
                  background: on ? "var(--primary)" : "var(--zone-3)",
                }}
              />
            </span>
            <span className="bar__value">
              {r.count}회 · {pct(r.count, total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PatternPanel({ stats, bands }: { stats: PatternStats; bands: PatternBands }) {
  const t = stats.totalDraws;
  const sumMax = Math.max(...stats.sumBuckets.map((b) => b.count), 1);
  const digitTotal = stats.lastDigitCounts.reduce((a, b) => a + b, 0);

  return (
    <div className="screen">
      <section className="card">
        <h2 className="card__title">조합 패턴 분석</h2>
        <p className="card__sub">
          제{stats.totalDraws}회까지의 당첨 조합 {t}개가 어떤 모양이었는지 집계했습니다.
        </p>
        <div className="notice notice--info" style={{ marginTop: 10 }}>
          아래 통계는 과거에 드물었던 극단적인 모양을 피하는 데 쓰입니다. 어떤 번호가 나올지
          예측하는 것이 아닙니다.
        </div>
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 4 }}>
          홀짝 비율
        </h2>
        <p className="card__sub" style={{ marginBottom: 10 }}>
          6개 중 홀수가 몇 개였는지
        </p>
        <DistBars
          dist={stats.oddDist}
          total={t}
          highlight={bands.oddAllowed}
          label={(v) => `홀${v}:짝${6 - v}`}
        />
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 4 }}>
          번호 합계
        </h2>
        <p className="card__sub nums" style={{ marginBottom: 10 }}>
          평균 {stats.sumMean.toFixed(1)} · 최저 {stats.sumMin} · 최고 {stats.sumMax}
        </p>
        <div className="bars">
          {stats.sumBuckets.map((b) => (
            <div className="bar" key={b.label}>
              <span className="bar__label">{b.label}</span>
              <span className="bar__track">
                <span
                  className="bar__fill"
                  style={{
                    width: `${(b.count / sumMax) * 100}%`,
                    background:
                      b.to >= bands.sumFrom && b.from <= bands.sumTo
                        ? "var(--primary)"
                        : "var(--zone-3)",
                  }}
                />
              </span>
              <span className="bar__value">
                {b.count}회 · {pct(b.count, t)}
              </span>
            </div>
          ))}
        </div>
        <p className="faint" style={{ marginTop: 8, marginBottom: 0 }}>
          전체의 80%가 합계 {bands.sumFrom}~{bands.sumTo} 사이에 들어 있습니다. 패턴 기반 생성은 이
          범위를 목표로 합니다.
        </p>
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 4 }}>
          연속번호
        </h2>
        <p className="card__sub" style={{ marginBottom: 10 }}>
          바로 이어지는 두 수(예: 23·24)가 몇 쌍이었는지
        </p>
        <DistBars
          dist={stats.consecutiveDist}
          total={t}
          highlight={bands.consecutiveAllowed}
          label={(v) => (v === 0 ? "없음" : `${v}쌍`)}
        />
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 4 }}>
          10단위 구간 분산
        </h2>
        <p className="card__sub" style={{ marginBottom: 10 }}>
          1~10 / 11~20 / 21~30 / 31~40 / 41~45 중 몇 개 구간에 걸쳐 있었는지
        </p>
        <DistBars
          dist={stats.zones10Dist}
          total={t}
          from={1}
          highlight={bands.zones10Allowed}
          label={(v) => `${v}개 구간`}
        />
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 4 }}>
          저·고 비율
        </h2>
        <p className="card__sub" style={{ marginBottom: 10 }}>
          저(1~22)와 고(23~45)가 몇 개씩이었는지
        </p>
        <DistBars
          dist={stats.highDist}
          total={t}
          highlight={bands.highAllowed}
          label={(v) => `저${6 - v}:고${v}`}
        />
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 4 }}>
          같은 끝수 중복
        </h2>
        <p className="card__sub" style={{ marginBottom: 10 }}>
          1의 자리가 같은 번호(예: 7·17·27)가 최대 몇 개까지 겹쳤는지
        </p>
        <DistBars
          dist={stats.sameLastDigitDist}
          total={t}
          from={1}
          label={(v) => (v === 1 ? "겹침 없음" : `${v}개 겹침`)}
        />
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 4 }}>
          끝수(1의 자리) 분포
        </h2>
        <p className="card__sub" style={{ marginBottom: 10 }}>
          당첨번호 {digitTotal}개 전체 기준
        </p>
        <DistBars dist={stats.lastDigitCounts} total={digitTotal} label={(v) => `끝수 ${v}`} />
        <p className="faint" style={{ marginTop: 8, marginBottom: 0 }}>
          끝수 8·9는 해당 번호가 4개(8·18·28·38, 9·19·29·39)뿐이라 다른 끝수보다 적게 나오는 것이
          정상입니다.
        </p>
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 10 }}>
          패턴 기반 생성 기준
        </h2>
        <div className="kv">
          <div className="kv__item">
            <div className="kv__k">홀수 개수</div>
            <div className="kv__v">{bands.oddAllowed.join(", ")}개</div>
          </div>
          <div className="kv__item">
            <div className="kv__k">번호 합계</div>
            <div className="kv__v">
              {bands.sumFrom}~{bands.sumTo}
            </div>
          </div>
          <div className="kv__item">
            <div className="kv__k">연속번호</div>
            <div className="kv__v">{bands.consecutiveAllowed.join(", ")}쌍</div>
          </div>
          <div className="kv__item">
            <div className="kv__k">걸친 구간</div>
            <div className="kv__v">{bands.zones10Allowed.join(", ")}개</div>
          </div>
          <div className="kv__item">
            <div className="kv__k">고(23~45) 개수</div>
            <div className="kv__v">{bands.highAllowed.join(", ")}개</div>
          </div>
        </div>
        <p className="faint" style={{ marginTop: 10, marginBottom: 0 }}>
          각 항목에서 과거 전체의 80%를 차지하는 값들만 골랐습니다. 데이터를 업데이트하면 이
          기준도 자동으로 다시 계산됩니다.
        </p>
      </section>
    </div>
  );
}
