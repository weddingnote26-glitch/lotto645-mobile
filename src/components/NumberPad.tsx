// 1~45 번호판 — 실제 로또 용지의 기입란과 같은 배치.
//
//   1  2  3  4  5  6  7
//   8  9 10 11 12 13 14
//  ...
//  43 44 45
//
// 용지처럼 7열로 두고, 고른 번호는 펜으로 칠한 것처럼 채워서 표시한다.

import { ZONE10_LABELS, zone10Index } from "../core/analyzer";

export function NumberPad({
  selected,
  onToggle,
  max,
  title,
  disabled = false,
}: {
  selected: number[];
  onToggle: (n: number) => void;
  /** 최대 선택 개수 */
  max: number;
  /** 용지 머리말 (예: "수동 선택") */
  title?: string;
  disabled?: boolean;
}) {
  const set = new Set(selected);
  const full = selected.length >= max;

  return (
    <div className="slip">
      <div className="slip__head">
        <span className="slip__title">{title ?? "번호 선택"}</span>
        <span className="slip__count nums">
          {selected.length} / {max}
        </span>
      </div>

      <div className="slip__grid" role="group" aria-label={`1부터 45까지 번호 선택 (최대 ${max}개)`}>
        {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
          const on = set.has(n);
          return (
            <button
              key={n}
              type="button"
              className={`slip__cell${on ? " slip__cell--on" : ""}`}
              aria-pressed={on}
              aria-label={`${n}번, ${ZONE10_LABELS[zone10Index(n)]} 구간`}
              // 이미 꽉 찼어도 '해제'는 눌러야 하므로 선택된 칸은 막지 않는다.
              disabled={disabled || (full && !on)}
              onClick={() => onToggle(n)}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
