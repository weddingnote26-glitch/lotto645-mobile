// 6개 번호 조합 생성기 — PC 버전 core/combination_generator.py의 1:1 이식.
//
// 모드 A: 완전 랜덤 — (선택 시) 핵심 추천번호 1개 + 무작위 5개.
// 모드 B: 분석 기반 균형 추첨(기본 권장) — 극단적으로 몰린 조합을 줄이는 목적일 뿐,
//         당첨 가능성을 높이는 규칙이 아니다.
//
// 균형 조건(권장 조건이며 절대 규칙이 아님):
// - 홀짝 2:4 / 3:3 / 4:2 (가능하면 3:3 우선)
// - 10단위 구간 최소 3개 이상
// - 15단위 구간(1~15/16~30/31~45) 각 1개 이상 (가능하면)
// - 연속번호 0~1쌍
// 조건을 만족하는 조합을 찾지 못하면 가장 많은 조건을 충족한 조합을 사용한다
// (무한 루프 방지 + '무조건 강제하지 않는다').

import { zone10Index, zone15Index } from "./analyzer";
import { defaultRng } from "./rng";
import type { Rng } from "./types";

export type GenerationMode = "A" | "B";

export function consecutivePairs(combo: number[]): number {
  const c = [...combo].sort((a, b) => a - b);
  let count = 0;
  for (let i = 0; i + 1 < c.length; i += 1) {
    if (c[i + 1] === c[i] + 1) count += 1;
  }
  return count;
}

export function oddCount(combo: number[]): number {
  return combo.filter((n) => n % 2 === 1).length;
}

export function distinctZones10(combo: number[]): number {
  return new Set(combo.map(zone10Index)).size;
}

export function coversAllZones15(combo: number[]): boolean {
  return new Set(combo.map(zone15Index)).size === 3;
}

function randomCombo(rng: Rng, core: number | null): number[] {
  const pool: number[] = [];
  for (let n = 1; n <= 45; n += 1) if (n !== core) pool.push(n);
  const picked = rng.sample(pool, core !== null ? 5 : 6);
  if (core !== null) picked.push(core);
  return picked.sort((a, b) => a - b);
}

/** 충족한 균형 조건 개수 (0~4). 완화 단계에서 '가장 좋은 조합' 선택 기준. */
function balanceScore(combo: number[], prefer33: boolean): number {
  const oc = oddCount(combo);
  let score = 0;
  score += (prefer33 ? oc === 3 : oc >= 2 && oc <= 4) ? 1 : 0;
  score += distinctZones10(combo) >= 3 ? 1 : 0;
  score += coversAllZones15(combo) ? 1 : 0;
  score += consecutivePairs(combo) <= 1 ? 1 : 0;
  return score;
}

/** 조합 1개 생성. mode 'A'=완전 랜덤, 'B'=분석 기반 균형. */
export function generateCombo(
  mode: GenerationMode,
  rng: Rng,
  core: number | null = null,
  maxAttempts = 400,
): number[] {
  if (mode === "A") return randomCombo(rng, core);

  let best: number[] | null = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const combo = randomCombo(rng, core);
    const prefer33 = attempt < Math.floor(maxAttempts / 2); // 전반부는 3:3 우선 시도
    const score = balanceScore(combo, prefer33);
    if (score === 4) return combo;
    const loose = balanceScore(combo, false);
    if (loose > bestScore) {
      best = combo;
      bestScore = loose;
    }
  }
  return best as number[];
}

/** 게임 n개 생성. 게임 간 완전히 동일한 조합은 재추첨으로 방지. */
export function generateGames(
  nGames: number,
  mode: GenerationMode,
  core: number | null = null,
  rng: Rng = defaultRng,
): number[][] {
  const games: number[][] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (games.length < nGames && attempts < nGames * 200) {
    attempts += 1;
    const combo = generateCombo(mode, rng, core);
    const key = combo.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(combo);
  }
  return games;
}
