// 핵심 추천번호 선정 알고리즘 — PC 버전 core/number_selector.py의 1:1 이식.
//
// 가장 중요한 원칙:
// - 아래 우선순위 '순차 필터'를 그대로 적용하며, 실행마다 규칙을 바꾸지 않는다.
// - 임의 가중치 점수로 대체하지 않는다.
// - 각 단계에서 후보가 어떻게 좁혀졌는지 전 과정을 로그로 남긴다.
// - 후보가 1개가 되는 순간 확정한다. 마지막까지 동률이면 그때만
//   고정 시드 없는 무작위 선택을 사용하고 그 사실을 표시한다 (9순위).
//
// 각 필터는 '후보를 좁히지 못하면(변별력이 없으면) 후보를 그대로 통과'시킨다.

import { ZONE10_LABELS, ZONE15_LABELS } from "./analyzer";
import type { Analysis, Rng } from "./types";
import { defaultRng } from "./rng";

export interface SelectionStep {
  order: number;
  title: string;
  detail: string;
  before: number[];
  after: number[];
}

export interface SelectionResult {
  number: number;
  usedRandom: boolean;
  steps: SelectionStep[];
}

/** Python `f"{x:.2f}"` 대응 */
function f2(x: number): string {
  return x.toFixed(2);
}

