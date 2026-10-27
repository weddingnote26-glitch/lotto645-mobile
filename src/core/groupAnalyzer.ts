// 번호를 묶어서 보는 세 가지 수열 분석 — 세로줄 / 끝수 / 9궁도.
//
// 셋 다 "45개 번호를 겹치지 않게 몇 덩어리로 나눈 뒤, 한 회차에 같은 덩어리에서
// 몇 개나 나왔는지" 를 보는 같은 구조라 하나의 엔진으로 처리한다.
//
//   세로줄 : 로또 마킹지 7열 배치.  열 = ((번호-1) % 7) + 1
//            1세로 1·8·15·22·29·36·43 … 6세로 6·13·20·27·34·41
//   끝수   : 1의 자리.  0끝 10·20·30·40 / 1끝 1·11·21·31·41 …
//   9궁도  : 9씩 더해 묶음.  궁 = ((번호-1) % 9) + 1
//            1궁 1·10·19·28·37 / 4궁 4·13·22·31·40 …
//
// ── 수치를 어떻게 읽어야 하는가 ───────────────────────────────────────
// '미출주기'가 평균을 넘겼다고 해서 다음 회차 확률이 오르지 않는다. 각 추첨은
// 독립이라 100회를 쉬었든 직전에 나왔든 다음 회차 확률은 똑같다. 그래서 이
// 모듈은 반드시 '이론 확률'과 '이론 평균주기'를 함께 계산해 화면에 같이
// 보여 준다. 비교 기준 없이 미출주기만 보면 우연을 신호로 착각하게 된다.
// ─────────────────────────────────────────────────────────────────────

import type { LottoData } from "./types";

export type GroupKind = "column" | "digit" | "palace";

export interface GroupDef {
  kind: GroupKind;
  /** 세로줄 1~7 · 끝수 0~9 · 9궁 1~9 */
  key: number;
  label: string;
  members: number[];
}

const NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1);

/** 마킹지 7열 기준 세로줄 번호 (1~7) */
export function columnOf(n: number): number {
  return ((n - 1) % 7) + 1;
}

/** 1의 자리 끝수 (0~9) */
export function lastDigitOf(n: number): number {
  return n % 10;
}

/** 9궁도 번호 (1~9) */
export function palaceOf(n: number): number {
  return ((n - 1) % 9) + 1;
}

export function groupIndexOf(kind: GroupKind, n: number): number {
  if (kind === "column") return columnOf(n);
  if (kind === "digit") return lastDigitOf(n);
  return palaceOf(n);
}

export function groupsOf(kind: GroupKind): GroupDef[] {
  const keys =
    kind === "digit"
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      : kind === "column"
        ? [1, 2, 3, 4, 5, 6, 7]
        : [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return keys.map((key) => ({
    kind,
    key,
    label: kind === "column" ? `${key}세로` : kind === "digit" ? `${key}끝수` : `${key}궁`,
    members: NUMBERS.filter((n) => groupIndexOf(kind, n) === key),
  }));
}

/** 각 분석의 기본 기준 — 몇 개 이상 같이 나오면 '사건'으로 볼 것인가 */
export const DEFAULT_THRESHOLD: Record<GroupKind, number> = {
  column: 3, // 세로줄은 3출 이상
  digit: 2, // 같은 끝수 2개 = 동끝수
  palace: 2, // 같은 궁 2개 = 동궁
};

export const KIND_LABEL: Record<GroupKind, string> = {
  column: "세로줄",
  digit: "끝수",
  palace: "9궁도",
};

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let v = 1;
  for (let i = 0; i < k; i += 1) v = (v * (n - i)) / (i + 1);
  return Math.round(v);
}

const TOTAL_COMBOS = combinations(45, 6);

/** 크기 size인 그룹에서 threshold개 이상 뽑힐 이론 확률 */
export function groupHitProbability(size: number, threshold: number): number {
  let p = 0;
  for (let k = threshold; k <= Math.min(6, size); k += 1) {
    p += (combinations(size, k) * combinations(45 - size, 6 - k)) / TOTAL_COMBOS;
  }
  return p;
}

export interface GroupStat extends GroupDef {
  /** threshold개 이상 동시 출현한 횟수 */
  hitCount: number;
  /** 마지막으로 그랬던 회차 */
  lastHit: number | null;
  /** 그 이후 지난 회차 수 (현재 미출주기) */
  gap: number;
  /** 실제 발생 간격 평균 */
  avgCycle: number | null;
  /** 다음 회차에 threshold개 이상 나올 이론 확률 */
  theoryProb: number;
  /** 이론상 평균 몇 회마다 */
  theoryCycle: number;
  /** 미출주기 ÷ 이론주기 (1보다 크면 평균을 넘긴 상태) */
  overdueRatio: number;
  /** 그룹 번호들의 총 출현 개수 */
  totalHits: number;
}

export interface GroupAnalysis {
  kind: GroupKind;
  threshold: number;
  /** 실제 분석에 쓰인 회차들 */
  rounds: number[];
  fromRound: number;
  latest: number;
  groups: GroupStat[];
  /** 미출주기가 긴 순서 */
  byOverdue: GroupStat[];
}

/**
 * 그룹별 동시출현 통계를 낸다. 무작위 요소 없음.
 * fromRound 이상인 회차만 집계한다 (추첨기 교체 시점 등으로 범위를 자를 때 사용).
 */
