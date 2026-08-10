// 번호 볼. 구간별로 색이 다르지만 색은 보조 정보일 뿐이고,
// 숫자를 항상 크게 표시하며 스크린리더에는 구간까지 함께 읽어 준다.

import { ZONE10_LABELS, zone10Index } from "../core/analyzer";

type Size = "sm" | "md" | "lg";

export function Ball({ n, size = "md" }: { n: number; size?: Size }) {
  const z = zone10Index(n);
  return (
    <span
      className={`ball ball--${size} ball--z${z}`}
      aria-label={`${n}번, ${ZONE10_LABELS[z]} 구간`}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

export function BallRow({ numbers, size = "md" }: { numbers: number[]; size?: Size }) {
  return (
    <div className={`balls${size === "sm" ? " balls--tight" : ""}`}>
      {numbers.map((n) => (
        <Ball key={n} n={n} size={size} />
      ))}
    </div>
  );
}

/** 구간 색 범례 */
export function ZoneLegend() {
  return (
    <div className="legend">
      {ZONE10_LABELS.map((label, i) => (
        <span className="legend__item" key={label}>
          <span className="legend__dot" style={{ background: `var(--zone-${i})` }} />
          {label}
        </span>
      ))}
    </div>
  );
}
