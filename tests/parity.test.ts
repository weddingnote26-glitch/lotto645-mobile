// PC 버전 대조 테스트.
//
// tests/fixtures/pc_reference.json 은 기존 Windows LottoAnalyzer의 파이썬 코드를
// 실제로 실행해서 뽑아낸 기준값이다 (1236회 데이터). 여기서는 TypeScript 이식본이
// 같은 입력에 대해 같은 값을 내는지 항목별로 확인한다.
//
// 무작위가 개입하는 부분(9순위 동률 선택, 조합 생성)은 값 일치가 아니라
// 규칙 준수 여부로 검증한다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { analyze, ZONE10_LABELS } from "../src/core/analyzer";
import { buildLottoData, loadLottoWorkbook } from "../src/core/excelLoader";
import {
  consecutivePairs,
  distinctZones10,
  generateGames,
  oddCount,
} from "../src/core/combinationGenerator";
import { selectCoreNumber, selectionReason } from "../src/core/numberSelector";
import { seededRng } from "../src/core/rng";
import { decodeSeedRows, SEED_LATEST_ROUND } from "../src/data/seedDraws";

const HERE = dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(readFileSync(join(HERE, "fixtures", "pc_reference.json"), "utf8"));

const seedData = buildLottoData(decodeSeedRows(), "seed");
const seedAnalysis = analyze(seedData);

/** 부동소수점 배열 비교 */
function expectCloseArray(actual: number[], expected: number[]) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 10));
}

describe("내장 시드 데이터가 PC 원본 엑셀과 같은 내용인지", () => {
  it("최신 회차 / 총 회차 수", () => {
    expect(seedData.rounds.length).toBe(ref.total_rounds);
    expect(seedAnalysis.latest).toBe(ref.latest);
    expect(SEED_LATEST_ROUND).toBe(ref.latest);
  });

  it("첫 회차와 최신 회차 당첨번호", () => {
    expect(seedData.draws.get(ref.latest)).toEqual(ref.latest_draw);
    expect(seedData.draws.get(ref.first_round)).toEqual(ref.first_draw);
    expect(seedData.bonus.get(ref.latest)).toBe(ref.latest_bonus);
  });

  it("전체 번호 출현 합계 = 회차수 × 6", () => {
    const total = Object.values(seedAnalysis.stats).reduce((s, v) => s + v.cntTotal, 0);
    expect(total).toBe(ref.total_rounds * 6);
  });
});

describe("최근 5회 / 10회 분석 결과가 PC와 일치하는지", () => {
  const cases: Array<["win5" | "win10", string]> = [
    ["win5", "최근 5회"],
    ["win10", "최근 10회"],
  ];

  for (const [key, label] of cases) {
    describe(label, () => {
      const got = seedAnalysis[key];
      const want = ref[key];

      it("분석 대상 회차 범위", () => {
        expect(got.rounds[0]).toBe(want.rounds_first);
        expect(got.rounds[got.rounds.length - 1]).toBe(want.rounds_last);
        expect(got.totalBalls).toBe(want.total_balls);
      });

      it("홀짝", () => {
        expect(got.odd).toBe(want.odd);
        expect(got.even).toBe(want.even);
      });

      it("10단위 구간 (횟수 / 보정 출현률 / 높음·보통·낮음)", () => {
        expect(got.zone10Counts).toEqual(want.zone10_counts);
        expectCloseArray(got.zone10Rates, want.zone10_rates);
        expect(got.zone10Levels).toEqual(want.zone10_levels);
      });

      it("15단위 구간 (횟수 / 비율)", () => {
        expect(got.zone15Counts).toEqual(want.zone15_counts);
        expectCloseArray(got.zone15Ratios, want.zone15_ratios);
      });
    });
  }
});

describe("1~45 번호별 통계가 PC와 전부 일치하는지", () => {
  it("cnt5 / cnt10 / cntTotal / lastRound / gap / inPrev / 홀짝 / 구간", () => {
    for (let n = 1; n <= 45; n += 1) {
      const got = seedAnalysis.stats[n];
      const want = ref.stats[String(n)];
      expect({
        cnt5: got.cnt5,
        cnt10: got.cnt10,
        cntTotal: got.cntTotal,
        lastRound: got.lastRound,
        gap: got.gap,
        inPrev: got.inPrev,
        odd: got.odd,
        zone10: got.zone10,
        zone15: got.zone15,
      }).toEqual({
        cnt5: want.cnt5,
        cnt10: want.cnt10,
        cntTotal: want.cnt_total,
        lastRound: want.last_round,
        gap: want.gap,
        inPrev: want.in_prev,
        odd: want.odd,
        zone10: want.zone10,
        zone15: want.zone15,
      });
    }
  });
});

