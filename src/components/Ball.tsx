// 번호 볼. 구간별로 색이 다르지만 색은 보조 정보일 뿐이고,
// 숫자를 항상 크게 표시하며 스크린리더에는 구간까지 함께 읽어 준다.

import { ZONE10_LABELS, zone10Index } from "../core/analyzer";

// "fit"은 칸 너비에 맞춰 늘어나는 볼이다. 6개를 항상 한 줄에 놓아야 하는
// 곳(내 번호 A~E)에서 쓴다. 화면이 좁아도 줄바꿈되지 않는다.
type Size = "sm" | "md" | "lg" | "fit";

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
  // fit은 6칸 그리드로 깔아 항상 한 줄을 유지한다.
  const cls =
    size === "fit" ? "balls balls--row6" : size === "sm" ? "balls balls--tight" : "balls";
  return (
    <div className={cls}>
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
