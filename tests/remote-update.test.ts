// 공개 미러에서 최신 회차를 받아오는 기능 테스트.
//
// 네트워크를 타지 않도록 fetch를 갈아끼워 검사한다.
// 핵심은 "이상한 데이터가 오면 절대 통과시키지 않는다" 이다.

import { describe, expect, it } from "vitest";

import { checkForUpdates, MIRROR_BASE } from "../src/core/remoteUpdate";

const draw = (round: number, numbers: number[], bonus: number | null = 7) => ({
  draw_no: round,
  numbers,
  bonus_no: bonus,
  date: "2026-10-24T00:00:00Z",
});

const N1 = [1, 2, 3, 4, 5, 6];
const N2 = [10, 20, 23, 34, 37, 40];

/** url -> 응답으로 쓸 객체. 없으면 404처럼 동작한다. */
function fakeFetch(map: Record<string, unknown>, opts: { fail?: string } = {}) {
  const calls: string[] = [];
  const impl = async (url: string): Promise<Response> => {
    calls.push(url);
    if (opts.fail && url.includes(opts.fail)) throw new Error("network down");
    if (!(url in map)) return { ok: false, status: 404, json: async () => ({}) } as Response;
    return { ok: true, status: 200, json: async () => map[url] } as Response;
  };
  return { impl, calls };
}

const latestUrl = `${MIRROR_BASE}/latest.json`;
const allUrl = `${MIRROR_BASE}/all.json`;
const roundUrl = (r: number) => `${MIRROR_BASE}/${r}.json`;

describe("최신 회차 확인", () => {
  it("이미 최신이면 추가할 회차가 없다", async () => {
    const { impl } = fakeFetch({ [latestUrl]: draw(1236, N1) });
    const r = await checkForUpdates([1234, 1235, 1236], impl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newDraws).toEqual([]);
    expect(r.latestRemote).toBe(1236);
    expect(r.latestLocal).toBe(1236);
  });

  it("몇 건 안 되면 회차별로 받아온다", async () => {
    const { impl, calls } = fakeFetch({
      [latestUrl]: draw(1238, N2, 36),
      [roundUrl(1237)]: draw(1237, N1, 9),
      [roundUrl(1238)]: draw(1238, N2, 36),
    });
    const r = await checkForUpdates([1235, 1236], impl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newDraws.map((d) => d.round)).toEqual([1237, 1238]);
    expect(r.newDraws[1].numbers).toEqual(N2);
    expect(r.newDraws[1].bonus).toBe(36);
    expect(calls).not.toContain(allUrl); // 전체 파일은 받지 않는다
  });

  it("많이 밀렸으면 전체 파일을 한 번만 받는다", async () => {
    const all = [];
    for (let r = 1230; r <= 1242; r += 1) all.push(draw(r, N1, 7));
    const { impl, calls } = fakeFetch({ [latestUrl]: draw(1242, N1), [allUrl]: all });
    const r = await checkForUpdates([1235, 1236], impl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newDraws.length).toBe(6); // 1237~1242
    expect(r.newDraws[0].round).toBe(1237);
    expect(calls.filter((c) => c === allUrl).length).toBe(1);
  });

  it("번호는 정렬해서 돌려준다", async () => {
    const { impl } = fakeFetch({
      [latestUrl]: draw(1237, [40, 10, 37, 20, 34, 23], 36),
      [roundUrl(1237)]: draw(1237, [40, 10, 37, 20, 34, 23], 36),
    });
    const r = await checkForUpdates([1236], impl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newDraws[0].numbers).toEqual(N2);
  });

  it("보너스가 없어도 받아들인다", async () => {
    const { impl } = fakeFetch({
      [latestUrl]: draw(1237, N1, null),
      [roundUrl(1237)]: draw(1237, N1, null),
    });
    const r = await checkForUpdates([1236], impl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newDraws[0].bonus).toBeNull();
  });
});

describe("이상한 데이터는 막는다", () => {
  const bad: Array<[string, unknown]> = [
    ["번호가 5개", draw(1237, [1, 2, 3, 4, 5] as number[])],
    ["번호가 7개", draw(1237, [1, 2, 3, 4, 5, 6, 7])],
    ["범위 밖 번호", draw(1237, [1, 2, 3, 4, 5, 46])],
    ["0이 섞임", draw(1237, [0, 2, 3, 4, 5, 6])],
    ["중복 번호", draw(1237, [1, 1, 3, 4, 5, 6])],
    ["보너스가 본번호와 겹침", draw(1237, N1, 3)],
    ["보너스 범위 밖", draw(1237, N1, 99)],
    ["회차가 숫자가 아님", { draw_no: "x", numbers: N1, bonus_no: 7 }],
    ["numbers가 배열이 아님", { draw_no: 1237, numbers: "1,2,3", bonus_no: 7 }],
  ];

  for (const [label, payload] of bad) {
    it(`${label} → 반영하지 않는다`, async () => {
      const { impl } = fakeFetch({ [latestUrl]: payload, [roundUrl(1237)]: payload });
      const r = await checkForUpdates([1236], impl);
      expect(r.ok).toBe(false);
    });
  }

  it("회차가 중간에 비면 거절한다", async () => {
    // 1237은 멀쩡하지만 1238 자리에 1239가 오는 상황
    const all = [draw(1237, N1), draw(1239, N2)];
    const { impl } = fakeFetch({ [latestUrl]: draw(1243, N1), [allUrl]: all });
    const r = await checkForUpdates([1236], impl);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("미러에 없습니다");
  });

  it("요청한 회차와 다른 회차가 오면 거절한다", async () => {
    const { impl } = fakeFetch({
      [latestUrl]: draw(1237, N1),
      [roundUrl(1237)]: draw(999, N1),
    });
    const r = await checkForUpdates([1236], impl);
    expect(r.ok).toBe(false);
  });
});

describe("네트워크 문제", () => {
  it("최신 회차 조회가 실패하면 안내한다", async () => {
    const { impl } = fakeFetch({}, { fail: "latest.json" });
    const r = await checkForUpdates([1236], impl);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("인터넷 연결");
  });

  it("개별 회차 조회가 실패하면 아무것도 반영하지 않는다", async () => {
    const { impl } = fakeFetch({ [latestUrl]: draw(1237, N1) }, { fail: "1237.json" });
    const r = await checkForUpdates([1236], impl);
    expect(r.ok).toBe(false);
  });

  it("404면 실패로 처리한다", async () => {
    const { impl } = fakeFetch({ [latestUrl]: draw(1237, N1) }); // 1237.json 없음
    const r = await checkForUpdates([1236], impl);
    expect(r.ok).toBe(false);
  });

  it("기준 데이터가 없으면 거절한다", async () => {
    const { impl } = fakeFetch({});
    const r = await checkForUpdates([], impl);
    expect(r.ok).toBe(false);
  });
});