export function analyzeGroups(
  data: LottoData,
  kind: GroupKind,
  threshold: number = DEFAULT_THRESHOLD[kind],
  fromRound = 1,
): GroupAnalysis {
  const rounds = data.rounds.filter((r) => r >= fromRound);
  const latest = rounds.length ? rounds[rounds.length - 1] : 0;

  const groups: GroupStat[] = groupsOf(kind).map((def) => {
    const member = new Set(def.members);
    const hits: number[] = [];
    let totalHits = 0;

    for (const r of rounds) {
      const draw = data.draws.get(r) ?? [];
      let c = 0;
      for (const n of draw) if (member.has(n)) c += 1;
      totalHits += c;
      if (c >= threshold) hits.push(r);
    }

    const lastHit = hits.length ? hits[hits.length - 1] : null;
    const theoryProb = groupHitProbability(def.members.length, threshold);
    const gap = lastHit === null ? rounds.length : rounds.filter((r) => r > lastHit).length;

    return {
      ...def,
      hitCount: hits.length,
      lastHit,
      gap,
      avgCycle: hits.length > 1 ? (hits[hits.length - 1] - hits[0]) / (hits.length - 1) : null,
      theoryProb,
      theoryCycle: theoryProb > 0 ? 1 / theoryProb : Infinity,
      overdueRatio: theoryProb > 0 ? gap * theoryProb : 0,
      totalHits,
    };
  });

  return {
    kind,
    threshold,
    rounds,
    fromRound,
    latest,
    groups,
    byOverdue: [...groups].sort((a, b) => b.gap - a.gap || a.key - b.key),
  };
}

// ---------- 쌍동끝 (같은 끝수 2개짜리가 두 벌 이상 나온 회차) ----------

export interface PairGroupHit {
  key: number;
  label: string;
  /** 그 회차에 나온 같은 끝수 번호들 */
  hit: number[];
  /** 아직 안 나온 같은 끝수 번호들 = 예상수 */
  remaining: number[];
}

export interface PairAlert {
  kind: GroupKind;
  /** 쌍동끝이 발생한 회차 */
  round: number;
  /** 그 회차 당첨번호 */
  draw: number[];
  entries: PairGroupHit[];
  /** 예상수 전체 */
  pool: number[];
  /** 관찰 기간 (기본 3회차) */
  window: number;
  /** 아직 남은 회차 수 */
  roundsLeft: number;
  /** 예상수 중 하나라도 남은 기간에 나올 '무작위 기대 확률' */
  baselineProb: number;
  /** 알림 발생 이후 실제로 예상수가 나왔는지 (이미 지난 회차 기준) */
  alreadyHit: number[];
}

/**
 * 최근 window회 안에 '같은 그룹 2개짜리'가 두 벌 이상 나온 회차를 찾는다.
 * 끝수에 적용하면 이진형 님이 말한 '쌍동끝'이 된다.
 *
 * 주의: 반환되는 baselineProb은 "아무 번호나 같은 개수만큼 쥐고 있어도
 * 그 정도는 나온다"는 비교 기준이다. 이 값보다 실제 적중률이 높아야만
 * 의미가 있고, 실제 1236회 데이터에서는 그렇지 않았다 (88.6% vs 기대 89.9%).
 */
export function detectPairAlert(
  data: LottoData,
  kind: GroupKind = "digit",
  window = 3,
  fromRound = 1,
): PairAlert | null {
  const rounds = data.rounds.filter((r) => r >= fromRound);
  if (rounds.length === 0) return null;

  // 최신 회차부터 window개만 거슬러 보며 가장 최근 발생을 찾는다.
  for (let back = 0; back < window && back < rounds.length; back += 1) {
    const round = rounds[rounds.length - 1 - back];
    const draw = data.draws.get(round) ?? [];

    const byGroup = new Map<number, number[]>();
    for (const n of draw) {
      const g = groupIndexOf(kind, n);
      byGroup.set(g, [...(byGroup.get(g) ?? []), n]);
    }

    const doubled = [...byGroup.entries()].filter(([, v]) => v.length >= 2);
    if (doubled.length < 2) continue; // '쌍'이 두 벌은 되어야 한다

    const defs = groupsOf(kind);
    const entries: PairGroupHit[] = doubled
      .map(([key, hit]) => {
        const def = defs.find((d) => d.key === key) as GroupDef;
        return {
          key,
          label: def.label,
          hit: [...hit].sort((a, b) => a - b),
          remaining: def.members.filter((n) => !hit.includes(n)),
        };
      })
      .sort((a, b) => a.key - b.key);

    const pool = entries.flatMap((e) => e.remaining).sort((a, b) => a - b);
    if (pool.length === 0) continue;

    // 알림 이후 이미 지나간 회차에서 예상수가 나왔는지
    const after = rounds.filter((r) => r > round).slice(0, window);
    const hitSet = new Set<number>();
    for (const r of after) {
      for (const n of data.draws.get(r) ?? []) if (pool.includes(n)) hitSet.add(n);
    }

    const stay = Math.max(0, window - after.length);
    const pMiss = combinations(45 - pool.length, 6) / TOTAL_COMBOS;

    return {
      kind,
      round,
      draw: [...draw].sort((a, b) => a - b),
      entries,
      pool,
      window,
      roundsLeft: stay,
      baselineProb: 1 - Math.pow(pMiss, window),
      alreadyHit: [...hitSet].sort((a, b) => a - b),
    };
  }

  return null;
}
