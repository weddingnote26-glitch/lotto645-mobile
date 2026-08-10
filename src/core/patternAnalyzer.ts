// 당첨 조합의 '형태 패턴' 분석.
//
// 지금까지 실제로 당첨된 6개 조합들이 어떤 모양이었는지를 집계한다.
// 번호 하나하나의 빈도(analyzer.ts)와 달리, 여기서는 조합 전체의 성질을 본다.
//
//   홀짝 비율 / 번호 합계 / 연속번호 쌍 / 10단위 구간을 몇 개나 걸쳤는지 /
//   저(1~22)·고(23~45) 비율 / 같은 끝수(1의 자리) 중복
//
// 이 통계는 '패턴 기반' 번호 생성(모드 C)의 기준이 된다. 과거에 거의 나오지
// 않았던 극단적인 모양(예: 6개 모두 홀수, 합계 60 이하)을 피하려는 목적이며,
// 당첨 확률을 높이는 규칙이 아니다. 로또는 매회 독립적인 무작위 추첨이다.

import { zone10Index, zone15Index } from "./analyzer";
import type { LottoData } from "./types";

/** 저(1~22) / 고(23~45) 경계 */
export const HIGH_FROM = 23;

/** 조합 하나의 형태 */
export interface CombinationPattern {
  /** 홀수 개수 (0~6) */
  odd: number;
  /** 6개 번호의 합 (21~255) */
  sum: number;
  /** 연속한 두 수 쌍의 개수 */
  consecutive: number;
  /** 10단위 구간을 몇 개나 걸쳤는지 (1~5) */
  zones10: number;
  /** 15단위 구간을 몇 개나 걸쳤는지 (1~3) */
  zones15: number;
  /** 고(23~45) 번호 개수 (0~6) */
  high: number;
  /** 같은 끝수(1의 자리)가 가장 많이 겹친 개수 (1~6) */
  maxSameLastDigit: number;
}

export function combinationPattern(combo: number[]): CombinationPattern {
  const c = [...combo].sort((a, b) => a - b);
  let odd = 0;
  let sum = 0;
  let high = 0;
  let consecutive = 0;
  const digits = new Array<number>(10).fill(0);

  for (let i = 0; i < c.length; i += 1) {
    const v = c[i];
    sum += v;
    if (v % 2 === 1) odd += 1;
    if (v >= HIGH_FROM) high += 1;
    digits[v % 10] += 1;
    if (i > 0 && c[i] === c[i - 1] + 1) consecutive += 1;
  }

  return {
    odd,
    sum,
    consecutive,
    zones10: new Set(c.map(zone10Index)).size,
    zones15: new Set(c.map(zone15Index)).size,
    high,
    maxSameLastDigit: Math.max(...digits),
  };
}

/** 값 -> 출현 횟수. 배열 인덱스가 곧 값이다. */
export type Distribution = number[];

export interface SumBucket {
  label: string;
  from: number;
  to: number;
  count: number;
}

export interface PatternStats {
  /** 분석한 회차 수 */
  totalDraws: number;
  /** 홀수 개수 분포 (인덱스 0~6) */
  oddDist: Distribution;
  /** 연속번호 쌍 개수 분포 (인덱스 0~5) */
  consecutiveDist: Distribution;
  /** 10단위 구간 개수 분포 (인덱스 0~5, 0은 항상 비어 있음) */
  zones10Dist: Distribution;
  /** 15단위 구간 개수 분포 (인덱스 0~3) */
  zones15Dist: Distribution;
  /** 고(23~45) 번호 개수 분포 (인덱스 0~6) */
  highDist: Distribution;
  /** 같은 끝수 최다 중복 개수 분포 (인덱스 0~6) */
  sameLastDigitDist: Distribution;
  /** 끝수(1의 자리)별 전체 출현 횟수 (인덱스 0~9) */
  lastDigitCounts: Distribution;
  /** 합계 히스토그램 */
  sumBuckets: SumBucket[];
  sumMin: number;
  sumMax: number;
  sumMean: number;
  /** 합계 하위 10% 지점 */
  sumP10: number;
  /** 합계 상위 10% 지점 */
  sumP90: number;
}

function tally(size: number, values: number[]): Distribution {
  const dist = new Array<number>(size).fill(0);
  for (const v of values) {
    if (v >= 0 && v < size) dist[v] += 1;
  }
  return dist;
}

