// 수열 분석을 근거로 6개 조합을 완성하는 생성기 테스트.

import { describe, expect, it } from "vitest";

import { analyze } from "../src/core/analyzer";
import { buildLottoData } from "../src/core/excelLoader";
import { analyzeGroups, detectPairAlert } from "../src/core/groupAnalyzer";
import { analyzeEndRound, nextEndDigit } from "../src/core/endRoundAnalyzer";
import { analyzePatterns, patternBands } from "../src/core/patternAnalyzer";
import { analyzeParity, parityTargets } from "../src/core/parityAnalyzer";
import { seededRng } from "../src/core/rng";
import {
  buildSeqPlan,
  DEFAULT_SEED_COUNT,
  generateSeqGames,
  SEQ_SOURCES,
  type SeqContext,
  type SeqSource,
} from "../src/core/sequenceGenerator";
import { decodeSeedRows } from "../src/data/seedDraws";

const FROM = 262;
const data = buildLottoData(decodeSeedRows(), "seed");
const analysis = analyze(data);
const bands = patternBands(analyzePatterns(data));
const targets = parityTargets(analyzeParity(analysis), 5);

const ctx: SeqContext = {
  analysis,
  columns: analyzeGroups(data, "column", 3, FROM),
  digits: analyzeGroups(data, "digit", 2, FROM),
  palaces: analyzeGroups(data, "palace", 2, FROM),
  endRound: analyzeEndRound(data, nextEndDigit(analysis.latest), FROM),
  pairAlert: detectPairAlert(data, "digit", 3, FROM),
};

describe("묶음 고르기", () => {
  it("네 가지 분석 모두 계획을 만든다", () => {
    for (const { key } of SEQ_SOURCES) {
      const plan = buildSeqPlan(key, ctx);
      expect(plan, key).not.toBeNull();
      expect(plan!.pool.length).toBeGreaterThan(0);
      expect(plan!.pool.every((n) => n >= 1 && n <= 45)).toBe(true);
      expect(plan!.caution.length).toBeGreaterThan(0); // 안내 문구는 항상 있어야 한다
    }
  });

  it("세로줄은 가장 오래 쉰 줄을 고른다", () => {
    const plan = buildSeqPlan("column", ctx)!;
    expect(plan.pool).toEqual([6, 13, 20, 27, 34, 41]); // 6세로
    expect(plan.title).toContain("6세로");
    expect(plan.seedCount).toBe(DEFAULT_SEED_COUNT.column);
  });

  it("끝회차는 직전 회차 출현분을 뺀 후보를 쓴다", () => {
    const plan = buildSeqPlan("endRound", ctx)!;
    const prev = new Set(ctx.endRound!.previousDraw);
    expect(plan.pool.some((n) => prev.has(n))).toBe(false);
  });

  it("끝수는 쌍동끝 알림이 있으면 그 예상수를 쓴다", () => {
    const plan = buildSeqPlan("digit", ctx)!;
    if (ctx.pairAlert) {
      expect(plan.pool).toEqual(ctx.pairAlert.pool);
      expect(plan.caution).toContain("무작위보다 높지 않습니다");
    }
  });

  it("포함 개수는 묶음 크기를 넘지 않는다", () => {
    const plan = buildSeqPlan("column", ctx, 99)!;
    expect(plan.seedCount).toBe(plan.pool.length);
  });

  it("같은 입력이면 같은 계획", () => {
    expect(buildSeqPlan("palace", ctx)).toEqual(buildSeqPlan("palace", ctx));
  });
});

describe("조합 생성", () => {
  const sources: SeqSource[] = ["column", "digit", "palace", "endRound"];

  for (const src of sources) {
    it(`${src}: 유효한 6개 조합을 게임 수만큼 만든다`, () => {
      const plan = buildSeqPlan(src, ctx)!;
      const games = generateSeqGames(plan, 5, "B", null, bands, targets, seededRng(7));
      expect(games.length).toBe(5);
      for (const g of games) {
        expect(g.numbers.length).toBe(6);
        expect(new Set(g.numbers).size).toBe(6);
        expect(g.numbers.every((n) => n >= 1 && n <= 45)).toBe(true);
        expect(g.numbers).toEqual([...g.numbers].sort((a, b) => a - b));
      }
      // 게임끼리 완전히 같은 조합은 없다
      expect(new Set(games.map((g) => g.numbers.join(","))).size).toBe(5);
    });

    it(`${src}: 매 게임이 묶음에서 정해진 개수만큼 포함한다`, () => {
      const plan = buildSeqPlan(src, ctx)!;
      const games = generateSeqGames(plan, 5, "B", null, bands, targets, seededRng(11));
      for (const g of games) {
        const fromPool = g.numbers.filter((n) => plan.pool.includes(n));
        expect(fromPool.length).toBeGreaterThanOrEqual(plan.seedCount);
      }
    });
  }

  it("게임마다 묶음에서 다른 조합을 뽑아 넓게 덮는다", () => {
    const plan = buildSeqPlan("column", ctx)!;
    const games = generateSeqGames(plan, 10, "B", null, bands, [], seededRng(3));
    const covered = new Set(games.flatMap((g) => g.seed));
    expect(covered.size).toBeGreaterThan(plan.seedCount); // 같은 3개만 반복하지 않는다
  });

  it("핵심 추천번호를 함께 넣어도 6개를 유지한다", () => {
    const plan = buildSeqPlan("column", ctx)!;
    const games = generateSeqGames(plan, 5, "B", 15, bands, [], seededRng(5));
    for (const g of games) {
      expect(g.numbers.length).toBe(6);
      expect(new Set(g.numbers).size).toBe(6);
      expect(g.numbers).toContain(15);
    }
  });

  it("완전 랜덤 보충에서도 묶음 번호는 지킨다", () => {
    const plan = buildSeqPlan("palace", ctx)!;
    const games = generateSeqGames(plan, 5, "A", null, bands, [], seededRng(9));
    for (const g of games) {
      expect(g.numbers.filter((n) => plan.pool.includes(n)).length).toBeGreaterThanOrEqual(
        plan.seedCount,
      );
    }
  });

  it("포함 개수 1~4 모두 동작한다", () => {
    for (const c of [1, 2, 3, 4]) {
      const plan = buildSeqPlan("column", ctx, c)!;
      const games = generateSeqGames(plan, 3, "B", null, bands, [], seededRng(c));
      expect(games.length).toBe(3);
      expect(games.every((g) => g.numbers.length === 6)).toBe(true);
    }
  });
});
