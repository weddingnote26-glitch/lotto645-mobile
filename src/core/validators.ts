// 데이터 검증 유틸리티 — PC 버전 utils/validators.py의 1:1 이식.
//
// 잘못된 데이터가 있어도 앱이 멈추지 않도록, 예외 대신 '오류 메시지 리스트'를
// 돌려주는 방식을 기본으로 한다. 복구 불가능한 상황에만 DataError를 던진다.

/** 복구 불가능한 데이터 오류 — 화면에 안내하고 앱은 계속 실행. */
export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataError";
  }
}

/**
 * 엑셀 셀 값을 정수로 안전 변환. 변환 불가하면 null.
 * PC 버전 to_int()와 동일한 판정을 하도록 맞췄다
 * (bool 제외, 소수는 정수일 때만 허용, 콤마 제거, 빈 값/"-" 제외).
 */
export function toInt(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }
  if (value instanceof Date) return null;
  const s = String(value).trim().replace(/,/g, "");
  if (s === "" || s === "-") return null;
  const f = Number(s);
  if (!Number.isFinite(f)) return null;
  return Number.isInteger(f) ? f : null;
}

/**
 * 한 회차 데이터의 오류 메시지 리스트 반환. 빈 배열이면 정상.
 *
 * 검증 항목:
 * - 회차가 숫자인지
 * - 당첨번호가 6개인지 / 빈 값이 없는지
 * - 1~45 범위인지
 * - 회차 안에 중복 숫자가 없는지
 * - 보너스 번호 범위 (보너스는 분석에서 제외되지만 형식은 검사)
 */
export function validateDraw(
  roundNo: number | null,
  balls: Array<number | null>,
  bonus: number | null,
): string[] {
  const errors: string[] = [];
  if (roundNo === null) {
    errors.push("회차 값이 숫자가 아닌 행 발견");
    return errors;
  }
  const clean = balls.filter((b): b is number => b !== null);
  if (clean.length !== 6) {
    errors.push(`${roundNo}회: 당첨번호가 ${clean.length}개 (6개 필요, 빈 값 존재)`);
    return errors;
  }
  if (clean.some((b) => !(b >= 1 && b <= 45))) {
    errors.push(`${roundNo}회: 1~45 범위 밖 번호 포함 ${clean.join(", ")}`);
  }
  if (new Set(clean).size !== 6) {
    errors.push(`${roundNo}회: 회차 안에 중복 번호 ${clean.join(", ")}`);
  }
  if (bonus !== null && !(bonus >= 1 && bonus <= 45)) {
    errors.push(`${roundNo}회: 보너스 번호 범위 오류 (${bonus})`);
  }
  return errors;
}
