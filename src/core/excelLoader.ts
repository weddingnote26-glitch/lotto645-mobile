// 엑셀 당첨번호 로더 — PC 버전 core/data_loader.py의 1:1 이식.
// 브라우저 안에서 SheetJS로 직접 파싱한다. 파일은 어떤 서버로도 전송되지 않는다.
//
// 컬럼명이 조금 달라도 동작하도록 두 단계로 탐지한다.
// 1) 헤더 이름 매칭: 회차/round, 당첨번호1~6/번호1/ball1/1번, 보너스/bonus.
//    '당첨번호' 하나가 병합 셀로 6칸에 걸쳐 있는 형태(동행복권 다운로드 형식)도 지원.
// 2) 내용 기반 추정: 이름으로 못 찾으면, 값이 1~45 정수로만 이루어진
//    연속 6개 열을 본번호 블록으로 추정한다.
//
// 잘못된 회차 행은 경고로 수집하고 제외할 뿐, 앱을 멈추지 않는다.

import type { LottoData } from "./types";
import { DataError, toInt, validateDraw } from "./validators";

type Cell = unknown;
type Row = Cell[];

const ROUND_PAT = /회\s*차|\bround\b|drw\s*no|draw\s*no/i;
const BONUS_PAT = /보너스|bonus/i;
// Python의 re.match(문자열 시작 고정)와 같도록 앞에 ^를 붙였다.
const BALL_PAT = /^(?:(?:당첨\s*번호|당첨|번\s*호|ball|볼)\s*([1-6])\s*$|\s*([1-6])\s*번?\s*$)/i;
const BALL_GROUP_PAT = /당첨\s*번호\s*$|winning/i;

/** 상위 10행에서 회차 헤더가 있는 행 인덱스를 찾는다. 없으면 null. */
function findHeader(rows: Row[]): number | null {
  const limit = Math.min(10, rows.length);
  for (let i = 0; i < limit; i += 1) {
    for (const cell of rows[i]) {
      if (typeof cell === "string" && ROUND_PAT.test(cell)) return i;
    }
  }
  return null;
}

interface ColumnMap {
  roundCol: number | null;
  ballCols: number[] | null;
  bonusCol: number | null;
}

/** 헤더 이름으로 (회차열, 본번호 6열, 보너스열) 매핑. 실패 항목은 null. */
function mapByHeader(header: Row): ColumnMap {
  let roundCol: number | null = null;
  let bonusCol: number | null = null;
  let groupCol: number | null = null;
  const balls = new Map<number, number>();

  header.forEach((cell, idx) => {
    if (typeof cell !== "string") return;
    const text = cell.trim();
    if (roundCol === null && ROUND_PAT.test(text)) {
      roundCol = idx;
      return;
    }
    if (bonusCol === null && BONUS_PAT.test(text)) {
      bonusCol = idx;
      return;
    }
    const m = BALL_PAT.exec(text);
    if (m) {
      const k = Number(m[1] ?? m[2]);
      if (!balls.has(k)) balls.set(k, idx);
      return;
    }
    if (groupCol === null && BALL_GROUP_PAT.test(text)) groupCol = idx;
  });

  let ballCols: number[] | null = null;
  if (balls.size === 6) {
    ballCols = [1, 2, 3, 4, 5, 6].map((k) => balls.get(k) as number);
  } else if (groupCol !== null) {
    // 병합 헤더: '당첨번호' 열부터 연속 6칸이 본번호
    const g: number = groupCol;
    ballCols = [0, 1, 2, 3, 4, 5].map((d) => g + d);
  }
  return { roundCol, ballCols, bonusCol };
}

function intRatioInRange(values: Cell[], lo: number, hi: number): [number, number] {
  const nonnull = values.map(toInt).filter((v): v is number => v !== null);
  if (nonnull.length === 0) return [0.0, 0];
  const ok = nonnull.filter((v) => v >= lo && v <= hi).length;
  return [ok / nonnull.length, nonnull.length];
}

