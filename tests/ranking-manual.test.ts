// 2~6순위 추천번호 + 고정번호(반자동/수동) 테스트.
//
// 가장 중요한 것은 "1순위가 절대 달라지지 않는다"는 점이다.
// 순위 목록은 새 점수 체계가 아니라 기존 순차 필터를 후보만 줄여 다시 돌린 결과다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { analyze } from "../src/core/analyzer";
import { buildLottoData } from "../src/core/excelLoader";
import { generateGames, lockedNumbers } from "../src/core/combinationGenerator";
import { patternBands, analyzePatterns } from "../src/core/patternAnalyzer";
import { rankRecommendedNumbers, selectCoreNumber } from "../src/core/numberSelector";
import { seededRng } from "../src/core/rng";
import { decodeSeedRows } from "../src/data/seedDraws";

const HERE = dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(readFileSync(join(HERE, "fixtures", "pc_reference.json"), "utf8"));

const data = buildLottoData(decodeSeedRows(), "seed");
const analysis = analyze(data);
const bands = patternBands(analyzePatterns(data));

describe("2~6순위 추천번호", () => {
  const ranked = rankRecommendedNumbers(analysis, 6);

  it("1순위는 기존 핵심 추천번호와 반드시 같다", () => {
    expect(ranked[0].number).toBe(ref.core_number);
    expect(ranked[0].number).toBe(selectCoreNumber(analysis).number);
    expect(ranked[0].rank).toBe(1);
  });

  it("6개가 나오고 순위가 1~6으로 매겨진다", () => {
    expect(ranked.length).toBe(6);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("번호가 서로 겹치지 않고 모두 1~45 범위다", () => {
    const nums = ranked.map((r) => r.number);
    expect(new Set(nums).size).toBe(6);
    expect(nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)).toBe(true);
  });

  it("순위마다 선정 근거(단계 로그)가 남는다", () => {
    for (const r of ranked) {
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.steps[0].detail.length).toBeGreaterThan(0);
    }
  });

  it("개수를 바꿔도 앞부분 순위는 그대로다", () => {
    const three = rankRecommendedNumbers(analysis, 3);
    expect(three.map((r) => r.number)).toEqual(ranked.slice(0, 3).map((r) => r.number));
  });

  it("후보 풀을 넘기지 않으면 기존 동작과 완전히 같다", () => {
    const plain = selectCoreNumber(analysis);
    const withFullPool = selectCoreNumber(
      analysis,
      undefined,
      Array.from({ length: 45 }, (_, i) => i + 1),
    );
    expect(withFullPool.number).toBe(plain.number);
    expect(withFullPool.steps.map((s) => s.detail)).toEqual(plain.steps.map((s) => s.detail));
  });
});

describe("고정번호 합치기", () => {
  it("추천번호와 고정번호가 겹치면 한 번만 넣는다", () => {
    expect(lockedNumbers(15, [15, 29])).toEqual([15, 29]);
  });

  it("추천번호 없이 고정번호만 쓸 수 있다", () => {
    expect(lockedNumbers(null, [29, 15])).toEqual([15, 29]);
  });

  it("범위 밖·중복 값은 버린다", () => {
    expect(lockedNumbers(null, [0, 46, 7, 7, -3])).toEqual([7]);
  });

  it("6개를 넘으면 6개까지만 쓴다", () => {
    expect(lockedNumbers(1, [2, 3, 4, 5, 6, 7, 8]).length).toBe(6);
  });
});

describe("반자동 — 고정번호 + 자동 보충", () => {
  const rng = seededRng(910);

  for (const fixedCount of [1, 2, 3, 5]) {
    it(`${fixedCount}개 고정 + 나머지 자동`, () => {
      const fixed = [3, 11, 22, 30, 41].slice(0, fixedCount);
      const games = generateGames(10, "B", null, rng, bands, fixed);
      expect(games.length).toBe(10);
      for (const g of games) {
        expect(g.length).toBe(6);
        expect(new Set(g).size).toBe(6);
        expect(g.every((n) => n >= 1 && n <= 45)).toBe(true);
        expect(g).toEqual([...g].sort((a, b) => a - b));
        for (const f of fixed) expect(g).toContain(f);
      }
      expect(new Set(games.map((g) => g.join(","))).size).toBe(10);
    });
  }

  it("고정번호가 6개면 그 조합 한 게임만 나온다", () => {
    const fixed = [1, 2, 3, 4, 5, 6];
    const games = generateGames(20, "B", null, rng, bands, fixed);
    expect(games).toEqual([[1, 2, 3, 4, 5, 6]]);
  });

  it("핵심 추천번호와 고정번호가 겹쳐도 6개를 유지한다", () => {
    const games = generateGames(10, "B", 15, rng, bands, [15, 29]);
    for (const g of games) {
      expect(g.length).toBe(6);
      expect(new Set(g).size).toBe(6);
      expect(g).toContain(15);
      expect(g).toContain(29);
    }
  });

  it("패턴 기반·완전 랜덤 보충에서도 고정번호가 지켜진다", () => {
    for (const mode of ["A", "C"] as const) {
      const games = generateGames(10, mode, null, rng, bands, [8, 19]);
      for (const g of games) {
        expect(g.length).toBe(6);
        expect(new Set(g).size).toBe(6);
        expect(g).toContain(8);
        expect(g).toContain(19);
      }
    }
  });
});

describe("자동 생성은 예전 그대로", () => {
  it("고정번호를 넘기지 않으면 기존 동작과 같다", () => {
    const a = generateGames(5, "B", 15, seededRng(1), bands);
    const b = generateGames(5, "B", 15, seededRng(1), bands, []);
    expect(a).toEqual(b);
    expect(a.every((g) => g.includes(15))).toBe(true);
  });

  it("추천번호도 고정번호도 없으면 6개 전부 자유롭게 뽑는다", () => {
    const games = generateGames(20, "B", null, seededRng(2), bands, []);
    expect(games.length).toBe(20);
    expect(games.every((g) => g.length === 6 && new Set(g).size === 6)).toBe(true);
  });
});
