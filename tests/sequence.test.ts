// 수열 분석(세로줄 / 끝수 / 9궁도)과 끝회차 분석 테스트.
//
// 카카오톡으로 공유받은 분석 기법의 숫자를 그대로 재현하는지 고정해 둔다.
// 여기 값이 깨지면 그룹 정의나 집계 방식이 바뀐 것이다.

import { describe, expect, it } from "vitest";

import { buildLottoData } from "../src/core/excelLoader";
import {
  analyzeGroups,
  columnOf,
  detectPairAlert,
  groupHitProbability,
  groupsOf,
  lastDigitOf,
  palaceOf,
} from "../src/core/groupAnalyzer";
import { analyzeEndRound, bandIndexOf, nextEndDigit } from "../src/core/endRoundAnalyzer";
import { decodeSeedRows } from "../src/data/seedDraws";

const data = buildLottoData(decodeSeedRows(), "seed");
const LATEST = data.rounds[data.rounds.length - 1]; // 1236

describe("그룹 정의", () => {
  it("세로줄은 마킹지 7열 배치를 따른다", () => {
    const cols = groupsOf("column");
    expect(cols.length).toBe(7);
    expect(cols[0].members).toEqual([1, 8, 15, 22, 29, 36, 43]);
    expect(cols[5].members).toEqual([6, 13, 20, 27, 34, 41]); // 6세로
    expect(cols[6].members).toEqual([7, 14, 21, 28, 35, 42]);
    // 1~3세로는 7개, 4~7세로는 6개
    expect(cols.map((c) => c.members.length)).toEqual([7, 7, 7, 6, 6, 6, 6]);
    expect(cols.reduce((a, c) => a + c.members.length, 0)).toBe(45);
  });

  it("끝수는 1의 자리로 묶는다", () => {
    const digits = groupsOf("digit");
    expect(digits.length).toBe(10);
    expect(digits.find((d) => d.key === 1)?.members).toEqual([1, 11, 21, 31, 41]);
    expect(digits.find((d) => d.key === 2)?.members).toEqual([2, 12, 22, 32, 42]);
    expect(digits.find((d) => d.key === 4)?.members).toEqual([4, 14, 24, 34, 44]);
    expect(digits.find((d) => d.key === 0)?.members).toEqual([10, 20, 30, 40]);
    expect(digits.reduce((a, d) => a + d.members.length, 0)).toBe(45);
  });

  it("9궁도는 9씩 더해 묶는다", () => {
    const palaces = groupsOf("palace");
    expect(palaces.length).toBe(9);
    expect(palaces[0].members).toEqual([1, 10, 19, 28, 37]); // 1궁
    expect(palaces[1].members).toEqual([2, 11, 20, 29, 38]); // 2궁
    expect(palaces[2].members).toEqual([3, 12, 21, 30, 39]); // 3궁
    expect(palaces[3].members).toEqual([4, 13, 22, 31, 40]); // 4궁
    expect(palaces[8].members).toEqual([9, 18, 27, 36, 45]); // 9궁
    expect(palaces.every((p) => p.members.length === 5)).toBe(true);
  });

  it("개별 번호의 소속이 맞는다", () => {
    expect(columnOf(6)).toBe(6);
    expect(columnOf(41)).toBe(6);
    expect(lastDigitOf(42)).toBe(2);
    expect(lastDigitOf(40)).toBe(0);
    expect(palaceOf(22)).toBe(4);
    expect(palaceOf(37)).toBe(1);
  });

  it("번대 경계는 1~10 / 11~20 / 21~30 / 31~40 / 41~45", () => {
    expect(bandIndexOf(10)).toBe(0);
    expect(bandIndexOf(11)).toBe(1);
    expect(bandIndexOf(20)).toBe(1);
    expect(bandIndexOf(41)).toBe(4);
    expect(bandIndexOf(45)).toBe(4);
  });
});

describe("세로줄 3출 이상 (262회~)", () => {
  const a = analyzeGroups(data, "column", 3, 262);

  it("공유받은 수치를 그대로 재현한다 — 6세로 마지막 3출 1133회", () => {
    const c6 = a.groups.find((g) => g.key === 6)!;
    expect(c6.lastHit).toBe(1133);
    expect(c6.gap).toBe(LATEST - 1133); // 1236 기준 103회
  });

  it("미출이 가장 긴 줄은 6세로다", () => {
    expect(a.byOverdue[0].key).toBe(6);
  });

  it("6개짜리 줄의 3출 이론 확률은 약 2.383%", () => {
    expect(groupHitProbability(6, 3)).toBeCloseTo(0.02383, 4);
    expect(groupHitProbability(7, 3)).toBeCloseTo(0.03937, 4);
  });

  it("이론주기와 미출주기를 함께 돌려준다", () => {
    const c6 = a.groups.find((g) => g.key === 6)!;
    expect(c6.theoryCycle).toBeCloseTo(42.0, 0);
    // 103회 미출은 이론주기의 약 2.45배
    expect(c6.overdueRatio).toBeCloseTo(c6.gap * c6.theoryProb, 10);
  });

  it("같은 데이터면 항상 같은 결과", () => {
    expect(analyzeGroups(data, "column", 3, 262)).toEqual(a);
  });
});

