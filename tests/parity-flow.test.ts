// 최근 5·10회 홀짝 분포 기반 생성 테스트.
//
// 핵심은 "홀짝 목표가 코드에 박혀 있지 않고 데이터에서 나온다"는 점이다.
// 데이터를 바꾸면 목표도 따라 바뀌어야 한다.

import { describe, expect, it } from "vitest";

import { analyze } from "../src/core/analyzer";
import { generateGames } from "../src/core/combinationGenerator";
import { buildLottoData } from "../src/core/excelLoader";
import { analyzeParity, parityLabel, parityTargets } from "../src/core/parityAnalyzer";
import { analyzePatterns, patternBands } from "../src/core/patternAnalyzer";
import { seededRng } from "../src/core/rng";
import { decodeSeedRows } from "../src/data/seedDraws";

const data = buildLottoData(decodeSeedRows(), "seed");
const analysis = analyze(data);
const bands = patternBands(analyzePatterns(data));
const profile = analyzeParity(analysis);

const oddCount = (combo: number[]) => combo.filter((n) => n % 2 === 1).length;

describe("최근 홀짝 분포 집계", () => {
  it("최근 5회·10회의 회차 수와 합계가 맞는다", () => {
    expect(profile.byOdd.reduce((a, p) => a + p.count5, 0)).toBe(analysis.win5.rounds.length);
    expect(profile.byOdd.reduce((a, p) => a + p.count10, 0)).toBe(analysis.win10.rounds.length);
  });

  it("점수 = 최근5회 × 2 + 최근10회", () => {
    for (const p of profile.byOdd) {
      expect(p.score).toBe(p.count5 * 2 + p.count10);
    }
  });

  it("최근 10회 홀짝 개수가 win10 통계와 일치한다", () => {
    const totalOdd = profile.byOdd.reduce((a, p) => a + p.odd * p.count10, 0);
    expect(totalOdd).toBe(analysis.win10.odd);
  });

  it("우세 패턴은 점수가 가장 높은 값이다", () => {
    const best = Math.max(...profile.byOdd.map((p) => p.score));
    expect(profile.top?.score).toBe(best);
  });

  it("같은 데이터면 항상 같은 결과", () => {
    expect(analyzeParity(analysis)).toEqual(profile);
  });

  it("데이터가 바뀌면 기준도 바뀐다 (하드코딩 아님)", () => {
    // 홀수만 6개씩 나온 가짜 데이터 → 우세 패턴은 홀 6개여야 한다.
    const allOdd = analyze(
      buildLottoData(
        Array.from({ length: 12 }, (_, i) => [i + 1, 1, 3, 5, 7, 9, 11, 13]),
        "all-odd",
      ),
    );
    expect(analyzeParity(allOdd).top?.odd).toBe(6);

    // 짝수만 6개씩 → 홀 0개
    const allEven = analyze(
      buildLottoData(
        Array.from({ length: 12 }, (_, i) => [i + 1, 2, 4, 6, 8, 10, 12, 14]),
        "all-even",
      ),
    );
    expect(analyzeParity(allEven).top?.odd).toBe(0);
  });
});

describe("게임별 목표 홀짝 배분", () => {
  it("게임 수만큼 나오고 1게임이면 우세 패턴 하나", () => {
    for (const n of [1, 5, 10, 20]) {
      expect(parityTargets(profile, n).length).toBe(n);
    }
    expect(parityTargets(profile, 1)).toEqual([profile.top?.odd]);
  });

  it("여러 게임이면 한 가지 비율로만 채우지 않는다", () => {
    const t20 = parityTargets(profile, 20);
    expect(new Set(t20).size).toBeGreaterThan(1);
  });

  it("자주 나온 패턴이 더 많은 게임을 차지한다", () => {
    const t20 = parityTargets(profile, 20);
    const counts = new Map<number, number>();
    for (const v of t20) counts.set(v, (counts.get(v) ?? 0) + 1);
    const topShare = counts.get(profile.top!.odd) ?? 0;
    for (const [odd, c] of counts) {
      if (odd !== profile.top!.odd) expect(topShare).toBeGreaterThanOrEqual(c);
    }
  });

  it("같은 입력이면 항상 같은 배분", () => {
    expect(parityTargets(profile, 10)).toEqual(parityTargets(profile, 10));
  });

  it("데이터가 없으면 빈 배열", () => {
    const empty = { byOdd: [], ranked: [], top: null, totalScore: 0 };
    expect(parityTargets(empty, 5)).toEqual([]);
  });

  it("표시 문구", () => {
    expect(parityLabel(3)).toBe("홀 3 : 짝 3");
    expect(parityLabel(4)).toBe("홀 4 : 짝 2");
  });
});

