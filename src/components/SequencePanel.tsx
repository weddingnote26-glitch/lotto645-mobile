// 수열 분석 화면 — 마킹지 세로줄 / 끝수 / 9궁도 / 끝회차 최강수.
//
// 모든 '미출주기' 옆에는 반드시 이론 평균주기와 다음 회차 확률을 같이 적는다.
// 비교 기준이 없으면 "오래 안 나왔으니 곧 나온다"로 읽히기 때문이다.

import { useState } from "react";

import type { GroupAnalysis, GroupStat, PairAlert } from "../core/groupAnalyzer";
import { KIND_LABEL } from "../core/groupAnalyzer";
import type { EndRoundAnalysis } from "../core/endRoundAnalyzer";
import { bandLabel } from "../core/endRoundAnalyzer";
import { useAppState } from "../state/AppState";
import { BallRow } from "./Ball";

type View = "column" | "digit" | "palace" | "endRound";

const VIEWS: Array<{ key: View; label: string }> = [
  { key: "column", label: "세로줄" },
  { key: "digit", label: "끝수" },
  { key: "palace", label: "9궁도" },
  { key: "endRound", label: "끝회차" },
];

function pct(x: number, digits = 2): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** 그룹 한 줄 — 미출주기 막대 + 이론값 대비 */
function GroupRow({ g, max }: { g: GroupStat; max: number }) {
  const over = g.overdueRatio; // 미출주기 ÷ 이론주기
  const tone = over >= 2 ? "var(--warn)" : over >= 1 ? "var(--primary)" : "var(--zone-3)";
  return (
    <div className="seq">
      <div className="seq__head">
        <span className="seq__name">{g.label}</span>
        <span className="seq__gap nums" style={{ color: tone }}>
          {g.gap}회 미출
        </span>
      </div>
      <div className="seq__members nums">{g.members.join(" · ")}</div>
      <span className="bar__track">
        <span
          className="bar__fill"
          style={{ width: `${max ? (g.gap / max) * 100 : 0}%`, background: tone }}
        />
      </span>
      <div className="seq__meta nums">
        이론 평균 {g.theoryCycle.toFixed(1)}회마다 · 실제 {g.hitCount}회 발생 ·{" "}
        {over >= 1 ? `평균의 ${over.toFixed(1)}배` : `평균 이내`}
      </div>
      <div className="seq__prob nums">다음 회차 확률 {pct(g.theoryProb)} — 미출 기간과 무관</div>
    </div>
  );
}

function GroupView({ a, onPick }: { a: GroupAnalysis; onPick: (nums: number[]) => void }) {
  const max = Math.max(...a.groups.map((g) => g.gap), 1);
  const top = a.byOverdue[0];
  const kind = KIND_LABEL[a.kind];

  return (
    <>
      <section className="card">
        <h2 className="card__title">{kind} 미출주기</h2>
        <p className="card__sub nums">
          {a.fromRound}~{a.latest}회 · {a.rounds.length}개 회차 · {a.threshold}개 이상 동시 출현
          기준
        </p>
        <div className="notice notice--info" style={{ marginTop: 10 }}>
          가장 오래 쉰 묶음은 <strong>{top.label}</strong>({top.gap}회)입니다. 다만 다음 회차에
          나올 확률은 {pct(top.theoryProb)}로, 쉰 기간과 관계없이 항상 같습니다.
        </div>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 10, width: "100%" }}
          onClick={() => onPick(top.members)}
        >
          {top.label} 번호 번호판에 담기
        </button>
      </section>

      <section className="card">
        <div className="stack">
          {a.byOverdue.map((g) => (
            <GroupRow key={g.key} g={g} max={max} />
          ))}
        </div>
      </section>
    </>
  );
}