/** 최소 순위(nearest-rank) 방식 백분위. 같은 입력이면 항상 같은 값. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  return sortedAsc[Math.min(Math.max(rank, 1), sortedAsc.length) - 1];
}

const SUM_BUCKET_EDGES = [21, 60, 80, 100, 120, 140, 160, 180, 200, 220, 255];

/** 전체 회차의 당첨 조합 형태를 집계한다. 무작위 요소 없음. */
export function analyzePatterns(data: LottoData): PatternStats {
  const patterns: CombinationPattern[] = [];
  for (const r of data.rounds) {
    const draw = data.draws.get(r);
    if (draw) patterns.push(combinationPattern(draw));
  }

  const sums = patterns.map((p) => p.sum);
  const sortedSums = [...sums].sort((a, b) => a - b);

  const lastDigitCounts = new Array<number>(10).fill(0);
  for (const r of data.rounds) {
    for (const v of data.draws.get(r) ?? []) lastDigitCounts[v % 10] += 1;
  }

  const sumBuckets: SumBucket[] = [];
  for (let i = 0; i + 1 < SUM_BUCKET_EDGES.length; i += 1) {
    const from = i === 0 ? SUM_BUCKET_EDGES[0] : SUM_BUCKET_EDGES[i] + 1;
    const to = SUM_BUCKET_EDGES[i + 1];
    sumBuckets.push({
      label: `${from}~${to}`,
      from,
      to,
      count: sums.filter((s) => s >= from && s <= to).length,
    });
  }

  return {
    totalDraws: patterns.length,
    oddDist: tally(7, patterns.map((p) => p.odd)),
    consecutiveDist: tally(6, patterns.map((p) => p.consecutive)),
    zones10Dist: tally(6, patterns.map((p) => p.zones10)),
    zones15Dist: tally(4, patterns.map((p) => p.zones15)),
    highDist: tally(7, patterns.map((p) => p.high)),
    sameLastDigitDist: tally(7, patterns.map((p) => p.maxSameLastDigit)),
    lastDigitCounts,
    sumBuckets,
    sumMin: sortedSums.length ? sortedSums[0] : 0,
    sumMax: sortedSums.length ? sortedSums[sortedSums.length - 1] : 0,
    sumMean: sums.length ? sums.reduce((a, b) => a + b, 0) / sums.length : 0,
    sumP10: percentile(sortedSums, 10),
    sumP90: percentile(sortedSums, 90),
  };
}

/**
 * 분포에서 '자주 나온 값'만 골라낸다.
 * 빈도 내림차순으로 담다가 누적 비율이 coverage를 넘으면 멈춘다.
 * 동률이면 값이 작은 쪽을 먼저 담아 항상 같은 결과가 나오게 한다.
 */
export function commonValues(dist: Distribution, coverage = 0.8): number[] {
  const total = dist.reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const order = dist
    .map((count, value) => ({ value, count }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count || a.value - b.value);

  const picked: number[] = [];
  let acc = 0;
  for (const e of order) {
    picked.push(e.value);
    acc += e.count / total;
    if (acc >= coverage) break;
  }
  return picked.sort((a, b) => a - b);
}

/** 패턴 기반 생성이 참고하는 기준값. 데이터가 같으면 항상 같다. */
export interface PatternBands {
  oddAllowed: number[];
  consecutiveAllowed: number[];
  zones10Allowed: number[];
  highAllowed: number[];
  sumFrom: number;
  sumTo: number;
}

export function patternBands(stats: PatternStats): PatternBands {
  return {
    oddAllowed: commonValues(stats.oddDist),
    consecutiveAllowed: commonValues(stats.consecutiveDist),
    zones10Allowed: commonValues(stats.zones10Dist),
    highAllowed: commonValues(stats.highDist),
    sumFrom: stats.sumP10,
    sumTo: stats.sumP90,
  };
}

/**
 * 조합이 각 기준을 몇 개나 만족하는지 (0~5). 모드 C의 채점 기준.
 *
 * targetOdd가 주어지면 홀짝만 그 값으로 판정한다 (최근 5·10회 흐름 반영).
 * 넘기지 않으면 전체 회차 기준인 bands.oddAllowed를 그대로 쓴다.
 */
export function patternScore(
  combo: number[],
  bands: PatternBands,
  targetOdd: number | null = null,
): number {
  const p = combinationPattern(combo);
  let score = 0;
  if (targetOdd !== null ? p.odd === targetOdd : bands.oddAllowed.includes(p.odd)) score += 1;
  if (bands.consecutiveAllowed.includes(p.consecutive)) score += 1;
  if (bands.zones10Allowed.includes(p.zones10)) score += 1;
  if (bands.highAllowed.includes(p.high)) score += 1;
  if (p.sum >= bands.sumFrom && p.sum <= bands.sumTo) score += 1;
  return score;
}

export const PATTERN_CONDITION_COUNT = 5;
