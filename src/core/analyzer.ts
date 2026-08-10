// 분석 엔진 — PC 버전 core/analyzer.py의 1:1 이식.
//
// - 최근 5회 / 최근 10회 두 범위를 항상 분석한다 (회차 숫자 정렬 기준).
// - 보너스 번호는 어떤 계산에도 넣지 않는다.
// - 10단위 구간은 41~45가 5개뿐이므로 '구간 크기 보정 출현률'을 함께 계산한다.
//   보정 출현률 = 실제 출현 횟수 ÷ 이론적 기대 횟수(전체 번호 수 × 구간크기/45)
//
// 계산식과 연산 순서는 Python 쪽과 동일하게 유지한다. 순서를 바꾸면 부동소수점
// 결과가 미세하게 달라져 동률 판정(1e-9)이 흔들릴 수 있다.

import type { Analysis, LottoData, NumberStats, WindowSummary } from "./types";
import { latestRound, recentRounds } from "./types";

export const ZONES10: Array<[number, number]> = [
  [1, 10],
  [11, 20],
  [21, 30],
  [31, 40],
  [41, 45],
];
export const ZONES15: Array<[number, number]> = [
  [1, 15],
  [16, 30],
  [31, 45],
];
export const ZONE10_LABELS = ["1~10", "11~20", "21~30", "31~40", "41~45"];
export const ZONE15_LABELS = ["1~15", "16~30", "31~45"];

/** 보정 출현률 '높음' 기준 */
export const HIGH_THRESHOLD = 1.15;
/** 보정 출현률 '낮음' 기준 */
export const LOW_THRESHOLD = 0.85;

export function zone10Index(n: number): number {
  return Math.min(Math.floor((n - 1) / 10), 4);
}

export function zone15Index(n: number): number {
  return Math.floor((n - 1) / 15);
}

export function rateLevel(rate: number): string {
  if (rate >= HIGH_THRESHOLD) return "높음";
  if (rate <= LOW_THRESHOLD) return "낮음";
  return "보통";
}

function summarizeWindow(data: LottoData, n: number): WindowSummary {
  const rounds = recentRounds(data, n);
  const pool: number[] = [];
  for (const r of rounds) {
    const draw = data.draws.get(r);
    if (draw) pool.push(...draw);
  }
  const total = pool.length;
  let odd = 0;
  for (const v of pool) if (v % 2 === 1) odd += 1;

  const z10 = [0, 0, 0, 0, 0];
  const z15 = [0, 0, 0];
  for (const v of pool) {
    z10[zone10Index(v)] += 1;
    z15[zone15Index(v)] += 1;
  }

  const rates: number[] = [];
  const levels: string[] = [];
  for (let i = 0; i < ZONES10.length; i += 1) {
    const [lo, hi] = ZONES10[i];
    const size = hi - lo + 1;
    const expected = total ? (total * size) / 45 : 0;
    const rate = expected ? z10[i] / expected : 0.0;
    rates.push(rate);
    levels.push(rateLevel(rate));
  }
  const ratios15 = z15.map((c) => (total ? c / total : 0.0));

  return {
    rounds,
    totalBalls: total,
    odd,
    even: total - odd,
    zone10Counts: z10,
    zone10Rates: rates,
    zone10Levels: levels,
    zone15Counts: z15,
    zone15Ratios: ratios15,
    oddRatio: total ? odd / total : 0.0,
    evenRatio: total ? (total - odd) / total : 0.0,
  };
}

/**
 * LottoData -> Analysis.
 * 모든 수치는 같은 입력에 대해 항상 같은 결과 (무작위 요소 없음).
 */
export function analyze(data: LottoData): Analysis {
  const latest = latestRound(data);
  const r5 = new Set(recentRounds(data, 5));
  const r10 = new Set(recentRounds(data, 10));
  const latestSet = new Set(data.draws.get(latest) ?? []);

  const stats: Record<number, NumberStats> = {};
  for (let n = 1; n <= 45; n += 1) {
    const appearances = data.rounds.filter((r) => (data.draws.get(r) ?? []).includes(n));
    const lastRound = appearances.length ? appearances[appearances.length - 1] : null;
    let cnt5 = 0;
    let cnt10 = 0;
    for (const r of appearances) {
      if (r5.has(r)) cnt5 += 1;
      if (r10.has(r)) cnt10 += 1;
    }
    stats[n] = {
      number: n,
      cnt5,
      cnt10,
      cntTotal: appearances.length,
      lastRound,
      gap: lastRound !== null ? latest - lastRound : data.rounds.length,
      inPrev: latestSet.has(n),
      in5: cnt5 > 0,
      in10: cnt10 > 0,
      odd: n % 2 === 1,
      zone10: zone10Index(n),
      zone15: zone15Index(n),
      appearances,
    };
  }

  return {
    data,
    latest,
    stats,
    win5: summarizeWindow(data, 5),
    win10: summarizeWindow(data, 10),
  };
}
