// 1~45 번호판. 실제 로또 용지에서 번호를 고르는 느낌으로 직접 눌러 선택한다.
//
// 좁은 화면(360px)에서도 한 칸이 44px 아래로 내려가지 않도록 열 수를 조절한다.
// 400px 미만은 6열, 그 이상은 7열 (CSS에서 처리).

import { ZONE10_LABELS, zone10Index } from "../core/analyzer";

export function NumberPad({
  selected,
  onToggle,
  max,
  disabled = false,
}: {
  selected: number[];
  onToggle: (n: number) => void;
  /** 최대 선택 개수 */
  max: number;
  disabled?: boolean;
}) {
  const set = new Set(selected);
  const full = selected.length >= max;

  return (
    <div className="pad" role="group" aria-label={`1부터 45까지 번호 선택 (최대 ${max}개)`}>
      {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
        const on = set.has(n);
        return (
          <button
            key={n}
            type="button"
            className={`pad__btn${on ? " pad__btn--on" : ""}`}
            aria-pressed={on}
            aria-label={`${n}번, ${ZONE10_LABELS[zone10Index(n)]} 구간`}
            // 이미 꽉 찼어도 '해제'는 눌러야 하므로 선택된 칸은 막지 않는다.
            disabled={disabled || (full && !on)}
            onClick={() => onToggle(n)}
          >
            {String(n).padStart(2, "0")}
          </button>
        );
      })}
    </div>
  );
}
