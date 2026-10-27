// 수열 분석(세로줄 · 끝수 · 9궁도 · 끝회차)을 근거로 6개 조합을 완성한다.
//
// 방식은 단순하다.
//   ① 분석에서 '주목할 번호 묶음'을 고른다 (가장 오래 쉰 세로줄, 최강수 후보 등)
//   ② 그 묶음에서 몇 개를 뽑아 고정하고
//   ③ 나머지는 기존 생성기(분석 기반 / 패턴 기반 / 완전 랜덤)로 채운다
//
// 게임마다 묶음에서 다른 조합을 뽑으므로, 여러 게임을 만들면 그 묶음을 더
// 넓게 덮는다. 묶음 자체는 분석 결과라 바뀌지 않는다.
//
// ── 짚어 둘 것 ────────────────────────────────────────────────────────
// 이 방식이 당첨 확률을 올리지는 않는다. 묶음에서 뽑든 전체에서 뽑든 한 조합이
// 1등일 확률은 똑같이 1/8,145,060이다. 여기서 하는 일은 "어떤 근거로 이 번호를
// 골랐는지"를 남기는 것뿐이고, 그래서 각 조합에 근거 문구를 함께 돌려준다.
// ─────────────────────────────────────────────────────────────────────

import { generateCombo, lockedNumbers, type GenerationMode } from "./combinationGenerator";
import type { GroupAnalysis, PairAlert } from "./groupAnalyzer";
import type { EndRoundAnalysis } from "./endRoundAnalyzer";
import type { PatternBands } from "./patternAnalyzer";
import { defaultRng } from "./rng";
import type { Analysis, Rng } from "./types";

export type SeqSource = "column" | "digit" | "palace" | "endRound";

export const SEQ_SOURCES: Array<{ key: SeqSource; label: string }> = [
  { key: "column", label: "세로줄" },
  { key: "digit", label: "끝수" },
  { key: "palace", label: "9궁도" },
  { key: "endRound", label: "끝회차" },
];

/** 분석별 기본 포함 개수 — 그 분석이 '사건'으로 보는 기준과 맞춘다. */
export const DEFAULT_SEED_COUNT: Record<SeqSource, number> = {
  column: 3, // 3출 이상이 기준
  digit: 2, // 동끝 = 2개
  palace: 2, // 동궁 = 2개
  endRound: 2, // 최강수 중 고정수
};

export interface SeqPlan {
  source: SeqSource;
  /** "세로줄 6세로" */
  title: string;
  /** "103회 미출 · 이론 평균 42.0회마다" */
  detail: string;
  /** 왜 이 묶음인지 */
  reason: string;
  /** 뽑기 대상 번호들 */
  pool: number[];
  /** 번호별 전체 미출주기 (표시용) */
  gaps: Record<number, number>;
  /** 한 게임에 몇 개를 넣을지 */
  seedCount: number;
  /** 수치를 오해하지 않도록 덧붙이는 안내 */
  caution: string;
}

export interface SeqContext {
  analysis: Analysis;
  columns: GroupAnalysis | null;
  digits: GroupAnalysis | null;
  palaces: GroupAnalysis | null;
  endRound: EndRoundAnalysis | null;
  pairAlert: PairAlert | null;
}

function pctText(p: number): string {
  return `${(p * 100).toFixed(2)}%`;
}