describe("끝회차 분석 (262회~)", () => {
  const a = analyzeEndRound(data, 7, 262);

  it("7끝회차 묶음은 267회부터 10회차 간격이다", () => {
    expect(a.rounds[0]).toBe(267);
    expect(a.rounds.every((r) => r % 10 === 7)).toBe(true);
    expect(a.rounds[a.rounds.length - 1]).toBe(1227); // 1237은 데이터 밖
  });

  it("공유받은 빈도를 그대로 재현한다", () => {
    expect(a.freq[12]).toBe(21);
    expect(a.freq[22]).toBe(20);
    expect(a.freq[43]).toBe(15);
    expect(a.freq[44]).toBe(15);
  });

  it("마지막 출현 회차도 일치한다", () => {
    const of = (n: number) => a.strongest.find((s) => s.number === n)!;
    expect(of(12).lastRound).toBe(1157);
    expect(of(22).lastRound).toBe(1207);
    expect(of(43).lastRound).toBe(1197);
    expect(of(44).lastRound).toBe(1227);
  });

  it("번대별 최강수를 동률까지 포함해 뽑는다", () => {
    // 1~10번대는 8번과 10번이 17회로 동률이라 둘 다 들어간다.
    // (1237회가 데이터에 있으면 10번이 18회가 되어 단독 1위가 된다)
    expect(a.strongest.map((s) => s.number)).toEqual([8, 10, 12, 22, 40, 43, 44]);
  });

  it("번대마다 최소 1개씩은 뽑힌다", () => {
    const bands = new Set(a.strongest.map((s) => s.bandIndex));
    expect(bands.size).toBe(5);
  });

  it("빈도 분포는 균등 난수와 구분되지 않는다", () => {
    expect(a.chiSquare).toBeLessThan(a.chiCritical);
    expect(a.distinguishable).toBe(false);
  });

  it("직전 회차에 나온 최강수는 후보에서 빠진다", () => {
    const prev = new Set(a.previousDraw);
    expect(a.candidates.every((c) => !prev.has(c.number))).toBe(true);
    expect(a.excluded.every((c) => prev.has(c.number))).toBe(true);
    expect(a.candidates.length + a.excluded.length).toBe(a.strongest.length);
  });

  it("다음 회차의 끝자리를 계산한다", () => {
    expect(nextEndDigit(1236)).toBe(7);
    expect(nextEndDigit(1239)).toBe(0);
  });
});

describe("쌍동끝 감지", () => {
  it("같은 끝수 2개짜리가 두 벌 이상이면 잡아낸다", () => {
    // 8·14·21·22·42·45 → 2끝수(22·42) + 4끝수(14·24는 보너스라 제외되므로 본번호만으론 1벌)
    // 본번호만으로 쌍동끝이 되는 회차를 직접 만들어 확인한다.
    const made = buildLottoData(
      [
        [1, 1, 2, 3, 4, 5, 6, 7],
        [2, 2, 12, 4, 14, 30, 31, 9], // 2끝수 2·12 + 4끝수 4·14 = 쌍동끝
      ],
      "made",
    );
    const alert = detectPairAlert(made, "digit", 3, 1);
    expect(alert).not.toBeNull();
    expect(alert!.round).toBe(2);
    expect(alert!.entries.map((e) => e.key).sort()).toEqual([2, 4]);
    // 예상수 = 나머지 같은 끝수들
    expect(alert!.pool).toEqual([22, 24, 32, 34, 42, 44]);
  });

  it("예상수 6개의 무작위 기대 적중률은 약 93.6% (3회차)", () => {
    const made = buildLottoData(
      [
        [1, 1, 2, 3, 4, 5, 6, 7],
        [2, 2, 12, 4, 14, 30, 31, 9],
      ],
      "made",
    );
    const alert = detectPairAlert(made, "digit", 3, 1)!;
    expect(alert.pool.length).toBe(6);
    expect(alert.baselineProb).toBeCloseTo(0.936, 2);
  });

  it("쌍이 한 벌뿐이면 알림이 아니다", () => {
    const made = buildLottoData(
      [
        [1, 1, 2, 3, 4, 5, 6, 7],
        [2, 2, 12, 5, 17, 30, 31, 9], // 2끝수만 2개
      ],
      "made",
    );
    expect(detectPairAlert(made, "digit", 3, 1)).toBeNull();
  });
});

describe("분석 시작 회차", () => {
  it("범위를 자르면 집계 대상 회차가 줄어든다", () => {
    const full = analyzeGroups(data, "column", 3, 1);
    const cut = analyzeGroups(data, "column", 3, 262);
    expect(full.rounds.length).toBe(1236);
    expect(cut.rounds.length).toBe(975);
    expect(full.rounds.length).toBeGreaterThan(cut.rounds.length);
  });

  it("범위를 바꿔도 그룹 정의와 이론 확률은 그대로다", () => {
    const full = analyzeGroups(data, "column", 3, 1);
    const cut = analyzeGroups(data, "column", 3, 262);
    expect(full.groups.map((g) => g.members)).toEqual(cut.groups.map((g) => g.members));
    expect(full.groups.map((g) => g.theoryProb)).toEqual(cut.groups.map((g) => g.theoryProb));
  });
});
