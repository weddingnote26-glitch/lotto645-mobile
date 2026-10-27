// 끝회차 분석 — 회차 번호의 끝자리로 묶어서 보는 방식.
//
//   7끝회차 = 267, 277, 287 … 1237회
//
// 그 묶음 안에서 번대별로 가장 많이 나온 번호를 '최강수'라고 부른다.
//   번대 : 1~10 / 11~20 / 21~30 / 31~40 / 41~45
//   동률이면 모두 포함하므로 보통 5~7개가 나온다.
//
// 제외 규칙: 직전 회차에 이미 나온 최강수는 후보에서 뺀다.
//
// ── 수치를 어떻게 읽어야 하는가 ───────────────────────────────────────
// 회차 번호의 끝자리는 공 추첨과 아무 관계가 없다. 이 묶음은 1236회를
// 10분의 1(약 98~124회차)로 쪼개는 것이라 표본이 작아 빈도 차이가 크게
// 벌어져 보인다. 실제로 1236회 데이터의 카이제곱 검정은 균등 난수와
// 구분되지 않았고(7끝 42.9 / 8끝 43.5, 임계 60.5), 무작위 98회차에서도
// 최다 번호가 21회 이상 나오는 경우가 58%였다. 그래서 이 모듈은 기대
// 출현 횟수와 표준편차 대비 몇 σ인지를 항상 같이 계산해 돌려준다.
// ─────────────────────────────────────────────────────────────────────

import type { LottoData } from "./types";

/** 번대 경계 — 1~10 / 11~20 / 21~30 / 31~40 / 41~45 */
export const BANDS: Array<[number, number]> = [
  [1, 10],
  [11, 20],
  [21, 30],
  [31, 40],
  [41, 45],
];

export function bandLabel(index: number): string {
  const [lo, hi] = BANDS[index];
  return `${lo}~${hi}`;
}

export function bandIndexOf(n: number): number {
  for (let i = 0; i < BANDS.length; i += 1) {
    const [lo, hi] = BANDS[i];
    if (n >= lo && n <= hi) return i;
  }
  return BANDS.length - 1;
}

export interface EndRoundNumber {
  number: number;
  /** 해당 끝회차 묶음 안에서의 출현 횟수 */
  freq: number;
  /** 마지막으로 나온 회차 */
  lastRound: number | null;
  /** 그 뒤로 지나간 '끝회차' 수 */
  gap: number;
  bandIndex: number;
  /** 기대 출현 대비 몇 σ인지 */
  sigma: number;
  /** 직전 회차에 나와서 제외 대상인지 */
  excluded: boolean;
}

export interface EndRoundAnalysis {
  /** 회차 끝자리 0~9 */
  digit: number;
  /** 집계에 쓰인 회차들 */
  rounds: number[];
  fromRound: number;
  /** 번호별 출현 횟수 (인덱스 = 번호) */
  freq: number[];
  /** 번호당 기대 출현 횟수 */
  expected: number;
  /** 기대 출현의 표준편차 */
  sigma: number;
  /** 번대별 최강수 (동률 모두 포함) */
  strongest: EndRoundNumber[];
  /** 직전 회차 출현분을 뺀 후보 */
  candidates: EndRoundNumber[];
  /** 제외된 번호 */
  excluded: EndRoundNumber[];
  /** 제외 기준이 된 직전 회차 */
  previousRound: number | null;
  previousDraw: number[];
  /** 분포가 균등 난수와 구분되는지 (카이제곱) */
  chiSquare: number;
  /** 자유도 44, 유의수준 5% 임계값 */
  chiCritical: number;
  distinguishable: boolean;
}

/** 다음 회차의 끝자리 — 최신 회차 다음 회차 기준 */
export function nextEndDigit(latest: number): number {
  return (latest + 1) % 10;
}

/**
 * 특정 끝자리 묶음을 분석한다. 무작위 요소 없음.
 *
 * @param digit 회차 끝자리 0~9
 * @param fromRound 이 회차 이상만 집계 (추첨기 교체 시점 등)
 */
export function analyzeEndRound(
  data: LottoData,
  digit: number,
  fromRound = 1,
): EndRoundAnalysis {
  const rounds = data.rounds.filter((r) => r >= fromRound && r % 10 === digit);
  const freq = new Array(46).fill(0);
  const lastRound: Array<number | null> = new Array(46).fill(null);

  for (const r of rounds) {
    for (const n of data.draws.get(r) ?? []) {
      freq[n] += 1;
      lastRound[n] = r;
    }
  }

  const n = rounds.length;
  const expected = (n * 6) / 45;
  const sd = Math.sqrt(n * (6 / 45) * (39 / 45));

  // 제외 기준: 전체 회차 중 가장 최신 회차 (끝회차 묶음이 아니라 직전 회차)
  const previousRound = data.rounds.length ? data.rounds[data.rounds.length - 1] : null;
  const previousDraw = previousRound !== null ? [...(data.draws.get(previousRound) ?? [])] : [];
  const prevSet = new Set(previousDraw);

  const make = (num: number): EndRoundNumber => ({
    number: num,
    freq: freq[num],
    lastRound: lastRound[num],
    gap: lastRound[num] === null ? n : rounds.filter((r) => r > (lastRound[num] as number)).length,
    bandIndex: bandIndexOf(num),
    sigma: sd > 0 ? (freq[num] - expected) / sd : 0,
    excluded: prevSet.has(num),
  });

  // 번대별 최다 출현 번호를 모은다 (동률이면 전부).
  const strongest: EndRoundNumber[] = [];
  for (let b = 0; b < BANDS.length; b += 1) {
    const [lo, hi] = BANDS[b];
    let best = -1;
    for (let num = lo; num <= hi; num += 1) best = Math.max(best, freq[num]);
    if (best <= 0) continue;
    for (let num = lo; num <= hi; num += 1) if (freq[num] === best) strongest.push(make(num));
  }
  strongest.sort((a, b) => a.number - b.number);

  let chi = 0;
  if (expected > 0) {
    for (let num = 1; num <= 45; num += 1) chi += (freq[num] - expected) ** 2 / expected;
  }

  return {
    digit,
    rounds,
    fromRound,
    freq,
    expected,
    sigma: sd,
    strongest,
    candidates: strongest.filter((s) => !s.excluded),
    excluded: strongest.filter((s) => s.excluded),
    previousRound,
    previousDraw: previousDraw.sort((a, b) => a - b),
    chiSquare: chi,
    chiCritical: 60.5,
    distinguishable: chi > 60.5,
  };
}