describe("핵심 추천번호 선정", () => {
  it("PC와 동일한 번호를 선정한다", () => {
    const sel = selectCoreNumber(seedAnalysis);
    expect(sel.number).toBe(ref.core_number);
    expect(sel.usedRandom).toBe(ref.used_random);
  });

  it("선정 과정(단계·후보·설명)이 PC 로그와 동일하다", () => {
    const sel = selectCoreNumber(seedAnalysis);
    expect(sel.steps.length).toBe(ref.selection_steps.length);
    sel.steps.forEach((s, i) => {
      const want = ref.selection_steps[i];
      expect(s.order).toBe(want.order);
      expect(s.title).toBe(want.title);
      expect(s.detail).toBe(want.detail);
      expect([...s.before].sort((a, b) => a - b)).toEqual(want.before);
      expect([...s.after].sort((a, b) => a - b)).toEqual(want.after);
    });
  });

  it("여러 번 실행해도 결과가 바뀌지 않는다 (동률 아닐 때)", () => {
    const runs = new Set(
      Array.from({ length: 50 }, () => selectCoreNumber(seedAnalysis).number),
    );
    expect([...runs]).toEqual([ref.core_number]);
  });

  it("선정 이유 요약이 PC와 일치한다", () => {
    const reason = Object.fromEntries(selectionReason(seedAnalysis, ref.core_number));
    expect(reason).toEqual(ref.selection_reason);
  });

  it("완전 동률이면 무작위 선택으로 표시된다", () => {
    const tie = analyze(
      buildLottoData(
        Array.from({ length: 10 }, (_, i) => [i + 1, 1, 2, 3, 4, 5, 6, 7]),
        "tie",
      ),
    );
    const sel = selectCoreNumber(tie, seededRng(1));
    expect(sel.usedRandom).toBe(true);
    expect(sel.steps[sel.steps.length - 1].title).toContain("무작위 선택");
  });
});

describe("엑셀 로더 (브라우저에서 쓰는 것과 같은 코드)", async () => {
  const buf = readFileSync(join(HERE, "fixtures", "lotto_1236.xlsx"));
  const loaded = await loadLottoWorkbook(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    "lotto_1236.xlsx",
  );

  it("PC 로더와 같은 회차 수·최신 회차를 읽는다", () => {
    expect(loaded.rounds.length).toBe(ref.total_rounds);
    expect(loaded.rounds[loaded.rounds.length - 1]).toBe(ref.latest);
    expect(loaded.warnings).toEqual(ref.warnings);
  });

  it("모든 회차의 당첨번호·보너스가 PC 결과와 같다", () => {
    for (const r of loaded.rounds) {
      expect(loaded.draws.get(r)).toEqual(seedData.draws.get(r));
      expect(loaded.bonus.get(r)).toBe(seedData.bonus.get(r));
    }
  });

  it("업로드한 엑셀로 분석해도 같은 추천번호가 나온다", () => {
    expect(selectCoreNumber(analyze(loaded)).number).toBe(ref.core_number);
  });
});

describe("번호 생성기", () => {
  const rng = seededRng(20260810);

  it("완전 랜덤: 1~45 중복 없는 6개, 오름차순", () => {
    for (const combo of generateGames(20, "A", null, rng)) {
      expect(combo.length).toBe(6);
      expect(new Set(combo).size).toBe(6);
      expect(combo.every((n) => n >= 1 && n <= 45)).toBe(true);
      expect(combo).toEqual([...combo].sort((a, b) => a - b));
    }
  });

  it("핵심 추천번호 포함 ON이면 모든 게임에 그 번호가 들어간다", () => {
    const core = ref.core_number;
    for (const combo of generateGames(20, "B", core, rng)) {
      expect(combo).toContain(core);
    }
  });

  it("게임 수만큼 생성되고 완전히 같은 조합은 없다", () => {
    for (const n of [1, 5, 10, 20]) {
      const games = generateGames(n, "B", null, rng);
      expect(games.length).toBe(n);
      expect(new Set(games.map((g) => g.join(","))).size).toBe(n);
    }
  });

  it("분석 기반 균형: 홀짝 2~4, 10단위 구간 3개 이상, 연속 1쌍 이하", () => {
    for (const combo of generateGames(20, "B", null, rng)) {
      expect(oddCount(combo)).toBeGreaterThanOrEqual(2);
      expect(oddCount(combo)).toBeLessThanOrEqual(4);
      expect(distinctZones10(combo)).toBeGreaterThanOrEqual(3);
      expect(consecutivePairs(combo)).toBeLessThanOrEqual(1);
    }
  });
});

describe("구간 라벨", () => {
  it("PC와 같은 라벨을 쓴다", () => {
    expect(ZONE10_LABELS).toEqual(["1~10", "11~20", "21~30", "31~40", "41~45"]);
  });
});
