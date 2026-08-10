// 공통 타입 정의.
// PC 버전(core/data_loader.py, core/analyzer.py)의 dataclass를 그대로 옮긴 형태다.

/** 회차별 당첨번호 묶음. PC: core.data_loader.LottoData */
export interface LottoData {
  /** 회차 -> 본번호 6개 (오름차순) */
  draws: Map<number, number[]>;
  /** 회차 -> 보너스 번호 (없으면 null) */
  bonus: Map<number, number | null>;
  /** 회차 오름차순 목록 */
  rounds: number[];
  source: string;
  warnings: string[];
}

/** 회차 '숫자' 기준 최신 n개 (오름차순). PC: LottoData.recent_rounds */
export function recentRounds(data: LottoData, n: number): number[] {
  return n >= data.rounds.length ? data.rounds.slice() : data.rounds.slice(data.rounds.length - n);
}

export function latestRound(data: LottoData): number {
  return data.rounds[data.rounds.length - 1];
}

/** PC: core.analyzer.NumberStats */
export interface NumberStats {
  number: number;
  cnt5: number;
  cnt10: number;
  cntTotal: number;
  /** 마지막 출현 회차 (한 번도 없으면 null) */
  lastRound: number | null;
  /** 최신 회차 기준 미출현 간격 (최신 회차 출현 = 0) */
  gap: number;
  /** 직전(최신) 회차 출현 여부 */
  inPrev: boolean;
  in5: boolean;
  in10: boolean;
  odd: boolean;
  zone10: number;
  zone15: number;
  /** 출현한 회차 전체 (오름차순) */
  appearances: number[];
}

/** PC: core.analyzer.WindowSummary */
export interface WindowSummary {
  rounds: number[];
  totalBalls: number;
  odd: number;
  even: number;
  zone10Counts: number[];
  /** 구간 크기 보정 출현률 */
  zone10Rates: number[];
  zone10Levels: string[];
  zone15Counts: number[];
  zone15Ratios: number[];
  oddRatio: number;
  evenRatio: number;
}

/** PC: core.analyzer.Analysis */
export interface Analysis {
  data: LottoData;
  latest: number;
  /** 1~45 번호별 통계 (인덱스 = 번호) */
  stats: Record<number, NumberStats>;
  win5: WindowSummary;
  win10: WindowSummary;
}

/** 난수원. 테스트에서 결정론적으로 바꿔 끼울 수 있도록 분리. PC: rng 인자 */
export interface Rng {
  /** 0 이상 1 미만 */
  random(): number;
  /** 배열에서 하나 선택. PC: random.choice */
  choice<T>(seq: T[]): T;
  /** 서로 다른 k개 추출. PC: random.sample */
  sample<T>(pool: T[], k: number): T[];
}