describe("목표 홀짝을 반영한 번호 생성", () => {
  const rng = seededRng(5150);

  it("분석 기반: 각 게임이 배분된 목표 홀수 개수를 따른다", () => {
    const targets = parityTargets(profile, 10);
    const games = generateGames(10, "B", null, rng, bands, [], targets);
    expect(games.length).toBe(10);
    games.forEach((g, i) => {
      expect(oddCount(g)).toBe(targets[i]);
      expect(g.length).toBe(6);
      expect(new Set(g).size).toBe(6);
    });
  });

  it("패턴 기반에서도 목표 홀수 개수를 따른다", () => {
    const targets = parityTargets(profile, 10);
    const games = generateGames(10, "C", null, rng, bands, [], targets);
    games.forEach((g, i) => expect(oddCount(g)).toBe(targets[i]));
  });

  it("고정번호가 있어도 목표를 지키며 고정번호를 포함한다", () => {
    const fixed = [7, 20]; // 홀 1개 + 짝 1개
    const fixedOdd = oddCount(fixed);
    const fixedEven = fixed.length - fixedOdd;
    const targets = parityTargets(profile, 5);
    const games = generateGames(5, "B", null, rng, bands, fixed, targets);

    games.forEach((g, i) => {
      expect(g).toContain(7);
      expect(g).toContain(20);
      // 고정번호 때문에 도달할 수 없는 목표(예: 짝수를 고정했는데 홀 6개)는
      // 강제하지 않고 가장 가까운 조합으로 물러난다.
      const reachable = targets[i] >= fixedOdd && 6 - targets[i] >= fixedEven;
      if (reachable) expect(oddCount(g)).toBe(targets[i]);
    });
  });

  it("도달 불가능한 목표를 줘도 멈추지 않고 유효한 조합을 낸다", () => {
    // 짝수 5개를 고정한 채 '홀 6개'를 목표로 두는 모순 상황
    const games = generateGames(3, "B", null, rng, bands, [2, 4, 6, 8, 10], [6, 6, 6]);
    expect(games.length).toBe(3);
    for (const g of games) {
      expect(g.length).toBe(6);
      expect(new Set(g).size).toBe(6);
      for (const f of [2, 4, 6, 8, 10]) expect(g).toContain(f);
    }
  });

  it("완전 랜덤은 목표를 적용하지 않는다 (진짜 무작위 유지)", () => {
    const targets = new Array(30).fill(3);
    const games = generateGames(30, "A", null, seededRng(9), bands, [], targets);
    expect(games.every((g) => oddCount(g) === 3)).toBe(false);
  });

  it("목표를 넘기지 않으면 예전 동작 그대로", () => {
    const a = generateGames(5, "B", 15, seededRng(3), bands, []);
    const b = generateGames(5, "B", 15, seededRng(3), bands, [], []);
    expect(a).toEqual(b);
  });

  it("여러 게임의 홀짝이 실제로 다양하게 나온다", () => {
    const targets = parityTargets(profile, 20);
    const games = generateGames(20, "B", null, rng, bands, [], targets);
    expect(new Set(games.map(oddCount)).size).toBeGreaterThan(1);
    expect(new Set(games.map((g) => g.join(","))).size).toBe(20);
  });
});
