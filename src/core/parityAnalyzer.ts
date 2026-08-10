// 홀짝 구성 분석.
//
// ── 먼저 분명히 해 둘 것 ──────────────────────────────────────────────
// 어떤 홀짝 구성을 고르든 당첨 확률은 똑같다. 6/45의 모든 조합은 1/8,145,060로
// 동일하다. 여기서 하는 일은 확률을 올리는 것이 아니라, 생성되는 조합의 '모양'을
// 실제 당첨 조합의 모양과 비슷하게 맞추는 것뿐이다.
// ─────────────────────────────────────────────────────────────────────
//
// 기준을 어디서 가져오는가:
//
//   ① 전체 회차 분포 (기본, 75%)
//      1236회분의 실제 홀짝 분포. 표본이 커서 흔들리지 않는다.
//      참고로 이 값은 이론값(초기하분포)과 오차 1.4%p 안에서 일치한다.
//        홀0 0.92% / 홀1 7.44% / 홀2 22.72% / 홀3 33.48%
//        홀4 25.11% / 홀5 9.09% / 홀6 1.24%
//
//   ② 최근 흐름 (보정, 25%)
//      recentScore(k) = 최근 5회 출현 × 2 + 최근 10회 출현
//      최근 5회에 두 배 비중을 준다.
//
//   최종 가중치 = 0.75 × 전체 비율 + 0.25 × 최근 흐름 비율
//
// 최근 10회만 쓰면 표본이 10개뿐이라 우연히 한 번 나온 희귀 패턴이 크게
// 부풀려진다. 실제로 홀6:짝0(6개 전부 홀수)은 전체의 1.2%인데, 최근 10회에
// 한 번 나왔다는 이유만으로 생성 게임의 15%를 차지하는 문제가 있었다.
// 전체 분포를 기본으로 두고 최근 흐름을 보정으로만 쓰면 이 왜곡이 사라진다.

import type { Analysis } from "./types";

/** 최근 흐름을 얼마나 반영할지 (나머지는 전체 회차 분포) */
export const RECENT_WEIGHT = 0.25;

export interface ParityPattern {
  /** 홀수 개수 (0~6). 짝수 개수는 6 - odd */
  odd: number;
  count5: number;
  count10: number;
  /** 전체 회차에서 이 구성이 나온 횟수 */
  countAll: number;
  /** 최근 흐름 점수 = count5 × 2 + count10 */
  recentScore: number;
  /** 전체 회차에서의 비율 (0~1) */
  historicalShare: number;
  /** 최근 흐름 점수의 비율 (0~1) */
  recentShare: number;
  /** 실제 생성에 쓰는 최종 가중치 (0~1) */
  weight: number;
}

export interface ParityProfile {
  /** 인덱스 = 홀수 개수 (0~6) */
  byOdd: ParityPattern[];
  /** 최종 가중치 내림차순 (동점이면 홀수 개수가 작은 쪽 먼저) */
  ranked: ParityPattern[];
  /** 가장 비중이 큰 구성. 데이터가 없으면 null */
  top: ParityPattern | null;
  /** 최근 흐름만 봤을 때 가장 잦았던 구성 (화면 안내용) */
  recentTop: ParityPattern | null;
  totalRounds: number;
}

function oddCountOf(numbers: number[]): number {
  return numbers.filter((n) => n % 2 === 1).length;
}

/** 전체 회차 분포 + 최근 흐름을 함께 집계한다. 무작위 요소 없음. */
export function analyzeParity(analysis: Analysis): ParityProfile {
  const count5 = new Array<number>(7).fill(0);
  const count10 = new Array<number>(7).fill(0);
  const countAll = new Array<number>(7).fill(0);

  for (const r of analysis.win5.rounds) {
    const draw = analysis.data.draws.get(r);
    if (draw) count5[oddCountOf(draw)] += 1;
  }
  for (const r of analysis.win10.rounds) {
    const draw = analysis.data.draws.get(r);
    if (draw) count10[oddCountOf(draw)] += 1;
  }
  for (const r of analysis.data.rounds) {
    const draw = analysis.data.draws.get(r);
    if (draw) countAll[oddCountOf(draw)] += 1;
  }

  const totalRounds = analysis.data.rounds.length;
  const recentScores = countAll.map((_, k) => count5[k] * 2 + count10[k]);
  const recentTotal = recentScores.reduce((a, b) => a + b, 0);

  const byOdd: ParityPattern[] = Array.from({ length: 7 }, (_, odd) => {
    const historicalShare = totalRounds ? countAll[odd] / totalRounds : 0;
    const recentShare = recentTotal ? recentScores[odd] / recentTotal : 0;
    return {
      odd,
      count5: count5[odd],
      count10: count10[odd],
      countAll: countAll[odd],
      recentScore: recentScores[odd],
      historicalShare,
      recentShare,
      weight: (1 - RECENT_WEIGHT) * historicalShare + RECENT_WEIGHT * recentShare,
    };
  });

  const ranked = byOdd
    .filter((p) => p.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.odd - b.odd);

  const recentRanked = byOdd
    .filter((p) => p.recentScore > 0)
    .sort((a, b) => b.recentScore - a.recentScore || a.odd - b.odd);

  return {
    byOdd,
    ranked,
    top: ranked.length ? ranked[0] : null,
    recentTop: recentRanked.length ? recentRanked[0] : null,
    totalRounds,
  };
}

/**
 * 게임 수만큼 '목표 홀수 개수'를 배분한다.
 *
 * 최종 가중치 비율대로 나눠 담으므로, 여러 게임을 뽑으면 실제 당첨 조합의
 * 홀짝 분포와 비슷한 구성이 된다. 나머지 배분은 최대잉여법이라 같은 입력이면
 * 항상 같은 결과가 나온다.
 */
export function parityTargets(profile: ParityProfile, nGames: number): number[] {
  const total = profile.ranked.reduce((a, p) => a + p.weight, 0);
  if (nGames <= 0 || profile.ranked.length === 0 || total === 0) return [];

  const exact = profile.ranked.map((p) => (nGames * p.weight) / total);
  const base = exact.map((v) => Math.floor(v));
  let left = nGames - base.reduce((a, b) => a + b, 0);

  // 남은 자리는 소수부가 큰 순서대로 (동률이면 가중치 높은 쪽 → 홀수 개수 작은 쪽)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort(
      (a, b) =>
        b.frac - a.frac ||
        profile.ranked[b.i].weight - profile.ranked[a.i].weight ||
        profile.ranked[a.i].odd - profile.ranked[b.i].odd,
    );
  for (const o of order) {
    if (left <= 0) break;
    base[o.i] += 1;
    left -= 1;
  }

  const targets: number[] = [];
  profile.ranked.forEach((p, i) => {
    for (let c = 0; c < base[i]; c += 1) targets.push(p.odd);
  });
  return targets.slice(0, nGames);
}

/** 화면 표시용 문구 (예: "홀 3 : 짝 3") */
export function parityLabel(odd: number): string {
  return `홀 ${odd} : 짝 ${6 - odd}`;
}
