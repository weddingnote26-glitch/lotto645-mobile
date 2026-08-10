// 최근 회차의 홀짝 구성 패턴 분석.
//
// "항상 3:3" 같은 고정값을 쓰지 않는다. 최근 5회·10회에서 실제로 어떤 홀짝
// 구성이 나왔는지 세어, 그 분포에 맞춰 번호를 만든다. 데이터가 바뀌면 기준도
// 자동으로 다시 계산된다.
//
//   recentParityScore(k) = (최근 5회에서 홀 k개가 나온 횟수 × 2)
//                        + (최근 10회에서 홀 k개가 나온 횟수)
//
// 최근 5회 흐름에 두 배 비중을 준다.
//
// 주의: 이것은 "최근에 자주 나왔으니 다음에 나올 확률이 높다"는 뜻이 아니다.
// 로또는 매회 독립적인 무작위 추첨이다. 생성되는 조합의 '형태'를 최근 회차와
// 비슷하게 맞추기 위한 규칙일 뿐이다.

import type { Analysis } from "./types";

export interface ParityPattern {
  /** 홀수 개수 (0~6). 짝수 개수는 6 - odd */
  odd: number;
  count5: number;
  count10: number;
  score: number;
}

export interface ParityProfile {
  /** 인덱스 = 홀수 개수 (0~6) */
  byOdd: ParityPattern[];
  /** 점수 내림차순 (동점이면 홀수 개수가 작은 쪽 먼저) */
  ranked: ParityPattern[];
  /** 가장 우세한 패턴. 데이터가 없으면 null */
  top: ParityPattern | null;
  totalScore: number;
}

function oddCountOf(numbers: number[]): number {
  return numbers.filter((n) => n % 2 === 1).length;
}

/** 최근 5회·10회의 홀짝 구성을 집계한다. 무작위 요소 없음. */
export function analyzeParity(analysis: Analysis): ParityProfile {
  const count5 = new Array<number>(7).fill(0);
  const count10 = new Array<number>(7).fill(0);

  for (const r of analysis.win5.rounds) {
    const draw = analysis.data.draws.get(r);
    if (draw) count5[oddCountOf(draw)] += 1;
  }
  for (const r of analysis.win10.rounds) {
    const draw = analysis.data.draws.get(r);
    if (draw) count10[oddCountOf(draw)] += 1;
  }

  const byOdd: ParityPattern[] = Array.from({ length: 7 }, (_, odd) => ({
    odd,
    count5: count5[odd],
    count10: count10[odd],
    score: count5[odd] * 2 + count10[odd],
  }));

  const ranked = byOdd
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.odd - b.odd);

  return {
    byOdd,
    ranked,
    top: ranked.length ? ranked[0] : null,
    totalScore: ranked.reduce((sum, p) => sum + p.score, 0),
  };
}

/**
 * 게임 수만큼 '목표 홀수 개수'를 배분한다.
 *
 * 모든 게임을 똑같은 비율로 만들지 않고, 위 점수 비율대로 나눠 담는다.
 * 예) 3:3이 가장 높고 4:2·2:4가 뒤따르면 5게임은 3:3 위주에 4:2·2:4가 섞인다.
 * 나머지 배분은 최대잉여법이라 같은 입력이면 항상 같은 결과가 나온다.
 */
export function parityTargets(profile: ParityProfile, nGames: number): number[] {
  if (nGames <= 0 || profile.ranked.length === 0 || profile.totalScore === 0) return [];

  const exact = profile.ranked.map((p) => (nGames * p.score) / profile.totalScore);
  const base = exact.map((v) => Math.floor(v));
  let left = nGames - base.reduce((a, b) => a + b, 0);

  // 남은 자리는 소수부가 큰 순서대로 (동률이면 점수 높은 쪽 → 홀수 개수 작은 쪽)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort(
      (a, b) =>
        b.frac - a.frac ||
        profile.ranked[b.i].score - profile.ranked[a.i].score ||
        profile.ranked[a.i].odd - profile.ranked[b.i].odd,
    );
  for (const o of order) {
    if (left <= 0) break;
    base[o.i] += 1;
    left -= 1;
  }

  // 1게임이면 가장 우세한 패턴 하나만 나오도록 순위 순서대로 펼친다.
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
