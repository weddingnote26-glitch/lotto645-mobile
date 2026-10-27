// 당첨번호 직접 입력 / 붙여넣기 파서 테스트.

import { describe, expect, it } from "vitest";

import { parseDrawText, validateDrawInput } from "../src/core/drawInput";

const NEXT = 1237;

describe("붙여넣기 파싱", () => {
  it("회차 표기가 있는 기본 형식", () => {
    const r = parseDrawText("1237회 3 7 12 20 33 41 + 15", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw).toEqual({ round: 1237, numbers: [3, 7, 12, 20, 33, 41], bonus: 15 });
    expect(r.usedSuggestedRound).toBe(false);
  });

  it("'제1237회 당첨번호 ... 보너스' 형식", () => {
    const r = parseDrawText("제1237회 당첨번호 3·7·12·20·33·41 보너스번호 15", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.round).toBe(1237);
    expect(r.draw.numbers).toEqual([3, 7, 12, 20, 33, 41]);
    expect(r.draw.bonus).toBe(15);
  });

  it("회차가 없으면 제안 회차를 쓴다", () => {
    const r = parseDrawText("3, 7, 12, 20, 33, 41, 15", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.round).toBe(NEXT);
    expect(r.usedSuggestedRound).toBe(true);
  });

  it("45를 넘는 맨 앞 숫자는 회차로 본다", () => {
    const r = parseDrawText("1240 5 11 19 24 38 44 7", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.round).toBe(1240);
    expect(r.draw.numbers).toEqual([5, 11, 19, 24, 38, 44]);
    expect(r.draw.bonus).toBe(7);
  });

  it("금액이 섞여 있어도 번호를 헷갈리지 않는다", () => {
    const r = parseDrawText(
      "1237회 당첨결과\n1등 1,214,932,680원\n당첨번호 10 20 23 34 37 40 보너스 36",
      NEXT,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.round).toBe(1237);
    expect(r.draw.numbers).toEqual([10, 20, 23, 34, 37, 40]);
    expect(r.draw.bonus).toBe(36);
  });

  it("날짜가 섞여 있어도 걸러낸다", () => {
    const r = parseDrawText("1237회 (2026-10-27 추첨) 3 7 12 20 33 41 + 15", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.numbers).toEqual([3, 7, 12, 20, 33, 41]);
    expect(r.draw.bonus).toBe(15);
  });

  it("줄바꿈·탭으로 나뉜 형식", () => {
    const r = parseDrawText("1237\n3\n7\n12\n20\n33\n41\n15", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.numbers).toEqual([3, 7, 12, 20, 33, 41]);
  });

  it("보너스가 없어도 된다", () => {
    const r = parseDrawText("1237회 3 7 12 20 33 41", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.bonus).toBeNull();
  });

  it("번호 순서가 뒤섞여 있어도 정렬해 돌려준다", () => {
    const r = parseDrawText("1237회 41 3 33 7 20 12", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.numbers).toEqual([3, 7, 12, 20, 33, 41]);
  });

  it("빈 입력은 거절한다", () => {
    expect(parseDrawText("", NEXT).ok).toBe(false);
    expect(parseDrawText("   \n ", NEXT).ok).toBe(false);
  });

  it("번호가 모자라면 이유를 알려 준다", () => {
    const r = parseDrawText("1237회 3 7 12", NEXT);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("6개 이상");
  });

  it("중복된 번호는 건너뛰고 6개를 채운다", () => {
    const r = parseDrawText("1237회 3 3 7 12 20 33 41 15", NEXT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.numbers).toEqual([3, 7, 12, 20, 33, 41]);
  });
});

describe("번호판 입력 검증", () => {
  const existing = new Set([1235, 1236]);

  it("정상 입력은 통과", () => {
    expect(validateDrawInput(1237, [3, 7, 12, 20, 33, 41], 15, existing)).toBeNull();
  });

  it("보너스는 없어도 된다", () => {
    expect(validateDrawInput(1237, [3, 7, 12, 20, 33, 41], null, existing)).toBeNull();
  });

  it("이미 있는 회차는 막는다", () => {
    expect(validateDrawInput(1236, [3, 7, 12, 20, 33, 41], 15, existing)).toContain("이미");
  });

  it("번호가 6개가 아니면 막는다", () => {
    expect(validateDrawInput(1237, [3, 7, 12], 15, existing)).toContain("6개");
  });

  it("보너스가 본번호와 겹치면 막는다", () => {
    expect(validateDrawInput(1237, [3, 7, 12, 20, 33, 41], 3, existing)).toContain("겹칩니다");
  });

  it("회차가 잘못되면 막는다", () => {
    expect(validateDrawInput(0, [3, 7, 12, 20, 33, 41], 15, existing)).toContain("회차");
  });
});