/** 선택한 분석에서 '주목할 묶음'을 뽑아 계획을 만든다. 무작위 요소 없음. */
export function buildSeqPlan(
  source: SeqSource,
  ctx: SeqContext,
  seedCount = DEFAULT_SEED_COUNT[source],
): SeqPlan | null {
  const { analysis } = ctx;
  const gapsOf = (pool: number[]): Record<number, number> =>
    Object.fromEntries(pool.map((n) => [n, analysis.stats[n]?.gap ?? 0]));

  if (source === "endRound") {
    const e = ctx.endRound;
    if (!e) return null;
    // 최강수에서 직전 회차 출현분을 뺀 후보. 다 빠졌으면 최강수 전체로 되돌린다.
    const pool = (e.candidates.length ? e.candidates : e.strongest).map((c) => c.number);
    if (pool.length === 0) return null;
    const excludedText = e.excluded.length
      ? ` · 직전 ${e.previousRound}회 출현분 ${e.excluded.map((x) => x.number).join("·")} 제외`
      : "";
    return {
      source,
      title: `${e.digit}끝회차 최강수`,
      detail: `${e.rounds.length}개 회차 집계${excludedText}`,
      reason: `회차 끝자리가 ${e.digit}인 회차만 모아 번대별로 가장 많이 나온 번호를 고릅니다.`,
      pool,
      gaps: gapsOf(pool),
      seedCount: Math.min(seedCount, pool.length),
      caution: e.distinguishable
        ? "이 묶음의 빈도 분포는 균등 난수와 다릅니다."
        : `빈도 분포가 균등 난수와 구분되지 않습니다(카이제곱 ${e.chiSquare.toFixed(1)}, 임계 ${e.chiCritical}). 회차 끝자리는 공 추첨과 무관합니다.`,
    };
  }

  const group =
    source === "column" ? ctx.columns : source === "digit" ? ctx.digits : ctx.palaces;
  if (!group) return null;
  const top = group.byOverdue[0];
  if (!top) return null;

  // 끝수는 쌍동끝 알림이 살아 있으면 그 예상수를 우선 쓴다.
  if (source === "digit" && ctx.pairAlert && ctx.pairAlert.pool.length > 0) {
    const a = ctx.pairAlert;
    return {
      source,
      title: `쌍동끝 예상수 (${a.round}회 발생)`,
      detail: `${a.entries.map((e) => `${e.label} ${e.hit.join("·")}`).join(" / ")}`,
      reason: `${a.round}회에 같은 끝수 2개짜리가 두 벌 나왔습니다. 그 끝수들의 남은 번호입니다.`,
      pool: a.pool,
      gaps: gapsOf(a.pool),
      seedCount: Math.min(seedCount, a.pool.length),
      caution: `3회차 안 적중률은 실측 88.6%지만, 아무 번호나 ${a.pool.length}개를 쥐어도 ${pctText(a.baselineProb).replace(".00", "")} 확률로 맞습니다. 무작위보다 높지 않습니다.`,
    };
  }

  return {
    source,
    title: `${top.label}`,
    detail: `${top.gap}회 미출 · 이론 평균 ${top.theoryCycle.toFixed(1)}회마다`,
    reason: `${group.threshold}개 이상 함께 나온 지 가장 오래된 묶음입니다.`,
    pool: top.members,
    gaps: gapsOf(top.members),
    seedCount: Math.min(seedCount, top.members.length),
    caution: `다음 회차에 ${top.label}에서 ${group.threshold}개 이상 나올 확률은 ${pctText(top.theoryProb)}입니다. 쉰 기간과 관계없이 항상 같습니다.`,
  };
}

export interface SeqGame {
  numbers: number[];
  /** 이 게임에서 묶음에서 가져온 번호 */
  seed: number[];
}

/**
 * 계획대로 게임을 만든다.
 * 게임마다 묶음에서 다른 조합을 뽑아 그 묶음을 넓게 덮는다.
 */
export function generateSeqGames(
  plan: SeqPlan,
  nGames: number,
  mode: GenerationMode,
  core: number | null,
  bands: PatternBands | null,
  targets: number[] = [],
  rng: Rng = defaultRng,
): SeqGame[] {
  const games: SeqGame[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (games.length < nGames && attempts < nGames * 200) {
    attempts += 1;
    const seed = rng.sample(plan.pool, plan.seedCount).sort((a, b) => a - b);
    // 추천번호까지 넣으면 6개를 넘을 수 있으니 합쳐서 잘라 준다.
    const locked = lockedNumbers(core, seed);
    const targetOdd = targets.length ? targets[games.length % targets.length] : null;
    const combo = generateCombo(mode, rng, core, 400, bands, seed, targetOdd);
    const key = combo.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    games.push({ numbers: combo, seed: locked.filter((n) => seed.includes(n)) });
  }
  return games;
}
