// 공개 미러에서 최신 회차를 받아오는 기능.
//
// ── 왜 이 경로인가 ───────────────────────────────────────────────────
// 동행복권 사이트는 해외·데이터센터 IP를 통째로 막아 두어(메인 페이지까지
// 302) 서버나 빌드 과정에서 직접 받아올 수 없다. 브라우저인 척 우회하는
// 방법은 쓰지 않는다. 공공데이터포털에도 당첨번호 API는 없다.
//
// 그래서 CORS를 열어 둔 공개 미러(smok95/lotto)를 쓴다. GitHub Pages가
// Access-Control-Allow-Origin: * 을 주기 때문에 서버 없이 휴대폰에서 바로
// 받을 수 있다. 1~1236회를 우리가 가진 검증 데이터와 전수 대조해 본번호·
// 보너스 모두 한 건도 어긋나지 않는 것을 확인했다.
//
// ── 주의 ─────────────────────────────────────────────────────────────
// 개인이 운영하는 비공식 저장소라 갱신이 늦거나 멈출 수 있다. 그래서
//   · 받은 데이터는 반드시 검증한 뒤에만 넘긴다
//   · 자동으로 덮어쓰지 않고 사용자가 확인한 뒤 반영한다
//   · 기존 회차는 건드리지 않고 새 회차만 뒤에 붙인다
//   · 수동 입력(번호판·붙여넣기·엑셀) 경로는 그대로 둔다
// ─────────────────────────────────────────────────────────────────────

export const MIRROR_BASE = "https://smok95.github.io/lotto/results";
export const MIRROR_NAME = "smok95/lotto";
export const MIRROR_URL = "https://github.com/smok95/lotto";

/** 한 번에 개별 조회할 최대 회차 수. 이보다 많으면 전체 파일을 한 번에 받는다. */
const INDIVIDUAL_LIMIT = 5;

export interface RemoteDraw {
  round: number;
  numbers: number[];
  bonus: number | null;
  /** 추첨일 (미러가 주는 경우) */
  date: string | null;
}

export type CheckResult =
  | {
      ok: true;
      /** 미러의 최신 회차 */
      latestRemote: number;
      /** 우리가 가진 최신 회차 */
      latestLocal: number;
      /** 추가할 수 있는 새 회차들 (회차 오름차순) */
      newDraws: RemoteDraw[];
    }
  | { ok: false; error: string };

type FetchLike = (url: string) => Promise<Response>;

/** 미러가 주는 한 건을 우리 형식으로 바꾸고 형식을 확인한다. */
function toRemoteDraw(raw: unknown): RemoteDraw | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const round = Number(o.draw_no);
  if (!Number.isInteger(round) || round < 1) return null;

  if (!Array.isArray(o.numbers)) return null;
  const numbers = o.numbers.map(Number);
  if (numbers.length !== 6) return null;
  if (!numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)) return null;
  if (new Set(numbers).size !== 6) return null;

  let bonus: number | null = null;
  if (o.bonus_no !== null && o.bonus_no !== undefined) {
    const b = Number(o.bonus_no);
    if (!Number.isInteger(b) || b < 1 || b > 45) return null;
    if (numbers.includes(b)) return null;
    bonus = b;
  }

  return {
    round,
    numbers: [...numbers].sort((a, b) => a - b),
    bonus,
    date: typeof o.date === "string" ? o.date : null,
  };
}

async function getJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`서버가 ${res.status}로 응답했습니다.`);
  return res.json();
}

/**
 * 미러를 확인해 우리가 아직 없는 회차를 찾아 온다.
 * 아무것도 저장하지 않는다 — 반영은 호출한 쪽이 사용자 확인 후에 한다.
 */
export async function checkForUpdates(
  localRounds: number[],
  fetchImpl: FetchLike = (u) => fetch(u, { cache: "no-store" }),
): Promise<CheckResult> {
  if (localRounds.length === 0) return { ok: false, error: "기준 데이터가 없습니다." };
  const have = new Set(localRounds);
  const latestLocal = Math.max(...localRounds);

  // 1) 최신 회차만 먼저 확인한다 (작고 빠르다).
  let latest: RemoteDraw | null;
  try {
    latest = toRemoteDraw(await getJson(fetchImpl, `${MIRROR_BASE}/latest.json`));
  } catch (e) {
    return {
      ok: false,
      error: `최신 회차를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. (${(e as Error).message})`,
    };
  }
  if (!latest) return { ok: false, error: "받은 데이터 형식이 올바르지 않습니다." };

  const latestRemote = latest.round;
  if (latestRemote <= latestLocal) {
    return { ok: true, latestRemote, latestLocal, newDraws: [] };
  }

  // 2) 빠진 회차를 모은다.
  const missing: number[] = [];
  for (let r = latestLocal + 1; r <= latestRemote; r += 1) if (!have.has(r)) missing.push(r);
  if (missing.length === 0) return { ok: true, latestRemote, latestLocal, newDraws: [] };

  const collected: RemoteDraw[] = [];
  try {
    if (missing.length <= INDIVIDUAL_LIMIT) {
      // 몇 건 안 되면 회차별로 받는다 (전송량이 훨씬 적다).
      for (const r of missing) {
        const d = toRemoteDraw(await getJson(fetchImpl, `${MIRROR_BASE}/${r}.json`));
        if (!d || d.round !== r) return { ok: false, error: `${r}회 데이터가 올바르지 않습니다.` };
        collected.push(d);
      }
    } else {
      // 많이 밀렸으면 전체를 한 번에 받는다.
      const all = await getJson(fetchImpl, `${MIRROR_BASE}/all.json`);
      if (!Array.isArray(all)) return { ok: false, error: "전체 데이터 형식이 올바르지 않습니다." };
      const byRound = new Map<number, RemoteDraw>();
      for (const raw of all) {
        const d = toRemoteDraw(raw);
        if (d) byRound.set(d.round, d);
      }
      for (const r of missing) {
        const d = byRound.get(r);
        if (!d) return { ok: false, error: `${r}회 데이터가 미러에 없습니다.` };
        collected.push(d);
      }
    }
  } catch (e) {
    return { ok: false, error: `회차를 불러오지 못했습니다. (${(e as Error).message})` };
  }

  // 3) 회차가 중간에 비지 않았는지 확인한다.
  collected.sort((a, b) => a.round - b.round);
  for (let i = 0; i < collected.length; i += 1) {
    if (collected[i].round !== latestLocal + 1 + i) {
      return { ok: false, error: "받아온 회차가 중간에 비어 있어 반영하지 않았습니다." };
    }
  }

  return { ok: true, latestRemote, latestLocal, newDraws: collected };
}