/** Python `f"{x:.1%}"` 대응 */
function pct1(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function fmt(nums: number[]): string {
  return [...nums].sort((a, b) => a - b).join(", ");
}

export function selectionLogText(result: SelectionResult): string {
  const lines: string[] = [];
  for (const s of result.steps) {
    lines.push(`[${s.order}단계] ${s.title}`);
    lines.push(`  ${s.detail}`);
    lines.push(`  후보 ${s.before.length}개 → ${s.after.length}개: ${s.after.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

type FilterFn = (candidates: number[], analysis: Analysis) => [number[], string];

// ---------- 개별 필터 (단계별 함수 분리 → 개별 테스트 가능) ----------

/** [1순위] 최근 5회 출현 횟수 최다. */
export const filterByRecent5: FilterFn = (candidates, analysis) => {
  const st = analysis.stats;
  const best = Math.max(...candidates.map((c) => st[c].cnt5));
  const kept = candidates.filter((c) => st[c].cnt5 === best);
  return [kept, `최근 5회 최다 출현 = ${best}회`];
};

/** [2순위] 최근 10회 출현 횟수 최다. */
export const filterByRecent10: FilterFn = (candidates, analysis) => {
  const st = analysis.stats;
  const best = Math.max(...candidates.map((c) => st[c].cnt10));
  const kept = candidates.filter((c) => st[c].cnt10 === best);
  return [kept, `최근 10회 최다 출현 = ${best}회`];
};

/**
 * [3·4순위] 10단위 구간 — 크기 보정 출현률이 가장 낮았던 구간의 후보 우선.
 * 단순 출현 개수가 아니라 반드시 구간 크기를 보정한다 (41~45는 5개뿐).
 */
export const filterByRange10: FilterFn = (candidates, analysis) => {
  const st = analysis.stats;
  const rates = analysis.win10.zone10Rates;
  const zones = [...new Set(candidates.map((c) => st[c].zone10))].sort((a, b) => a - b);
  const minRate = Math.min(...zones.map((z) => rates[z]));
  const kept = candidates.filter((c) => Math.abs(rates[st[c].zone10] - minRate) < 1e-9);
  const detail =
    "최근 10회 보정 출현률 " + zones.map((z) => `${ZONE10_LABELS[z]}=${f2(rates[z])}`).join(", ");
  return [kept, `${detail} → 최저 구간 우선`];
};

/** [5순위] 15단위 구간(1~15/16~30/31~45) — 최근 10회 출현 비율 최저 구간 우선. */
export const filterByRange15: FilterFn = (candidates, analysis) => {
  const st = analysis.stats;
  const ratios = analysis.win10.zone15Ratios;
  const zones = [...new Set(candidates.map((c) => st[c].zone15))].sort((a, b) => a - b);
  const minRatio = Math.min(...zones.map((z) => ratios[z]));
  const kept = candidates.filter((c) => Math.abs(ratios[st[c].zone15] - minRatio) < 1e-9);
  const detail =
    "최근 10회 출현 비율 " + zones.map((z) => `${ZONE15_LABELS[z]}=${pct1(ratios[z])}`).join(", ");
  return [kept, `${detail} → 최저 구간 우선`];
};

/** [6순위] 최근 10회에서 적게 나온 홀/짝 쪽 후보 우선. 동수면 통과. */
export const filterByOddEven: FilterFn = (candidates, analysis) => {
  const w = analysis.win10;
  if (w.odd === w.even) {
    return [candidates, `최근 10회 홀 ${w.odd} : 짝 ${w.even} — 동수, 변별 불가 → 통과`];
  }
  const preferOdd = w.odd < w.even;
  const kept = candidates.filter((c) => analysis.stats[c].odd === preferOdd);
  const label = preferOdd ? "홀수" : "짝수";
  if (kept.length === 0) {
    return [candidates, `최근 10회 부족 영역(${label}) 후보 없음 → 통과`];
  }
  return [kept, `최근 10회 홀 ${w.odd} : 짝 ${w.even} → 부족한 ${label} 우선`];
};

/** [7순위] 직전 회차 미출현 + 최근 5회 안 1회 이상 출현한 후보 우선. */
export const filterByPreviousRound: FilterFn = (candidates, analysis) => {
  const st = analysis.stats;
  const kept = candidates.filter((c) => !st[c].inPrev && st[c].cnt5 >= 1);
  if (kept.length === 0) {
    return [candidates, "조건(직전 회차 미출현 + 최근 5회 출현) 해당 후보 없음 → 통과"];
  }
  return [kept, "직전 회차 미출현 + 최근 5회 출현 후보 우선"];
};

/** [8순위] 미출현 간격 1~3회 후보 우선. */
export const filterByGap: FilterFn = (candidates, analysis) => {
  const st = analysis.stats;
  const kept = candidates.filter((c) => st[c].gap >= 1 && st[c].gap <= 3);
  if (kept.length === 0) {
    return [candidates, "미출현 간격 1~3회 해당 후보 없음 → 통과"];
  }
  return [kept, "미출현 간격 1~3회 후보 우선"];
};

export const PIPELINE: Array<[string, FilterFn]> = [
  ["최근 5회 출현빈도", filterByRecent5],
  ["최근 10회 출현빈도", filterByRecent10],
  ["10단위 구간 보정 출현률", filterByRange10],
  ["15단위 구간 출현 비율", filterByRange15],
  ["홀짝 부족 영역", filterByOddEven],
  ["직전 회차 미출현 + 최근 5회 출현", filterByPreviousRound],
  ["미출현 간격 1~3회", filterByGap],
];

/**
 * 1~9순위 순차 필터로 핵심 추천번호 1개를 선정한다.
 *
 * pool을 넘기지 않으면 기존과 똑같이 1~45 전체에서 고른다.
 * pool은 순위 목록을 만들 때(이미 뽑힌 번호를 빼고 다시 고를 때)만 쓴다.
 * 규칙 자체는 어느 경우에도 동일하다.
 */
export function selectCoreNumber(
  analysis: Analysis,
  rng: Rng = defaultRng,
  pool?: number[],
): SelectionResult {
  let candidates: number[] = pool
    ? [...pool].sort((a, b) => a - b)
    : Array.from({ length: 45 }, (_, i) => i + 1);
  const steps: SelectionStep[] = [];
  let usedRandom = false;

  if (candidates.length === 0) {
    throw new Error("후보가 비어 있어 추천번호를 고를 수 없습니다.");
  }

  for (let i = 0; i < PIPELINE.length; i += 1) {
    const order = i + 1;
    const [title, fn] = PIPELINE[i];
    const before = [...candidates];
    const [kept, detail] = fn(candidates, analysis);
    steps.push({ order, title, detail, before, after: [...kept] });
    candidates = kept;
    if (candidates.length === 1) {
      steps.push({
        order,
        title: "확정",
        detail: "후보가 1개로 좁혀져 확정",
        before: [...candidates],
        after: [...candidates],
      });
      break;
    }
  }

  if (candidates.length > 1) {
    const sortedCandidates = [...candidates].sort((a, b) => a - b);
    const pick = rng.choice(sortedCandidates);
    usedRandom = true;
    steps.push({
      order: steps.length + 1,
      title: "동일 점수 후보 중 무작위 선택",
      detail: `완전 동률 후보 [${fmt(candidates)}] 중 고정 시드 없는 무작위 선택`,
      before: sortedCandidates,
      after: [pick],
    });
    candidates = [pick];
  }

  return { number: candidates[0], usedRandom, steps };
}

export interface RankedNumber {
  number: number;
  /** 1이 핵심 추천번호 */
  rank: number;
  usedRandom: boolean;
  steps: SelectionStep[];
}

/**
 * 추천번호를 1순위부터 count개까지 줄세운다.
 *
 * 별도의 점수 체계를 새로 만들지 않는다. 위 순차 필터를 그대로 쓰되,
 * 이미 뽑힌 번호를 후보에서 빼고 같은 규칙을 다시 돌려 다음 순위를 정한다.
 * 따라서 1순위는 selectCoreNumber(analysis)와 항상 같은 번호가 된다.
 */
export function rankRecommendedNumbers(
  analysis: Analysis,
  count = 6,
  rng: Rng = defaultRng,
): RankedNumber[] {
  let pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const limit = Math.min(count, pool.length);
  const ranked: RankedNumber[] = [];

  for (let rank = 1; rank <= limit; rank += 1) {
    const sel = selectCoreNumber(analysis, rng, pool);
    ranked.push({
      number: sel.number,
      rank,
      usedRandom: sel.usedRandom,
      steps: sel.steps,
    });
    pool = pool.filter((v) => v !== sel.number);
  }
  return ranked;
}

/** 선정 이유 표시용 요약. */
export function selectionReason(analysis: Analysis, num: number): Array<[string, string]> {
  const s = analysis.stats[num];
  return [
    ["최근 5회 출현", `${s.cnt5}회`],
    ["최근 10회 출현", `${s.cnt10}회`],
    ["직전 회차", s.inPrev ? "출현" : "미출현"],
    ["미출현 간격", `${s.gap}회`],
    ["구간", ZONE10_LABELS[s.zone10]],
    ["홀짝", s.odd ? "홀수" : "짝수"],
  ];
}
