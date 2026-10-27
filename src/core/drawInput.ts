// 당첨번호 한 회차를 손으로 넣기 위한 파서.
//
// 매주 늘어나는 건 숫자 7개(회차 + 본번호 6 + 보너스)뿐이라, 엑셀을 내려받아
// 첨부하는 대신 붙여넣기나 번호판 선택으로 끝낼 수 있게 한다.
//
// 붙여넣는 글은 형식이 제각각이라 숫자만 추려 쓰되, 엉뚱한 숫자가 섞이지
// 않도록 금액(1,214,932,680)과 날짜(2026-10-27)를 먼저 걷어낸다.

export interface ParsedDraw {
  round: number;
  numbers: number[];
  bonus: number | null;
}

export type ParseResult =
  | { ok: true; draw: ParsedDraw; usedSuggestedRound: boolean }
  | { ok: false; error: string };

/**
 * 번호가 아닌 숫자를 먼저 걷어낸다.
 * 금액 · 날짜 · 시각은 물론, '1등' '3,000원' '12명' 같은 꼬리표가 붙은 숫자도
 * 번호로 오해하지 않도록 통째로 지운다.
 */
function stripNoise(text: string): string {
  return text
    .replace(/\d{1,3}(?:,\d{3})+/g, " ") // 1,214,932,680 같은 금액
    .replace(/\d{4}\s*[-./년]\s*\d{1,2}\s*[-./월]\s*\d{1,2}\s*일?/g, " ") // 날짜
    .replace(/\d{1,2}\s*:\s*\d{2}/g, " ") // 시각
    .replace(/\d+\s*(?:등|원|명|장|매|게임|주|년|월|일)/g, " "); // 등수·금액·인원 등
}

/**
 * 자유로운 형식의 글에서 한 회차를 뽑아낸다.
 *
 * 받아들이는 예
 *   "1237회 3 7 12 20 33 41 + 15"
 *   "제1237회 당첨번호 3·7·12·20·33·41 보너스 15"
 *   "3, 7, 12, 20, 33, 41, 15"           (회차는 suggestedRound로 채움)
 *
 * @param suggestedRound 글에 회차가 없을 때 쓸 값 (보통 최신 회차 + 1)
 */
export function parseDrawText(text: string, suggestedRound: number): ParseResult {
  if (!text || !text.trim()) return { ok: false, error: "붙여넣은 내용이 없습니다." };

  const cleaned = stripNoise(text);

  // '1237회' 처럼 회 앞에 붙은 숫자를 회차로 본다.
  let round: number | null = null;
  const roundMatch = cleaned.match(/(\d{1,5})\s*회/);
  if (roundMatch) round = Number(roundMatch[1]);

  // 회차로 쓴 부분은 숫자 목록에서 빼기 위해 자리를 비운다.
  const rest = roundMatch
    ? cleaned.slice(0, roundMatch.index) + " " + cleaned.slice((roundMatch.index ?? 0) + roundMatch[0].length)
    : cleaned;

  const tokens = [...rest.matchAll(/\d+/g)].map((m) => Number(m[0]));

  // 회차 표기가 없으면, 맨 앞에 45를 넘는 수가 있을 때 그걸 회차로 본다.
  let pool = tokens;
  if (round === null && tokens.length > 0 && tokens[0] > 45) {
    round = tokens[0];
    pool = tokens.slice(1);
  }

  const inRange = pool.filter((v) => v >= 1 && v <= 45);
  if (inRange.length < 6) {
    return {
      ok: false,
      error: `1~45 사이 숫자를 6개 이상 찾지 못했습니다 (${inRange.length}개 찾음).`,
    };
  }

  // 앞에서부터 서로 다른 6개를 본번호로 쓴다.
  const numbers: number[] = [];
  let i = 0;
  for (; i < inRange.length && numbers.length < 6; i += 1) {
    if (!numbers.includes(inRange[i])) numbers.push(inRange[i]);
  }
  if (numbers.length < 6) {
    return { ok: false, error: "서로 다른 번호 6개를 찾지 못했습니다." };
  }

  // 그 다음에 나오는 숫자 하나를 보너스로 본다 (없어도 된다).
  const bonus = inRange.slice(i).find((v) => !numbers.includes(v)) ?? null;

  const usedSuggested = round === null;
  const finalRound = round ?? suggestedRound;
  if (!Number.isInteger(finalRound) || finalRound < 1) {
    return { ok: false, error: "회차를 읽지 못했습니다." };
  }

  return {
    ok: true,
    draw: { round: finalRound, numbers: numbers.sort((a, b) => a - b), bonus },
    usedSuggestedRound: usedSuggested,
  };
}

/** 번호판으로 고른 값이 저장 가능한지 확인한다. */
export function validateDrawInput(
  round: number,
  numbers: number[],
  bonus: number | null,
  existingRounds: Set<number>,
): string | null {
  if (!Number.isInteger(round) || round < 1) return "회차를 올바르게 입력해 주세요.";
  if (existingRounds.has(round)) return `${round}회는 이미 들어 있습니다.`;
  if (numbers.length !== 6) return `번호를 6개 골라 주세요 (현재 ${numbers.length}개).`;
  if (new Set(numbers).size !== 6) return "같은 번호가 중복됐습니다.";
  if (numbers.some((n) => n < 1 || n > 45)) return "번호는 1~45 사이여야 합니다.";
  if (bonus !== null) {
    if (bonus < 1 || bonus > 45) return "보너스 번호는 1~45 사이여야 합니다.";
    if (numbers.includes(bonus)) return "보너스 번호가 본번호와 겹칩니다.";
  }
  return null;
}
