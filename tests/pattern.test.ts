// 조합 패턴 분석 + 패턴 기반 생성 테스트.
//
// 패턴 통계 자체는 무작위가 전혀 없어 같은 데이터면 항상 같은 값이 나와야 하고,
// 패턴 기반 생성은 '과거에 흔했던 모양 안에 들어오는지'로 검증한다.

import { describe, expect, it } from "vitest";

import { buildLottoData } from "../src/core/excelLoader";
import { generateGames } from "../src/core/combinationGenerator";
import {
  analyzePatterns,
  combinationPattern,
  commonValues,
  patternBands,
  patternScore,
  PATTERN_CONDITION_COUNT,
} from "../src/core/patternAnalyzer";
import { seededRng } from "../src/core/rng";
import { decodeSeedRows } from "../src/data/seedDraws";

const data = buildLottoData(decodeSeedRows(), "seed");
const stats = analyzePatterns(data);
const bands = patternBands(stats);

describe("조합 하나의 형태 계산", () => {
  it("1236회 [12,18,21,29,34,38]을 손으로 센 값과 맞춘다", () => {
    expect(combinationPattern([12, 18, 21, 29, 34, 38])).toEqual({
      odd: 2, // 21, 29
      sum: 152,
      consecutive: 0,
      zones10: 3, // 11~20, 21~30, 31~40
      zones15: 3, // 1~15, 16~30, 31~45
      high: 3, // 29, 34, 38
      maxSameLastDigit: 2, // 18, 38
    });
  });

  it("연속번호와 끝수 중복을 제대로 센다", () => {
    const p = combinationPattern([1, 2, 3, 11, 21, 31]);
    expect(p.consecutive).toBe(2); // 1-2, 2-3
    expect(p.maxSameLastDigit).toBe(4); // 1, 11, 21, 31
    expect(p.odd).toBe(5);
    expect(p.sum).toBe(69);
  });

  it("입력 순서가 달라도 결과가 같다", () => {
    expect(combinationPattern([38, 12, 34, 18, 29, 21])).toEqual(
      combinationPattern([12, 18, 21, 29, 34, 38]),
    );
  });
});

describe("전체 회차 패턴 집계", () => {
  it("모든 분포의 합이 회차 수와 같다", () => {
    expect(stats.totalDraws).toBe(data.rounds.length);
    const sums = [
      stats.oddDist,
      stats.consecutiveDist,
      stats.zones10Dist,
      stats.zones15Dist,
      stats.highDist,
      stats.sameLastDigitDist,
    ].map((d) => d.reduce((a, b) => a + b, 0));
    expect(sums).toEqual(new Array(6).fill(stats.totalDraws));
  });

  it("끝수 합계 = 회차수 × 6", () => {
    expect(stats.lastDigitCounts.reduce((a, b) => a + b, 0)).toBe(stats.totalDraws * 6);
  });

  it("합계 히스토그램이 전체 회차를 빠짐없이 담는다", () => {
    expect(stats.sumBuckets.reduce((a, b) => a + b.count, 0)).toBe(stats.totalDraws);
    expect(stats.sumMin).toBeGreaterThanOrEqual(21);
    expect(stats.sumMax).toBeLessThanOrEqual(255);
    expect(stats.sumP10).toBeLessThan(stats.sumP90);
    expect(stats.sumMean).toBeGreaterThan(stats.sumP10);
    expect(stats.sumMean).toBeLessThan(stats.sumP90);
  });

  it("같은 데이터면 항상 같은 결과 (무작위 요소 없음)", () => {
    expect(analyzePatterns(data)).toEqual(stats);
    expect(patternBands(analyzePatterns(data))).toEqual(bands);
  });

  it("불가능한 값에는 기록이 없다", () => {
    expect(stats.zones10Dist[0]).toBe(0); // 구간 0개짜리 조합은 없다
    expect(stats.zones15Dist[0]).toBe(0);
    expect(stats.sameLastDigitDist[0]).toBe(0); // 최소 1개는 겹친다(=겹침 없음)
  });
});

describe("자주 나온 값 골라내기", () => {
  it("누적 80%를 넘기는 최소 개수만 고른다", () => {
    const dist = [0, 10, 50, 30, 10]; // 합 100
    expect(commonValues(dist, 0.8)).toEqual([2, 3]); // 50 + 30 = 80%
  });

  it("동률이면 작은 값을 먼저 골라 결과가 흔들리지 않는다", () => {
    const dist = [40, 40, 20];
    expect(commonValues(dist, 0.8)).toEqual([0, 1]);
  });

  it("빈 분포는 빈 배열", () => {
    expect(commonValues([0, 0, 0])).toEqual([]);
  });

  it("실제 데이터에서 뽑은 기준이 80% 이상을 덮는다", () => {
    const covered = bands.oddAllowed.reduce((a, v) => a + stats.oddDist[v], 0);
    expect(covered / stats.totalDraws).toBeGreaterThanOrEqual(0.8);
  });
});

describe("패턴 기반 번호 생성 (모드 C)", () => {
  const rng = seededRng(4545);

  it("과거에 흔했던 모양 안에서 뽑는다", () => {
    const games = generateGames(20, "C", null, rng, bands);
    expect(games.length).toBe(20);
    const full = games.filter((g) => patternScore(g, bands) === PATTERN_CONDITION_COUNT);
    // 400회까지 다시 뽑으므로 사실상 전부 조건을 만족한다.
    expect(full.length).toBe(20);
  });

  it("생성된 조합은 언제나 1~45 중복 없는 6개, 오름차순", () => {
    for (const g of generateGames(20, "C", null, rng, bands)) {
      expect(g.length).toBe(6);
      expect(new Set(g).size).toBe(6);
      expect(g.every((n) => n >= 1 && n <= 45)).toBe(true);
      expect(g).toEqual([...g].sort((a, b) => a - b));
    }
  });

  it("핵심 추천번호를 포함시켜도 조건을 지킨다", () => {
    const games = generateGames(10, "C", 15, rng, bands);
    expect(games.every((g) => g.includes(15))).toBe(true);
    expect(games.every((g) => patternScore(g, bands) === PATTERN_CONDITION_COUNT)).toBe(true);
  });

  it("게임 수만큼 생성되고 완전히 같은 조합은 없다", () => {
    for (const n of [1, 5, 10, 20]) {
      const games = generateGames(n, "C", null, rng, bands);
      expect(games.length).toBe(n);
      expect(new Set(games.map((g) => g.join(","))).size).toBe(n);
    }
  });

  it("기준값이 없으면 균형 방식으로 물러나며 멈추지 않는다", () => {
    const games = generateGames(5, "C", null, rng, null);
    expect(games.length).toBe(5);
    expect(games.every((g) => g.length === 6 && new Set(g).size === 6)).toBe(true);
  });
});

describe("기존 방식은 영향받지 않는다", () => {
  it("모드 A·B는 bands를 넘기지 않아도 그대로 동작한다", () => {
    const rng = seededRng(7);
    expect(generateGames(5, "A", null, rng).length).toBe(5);
    expect(generateGames(5, "B", null, rng).length).toBe(5);
  });
});