function isUniqueIntCol(col: Cell[]): boolean {
  const nonnull = col.map(toInt).filter((v): v is number => v !== null);
  return nonnull.length > 0 && new Set(nonnull).size === nonnull.length;
}

/**
 * 후보 6열이 행 단위로 '서로 다른 6개 숫자'를 이루는 비율.
 *
 * 회차 열이 우연히 1~45 안에 있어도(작은 데이터) 회차와 본번호가 겹치는 행이
 * 생기기 마련이라, 이 비율이 본번호 블록과 다른 블록을 구분해 준다.
 */
function rowDistinctRatio(dataRows: Row[], cols: number[]): number {
  let ok = 0;
  let tot = 0;
  for (const r of dataRows) {
    const vals = cols.map((c) => (c < r.length ? toInt(r[c]) : null));
    if (vals.some((v) => v === null)) continue;
    tot += 1;
    if (new Set(vals).size === 6) ok += 1;
  }
  return tot ? ok / tot : 0.0;
}

/** 내용 기반 추정: 1~45 정수로만 된 연속 6열 블록 + 그 앞의 고유 정수열(회차). */
function mapByContent(dataRows: Row[]): ColumnMap {
  const empty: ColumnMap = { roundCol: null, ballCols: null, bonusCol: null };
  if (dataRows.length === 0) return empty;

  const width = Math.max(...dataRows.map((r) => r.length));
  const cols: Cell[][] = [];
  for (let i = 0; i < width; i += 1) {
    cols.push(dataRows.map((r) => (i < r.length ? r[i] : null)));
  }

  const minNonNull = Math.max(3, Math.floor(dataRows.length / 2));
  const in45 = cols.map((col) => {
    const [ratio, n] = intRatioInRange(col, 1, 45);
    return ratio >= 0.98 && n >= minNonNull;
  });

  // 후보 블록: 6열 연속 1~45 + 행 단위 중복 없음(90% 이상).
  // 여러 블록이 가능하면 '왼쪽 이웃이 고유 정수열(회차 형태)'인 블록을 우선.
  const candidates: Array<[number, number, number[]]> = [];
  for (let start = 0; start < width - 5; start += 1) {
    const block = [0, 1, 2, 3, 4, 5].map((d) => start + d);
    if (block.every((c) => in45[c]) && rowDistinctRatio(dataRows, block) >= 0.9) {
      const leftIsRound = start > 0 && isUniqueIntCol(cols[start - 1]);
      candidates.push([leftIsRound ? 0 : 1, start, block]);
    }
  }
  if (candidates.length === 0) return empty;
  candidates.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ballCols = candidates[0][2];

  // 회차: 본번호 블록 왼쪽에서 가장 가까운 '고유 정수' 열
  let roundCol: number | null = null;
  for (let i = ballCols[0] - 1; i >= 0; i -= 1) {
    if (isUniqueIntCol(cols[i])) {
      roundCol = i;
      break;
    }
  }

  const after = ballCols[ballCols.length - 1] + 1;
  const bonusCol = after < width && in45[after] ? after : null;
  return { roundCol, ballCols, bonusCol };
}

