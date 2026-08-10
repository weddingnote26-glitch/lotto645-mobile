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
import { PATTERN_CONDITION_COUNT, patternScore, type PatternBands } from "./patternAnalyzer";
import { defaultRng } from "./rng";
import type { Rng } from "./types";

/**
 * A = 완전 랜덤, B = 분석 기반 균형, C = 과거 당첨 조합 패턴 기반.
 * A/B는 PC 버전과 동일하고, C는 모바일에서 추가한 방식이다.
 */
export type GenerationMode = "A" | "B" | "C";

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

/**
 * 반드시 넣어야 하는 번호(핵심 추천번호 + 사용자 고정번호)를 하나로 합친다.
 * 중복은 제거하며, 결과가 6개를 넘으면 앞에서부터 6개만 쓴다.
 */
export function lockedNumbers(core: number | null, fixed: number[] = []): number[] {
  const set = new Set<number>();
  if (core !== null) set.add(core);
  for (const n of fixed) {
    if (Number.isInteger(n) && n >= 1 && n <= 45) set.add(n);
  }
  return [...set].sort((a, b) => a - b).slice(0, 6);
}

function randomCombo(rng: Rng, locked: number[]): number[] {
  const lockedSet = new Set(locked);
  const pool: number[] = [];
  for (let n = 1; n <= 45; n += 1) if (!lockedSet.has(n)) pool.push(n);
  const picked = rng.sample(pool, 6 - lockedSet.size);
  return [...picked, ...lockedSet].sort((a, b) => a - b);
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

/**
 * 조합 1개 생성.
 * - 'A' 완전 랜덤
 * - 'B' 분석 기반 균형 (위 균형 조건)
 * - 'C' 패턴 기반 — 과거 당첨 조합에서 흔했던 모양(홀짝·합계·연속·구간·고저)에 맞춘다.
 *
 * B와 C 모두 '조건을 만족하는 조합을 찾을 때까지 다시 뽑되, 정해진 횟수 안에
 * 못 찾으면 가장 많은 조건을 만족한 조합을 쓴다'는 같은 방식이라 멈추지 않는다.
 * bands가 없으면 C는 B와 동일하게 동작한다.
 */
export function generateCombo(
  mode: GenerationMode,
  rng: Rng,
  core: number | null = null,
  maxAttempts = 400,
  bands: PatternBands | null = null,
  fixed: number[] = [],
): number[] {
  const locked = lockedNumbers(core, fixed);

  // 고정번호만으로 6개가 채워지면 더 뽑을 것이 없다 (사실상 수동 번호).
  if (locked.length === 6) return locked;

  if (mode === "A") return randomCombo(rng, locked);

  const usePattern = mode === "C" && bands !== null;

  let best: number[] | null = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const combo = randomCombo(rng, locked);

    if (usePattern) {
      const score = patternScore(combo, bands);
      if (score === PATTERN_CONDITION_COUNT) return combo;
      if (score > bestScore) {
        best = combo;
        bestScore = score;
      }
      continue;
    }

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
  bands: PatternBands | null = null,
  fixed: number[] = [],
): number[][] {
  const locked = lockedNumbers(core, fixed);

  // 6개가 이미 고정이면 서로 다른 조합이 존재하지 않으므로 1게임만 낸다.
  if (locked.length === 6) return [locked];

  const games: number[][] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (games.length < nGames && attempts < nGames * 200) {
    attempts += 1;
    const combo = generateCombo(mode, rng, core, 400, bands, fixed);
    const key = combo.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(combo);
  }
  return games;
}
