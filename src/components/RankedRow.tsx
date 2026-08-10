// 핵심 추천번호(1순위) 아래 한 줄로 붙는 2~6순위 후보.
//
// 순위는 별도 점수 체계가 아니라, 1순위를 고른 것과 똑같은 순차 필터를
// 이미 뽑힌 번호를 빼고 다시 돌려서 정한 결과다 (core/numberSelector.ts).

import { useState } from "react";

import { ZONE10_LABELS } from "../core/analyzer";
import { selectionReason, type RankedNumber } from "../core/numberSelector";
import { useAppState } from "../state/AppState";
import { Ball } from "./Ball";
import { SelectionSteps } from "./SelectionSteps";
import { Sheet } from "./Sheet";

export function RankedRow({ ranked }: { ranked: RankedNumber[] }) {
  const { analysis } = useAppState();
  const [detail, setDetail] = useState<RankedNumber | null>(null);

  const rest = ranked.filter((r) => r.rank >= 2);
  if (!analysis || rest.length === 0) return null;

  return (
    <>
      <div className="ranked">
        <span className="ranked__label">다음 후보 (2~6순위)</span>
        <div className="ranked__list">
          {rest.map((r) => (
            <button
              key={r.number}
              type="button"
              className="ranked__item"
              onClick={() => setDetail(r)}
              aria-label={`${r.rank}순위 ${r.number}번, 근거 보기`}
            >
              <span className="ranked__rank">{r.rank}위</span>
              <Ball n={r.number} size="md" />
            </button>
          ))}
        </div>
      </div>

      <Sheet
        open={detail !== null}
        title={detail ? `${detail.rank}순위 · ${detail.number}번` : ""}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <>
            <div className="stack" style={{ marginBottom: 14 }}>
              <div className="row" style={{ justifyContent: "center" }}>
                <Ball n={detail.number} size="lg" />
              </div>
              <div className="kv">
                {selectionReason(analysis, detail.number).map(([k, v]) => (
                  <div className="kv__item" key={k}>
                    <div className="kv__k">{k}</div>
                    <div className="kv__v">{v}</div>
                  </div>
                ))}
                <div className="kv__item">
                  <div className="kv__k">최종 순위</div>
                  <div className="kv__v">{detail.rank}위</div>
                </div>
                <div className="kv__item">
                  <div className="kv__k">구간</div>
                  <div className="kv__v">
                    {ZONE10_LABELS[analysis.stats[detail.number].zone10]}
                  </div>
                </div>
              </div>
            </div>

            <p className="faint" style={{ marginTop: 0 }}>
              1순위부터 차례로 뽑을 때, 앞 순위 번호들을 후보에서 빼고 같은 규칙을 다시 적용한
              결과입니다.
            </p>

            <SelectionSteps
              selection={{
                number: detail.number,
                usedRandom: detail.usedRandom,
                steps: detail.steps,
              }}
            />
          </>
        ) : null}
      </Sheet>
    </>
  );
}