function loadSheet(rows: Row[], source: string, sheetName: string): LottoData {
  const headerIdx = findHeader(rows);
  let roundCol: number | null = null;
  let ballCols: number[] | null = null;
  let bonusCol: number | null = null;

  if (headerIdx !== null) {
    ({ roundCol, ballCols, bonusCol } = mapByHeader(rows[headerIdx]));
  }
  const dataRows = rows.slice(headerIdx !== null ? headerIdx + 1 : 0);

  if (roundCol === null || ballCols === null) {
    const byContent = mapByContent(dataRows);
    roundCol = roundCol !== null ? roundCol : byContent.roundCol;
    ballCols = ballCols !== null ? ballCols : byContent.ballCols;
    bonusCol = bonusCol !== null ? bonusCol : byContent.bonusCol;
  }
  if (roundCol === null || ballCols === null) {
    throw new DataError(`[${sheetName}] 회차/당첨번호 컬럼을 찾지 못했습니다.`);
  }

  const draws = new Map<number, number[]>();
  const bonus = new Map<number, number | null>();
  const warnings: string[] = [];

  for (const row of dataRows) {
    const get = (i: number): Cell => (i < row.length ? row[i] : null);
    const rn = toInt(get(roundCol));
    const balls = ballCols.map((c) => toInt(get(c)));
    const bn = bonusCol !== null ? toInt(get(bonusCol)) : null;
    if (rn === null && balls.every((b) => b === null)) continue; // 빈 행
    const errs = validateDraw(rn, balls, bn);
    if (errs.length) {
      warnings.push(...errs);
      continue;
    }
    if (draws.has(rn as number)) {
      warnings.push(`${rn}회: 중복 회차 발견 — 먼저 나온 행만 사용`);
      continue;
    }
    draws.set(
      rn as number,
      (balls as number[]).slice().sort((a, b) => a - b),
    );
    bonus.set(rn as number, bn);
  }

  if (draws.size === 0) {
    throw new DataError(`[${sheetName}] 유효한 회차 데이터가 없습니다.`);
  }
  const rounds = [...draws.keys()].sort((a, b) => a - b);
  if (rounds.length < 10) {
    warnings.push(
      `주의: 유효 회차가 ${rounds.length}개뿐입니다. 최근 5회/10회 분석은 가용한 회차만으로 계산합니다.`,
    );
  }
  if (bonusCol === null) {
    warnings.push("보너스 번호 컬럼을 찾지 못했습니다 (분석에는 영향 없음 — 보너스는 제외 대상).");
  }
  return { draws, bonus, rounds, source, warnings };
}

/**
 * 엑셀(.xlsx/.xlsm) 바이트를 읽어 LottoData를 반환.
 * 시트를 순회하며 처음 성공하는 시트를 사용한다.
 *
 * SheetJS는 용량이 크고 '데이터 업데이트'를 누를 때만 필요하므로 동적 import로
 * 분리한다. 첫 화면 로딩에는 포함되지 않는다.
 */
export async function loadLottoWorkbook(buffer: ArrayBuffer, source: string): Promise<LottoData> {
  const XLSX = await import("xlsx");
  let wb: import("xlsx").WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch (e) {
    throw new DataError(`엑셀 파일을 열 수 없습니다: ${(e as Error).message}`);
  }
  const errors: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Row>(ws, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    });
    if (rows.length === 0) continue;
    try {
      return loadSheet(rows, source, name);
    } catch (e) {
      if (e instanceof DataError) errors.push(e.message);
      else throw e;
    }
  }
  throw new DataError(`당첨번호 데이터를 인식하지 못했습니다.\n${errors.slice(0, 5).join("\n")}`);
}

/** 파일 입력(<input type="file">)에서 바로 읽기. */
export async function loadLottoFile(file: File): Promise<LottoData> {
  const buffer = await file.arrayBuffer();
  return loadLottoWorkbook(buffer, file.name);
}

/**
 * [회차, n1..n6, 보너스] 형태의 배열에서 LottoData를 만든다.
 * 내장 기본 데이터와 IndexedDB에 저장된 데이터를 복원할 때 사용.
 */
export function buildLottoData(rows: number[][], source: string): LottoData {
  const draws = new Map<number, number[]>();
  const bonus = new Map<number, number | null>();
  for (const row of rows) {
    const [rn, ...rest] = row;
    const balls = rest.slice(0, 6);
    const bn = rest.length > 6 ? rest[6] : null;
    draws.set(rn, balls.slice().sort((a, b) => a - b));
    bonus.set(rn, bn === undefined ? null : bn);
  }
  const rounds = [...draws.keys()].sort((a, b) => a - b);
  return { draws, bonus, rounds, source, warnings: [] };
}

/** LottoData를 저장용 배열로 되돌린다. */
export function serializeLottoData(data: LottoData): number[][] {
  return data.rounds.map((r) => {
    const bn = data.bonus.get(r);
    return [r, ...(data.draws.get(r) as number[]), ...(bn === null || bn === undefined ? [] : [bn])];
  });
}
