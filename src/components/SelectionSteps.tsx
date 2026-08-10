// '왜 이 번호인가요?' — 핵심 추천번호가 어느 단계에서 어떻게 좁혀졌는지 보여준다.
// PC의 [선정 과정 보기] 텍스트 창을 모바일용 타임라인으로 옮긴 것으로,
// 내용(단계 순서·후보·설명)은 PC 로그와 같은 값을 쓴다.

import type { SelectionResult } from "../core/numberSelector";

export function SelectionSteps({ selection }: { selection: SelectionResult }) {
  return (
    <div className="steps">
      {selection.steps.map((s, i) => {
        const last = i === selection.steps.length - 1;
        return (
          <div className="step" key={`${s.order}-${s.title}-${i}`}>
            <div className="step__rail">
              <span className={`step__dot${last ? " step__dot--final" : ""}`}>
                {last ? "✓" : s.order}
              </span>
              {last ? null : <span className="step__line" />}
            </div>
            <div className="step__body">
              <div className="step__title">
                {last ? s.title : `${s.order}단계 · ${s.title}`}
              </div>
              <div className="step__detail">{s.detail}</div>
              <div className="step__after">
                후보 {s.before.length}개 → {s.after.length}개
                {s.after.length <= 12 ? `: ${s.after.join(", ")}` : ""}
              </div>
            </div>
          </div>
        );
      })}

      <div className="notice notice--info" style={{ marginTop: 4 }}>
        최종 추천번호는 <strong>{selection.number}</strong>입니다.
        {selection.usedRandom
          ? " 마지막까지 완전히 동률이어서 남은 후보 중 무작위로 골랐습니다."
          : " 규칙이 코드에 고정되어 있어 같은 데이터에서는 항상 같은 번호가 나옵니다."}
      </div>
    </div>
  );
}
