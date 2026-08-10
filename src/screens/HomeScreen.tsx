// 홈. 사용자 흐름의 시작점 — 기준 회차와 추천번호를 확인하고 번호생성으로 넘어간다.
//   최신 분석 회차 → 핵심 추천번호 + 상위 추천번호 → 번호 만들기 → 최근 분석 → 상세 통계

import { useState } from "react";

import { Ball } from "../components/Ball";
import { RankedRow } from "../components/RankedRow";
import { SelectionSteps } from "../components/SelectionSteps";
import { Sheet } from "../components/Sheet";
import { WindowCard } from "../components/WindowSummary";
import { selectionReason } from "../core/numberSelector";
import { useAppState } from "../state/AppState";
import type { TabKey } from "../types/nav";
import type { ShowToast } from "../types/toast";

export function HomeScreen({
  onNavigate,
}: {
  onToast: ShowToast;
  onNavigate: (tab: TabKey) => void;
}) {
  const { analysis, selection, ranked, data, usingSeed, ticket } = useAppState();
  const [showSteps, setShowSteps] = useState(false);

  if (!analysis || !selection || !data) return null;

  const s = analysis.stats[selection.number];
  const reason = selectionReason(analysis, selection.number);
  const savedCount = ticket.filter(Boolean).length;

  return (
    <div className="screen">
      <section className="card">
        <div className="row row--between">
          <div>
            <h2 className="card__title">기준 데이터</h2>
            <p className="card__sub nums">
              최신 {analysis.latest}회 · 총 {data.rounds.length}개 회차
            </p>
          </div>
          <span className="chip">{usingSeed ? "내장 데이터" : "내 데이터"}</span>
        </div>
      </section>

      <section className="card">
        <div className="core">
          <span className="core__label">추천 1위 번호</span>
          <Ball n={selection.number} size="lg" />
          <div className="core__facts">
            <span className="chip chip--accent nums">최근 5회 {s.cnt5}회</span>
            <span className="chip chip--accent nums">최근 10회 {s.cnt10}회</span>
            <span className="chip nums">미출현 {s.gap}회</span>
          </div>
          {selection.usedRandom ? (
            <span className="chip chip--warn">동일 조건 후보 중 무작위 선택</span>
          ) : null}
          <button type="button" className="btn" onClick={() => setShowSteps(true)}>
            왜 이 번호인가요?
          </button>
        </div>

        <RankedRow ranked={ranked} />
      </section>

      <button
        type="button"
        className="btn btn--primary btn--cta"
        onClick={() => onNavigate("generate")}
      >
        추천번호로 번호 만들기
      </button>

      {savedCount > 0 ? (
        <button type="button" className="btn" onClick={() => onNavigate("ticket")}>
          저장된 번호 보기
        </button>
      ) : null}

      <WindowCard title="최근 당첨 5회차 분석" w={analysis.win5} />
      <WindowCard title="최근 당첨번호 10회차 분석" w={analysis.win10} showLevel />

      <button type="button" className="btn" onClick={() => onNavigate("stats")}>
        1~45 상세 통계 보기
      </button>

      <p className="disclaimer">
        이 앱은 과거 데이터를 정리해 보여주는 통계 도구입니다. 로또 추첨은 매회 독립적인 무작위
        추첨이며, 생성된 번호는 당첨을 예측하거나 보장하지 않습니다.
      </p>

      <Sheet open={showSteps} title="핵심 추천번호 선정 과정" onClose={() => setShowSteps(false)}>
        <div className="stack" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: "center" }}>
            <Ball n={selection.number} size="lg" />
          </div>
          <div className="kv">
            {reason.map(([k, v]) => (
              <div className="kv__item" key={k}>
                <div className="kv__k">{k}</div>
                <div className="kv__v">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <SelectionSteps selection={selection} />
      </Sheet>
    </div>
  );
}