function EndRoundView({ a, onPick }: { a: EndRoundAnalysis; onPick: (nums: number[]) => void }) {
  const cand = a.candidates.map((c) => c.number);
  return (
    <>
      <section className="card">
        <h2 className="card__title">{a.digit}끝회차 번대별 최강수</h2>
        <p className="card__sub nums">
          {a.rounds[0]}~{a.rounds[a.rounds.length - 1]}회 · {a.rounds.length}개 회차 · 번호당 기대{" "}
          {a.expected.toFixed(1)}회
        </p>

        <div className="stack" style={{ marginTop: 12 }}>
          {a.strongest.map((s) => (
            <div className={`seq seq--row${s.excluded ? " seq--muted" : ""}`} key={s.number}>
              <div className="seq__head">
                <span className="seq__name nums">
                  {s.number}번 <span className="faint">({bandLabel(s.bandIndex)})</span>
                </span>
                <span className="seq__gap nums">{s.freq}회</span>
              </div>
              <div className="seq__meta nums">
                마지막 {s.lastRound ?? "-"}회 · 끝회차 기준 {s.gap}회 미출 · 기대 대비{" "}
                {s.sigma >= 0 ? "+" : ""}
                {s.sigma.toFixed(2)}σ
              </div>
              {s.excluded ? (
                <div className="seq__prob">직전 {a.previousRound}회에 나와 제외</div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">제외 후 남은 후보</h2>
        <p className="card__sub nums" style={{ marginBottom: 10 }}>
          직전 {a.previousRound}회({a.previousDraw.join(", ")}) 출현분을 뺐습니다.
        </p>
        {cand.length ? (
          <>
            <BallRow numbers={cand} size="fit" />
            <button
              type="button"
              className="btn"
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => onPick(cand)}
            >
              후보 {cand.length}개 번호판에 담기
            </button>
          </>
        ) : (
          <p className="faint" style={{ margin: 0 }}>
            최강수가 모두 직전 회차에 나와 남은 후보가 없습니다.
          </p>
        )}

        <div className="notice notice--warn" style={{ marginTop: 12 }}>
          빈도 분포 카이제곱 {a.chiSquare.toFixed(1)} (임계 {a.chiCritical}) —{" "}
          {a.distinguishable
            ? "균등 난수와 다릅니다."
            : "균등 난수와 구분되지 않습니다. 회차 끝자리는 공 추첨과 무관하므로, 빈도 차이는 표본이 작아서 생긴 흔들림으로 보는 편이 맞습니다."}
        </div>
      </section>
    </>
  );
}

/** 쌍동끝 알림 카드 */
function PairAlertCard({ alert, onPick }: { alert: PairAlert; onPick: (n: number[]) => void }) {
  return (
    <section className="card">
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <h2 className="card__title">쌍동끝 발생</h2>
        <span className="chip chip--warn nums">{alert.round}회</span>
      </div>
      <p className="card__sub nums" style={{ marginBottom: 10 }}>
        당첨번호 {alert.draw.join(", ")}
      </p>

      <div className="stack">
        {alert.entries.map((e) => (
          <div className="picked" key={e.key}>
            <span className="picked__label">
              {e.label} {e.hit.join("·")}
            </span>
            <span className="faint nums">남은 수 {e.remaining.join(", ")}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="field__label" style={{ marginBottom: 8 }}>
          예상수 {alert.pool.length}개
        </div>
        <BallRow numbers={alert.pool} size="sm" />
      </div>

      {alert.alreadyHit.length ? (
        <p className="faint nums" style={{ marginTop: 10, marginBottom: 0 }}>
          이후 회차에서 이미 나온 예상수: {alert.alreadyHit.join(", ")}
        </p>
      ) : null}

      <button
        type="button"
        className="btn"
        style={{ marginTop: 12, width: "100%" }}
        onClick={() => onPick(alert.pool)}
      >
        예상수 번호판에 담기
      </button>

      <div className="notice notice--warn" style={{ marginTop: 12 }}>
        “3회차 안에 88% 적중”은 실제로 맞는 수치입니다(1236회 실측 88.6%). 다만{" "}
        <strong>아무 번호나 {alert.pool.length}개를 쥐고 있어도 {pct(alert.baselineProb, 1)}</strong>{" "}
        확률로 맞습니다. 즉 무작위보다 높지 않습니다.
      </div>
    </section>
  );
}

export function SequencePanel() {
  const { columns, digits, palaces, endRound, pairAlert, settings, setFixedNumbers } =
    useAppState();
  const [view, setView] = useState<View>("column");

  if (!columns || !digits || !palaces || !endRound) {
    return <p className="muted">분석을 계산하는 중…</p>;
  }

  // 번호판(고정번호)은 최대 6개라 앞에서 잘라 담는다.
  const pick = (nums: number[]) => setFixedNumbers(nums.slice(0, 6));

  return (
    <div className="screen">
      <div className="segment" role="group" aria-label="수열 분석 종류">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className="segment__btn"
            aria-pressed={view === v.key}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="notice notice--info">
        분석 범위 <strong>{settings.analysisFrom === 1 ? "전체 회차" : "262회~"}</strong> · 설정
        탭에서 바꿀 수 있습니다.
      </div>

      {pairAlert && view === "digit" ? <PairAlertCard alert={pairAlert} onPick={pick} /> : null}

      {view === "column" ? <GroupView a={columns} onPick={pick} /> : null}
      {view === "digit" ? <GroupView a={digits} onPick={pick} /> : null}
      {view === "palace" ? <GroupView a={palaces} onPick={pick} /> : null}
      {view === "endRound" ? <EndRoundView a={endRound} onPick={pick} /> : null}

      <p className="disclaimer">
        이 지표들은 과거 기록을 보는 각도일 뿐입니다. 로또는 매회 독립적인 무작위 추첨이라 미출주기나
        빈도가 다음 회차 확률을 바꾸지 않습니다.
      </p>
    </div>
  );
}
