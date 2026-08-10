// 앱 전역 상태. 서버가 없으므로 '데이터 불러오기 → 분석 → 화면'이 전부다.
//
// 데이터 우선순위:
//   1) 사용자가 업로드해 브라우저에 저장해 둔 엑셀 데이터
//   2) 없으면 앱에 내장된 기본 데이터 (제1~1236회)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { analyze } from "../core/analyzer";
import { buildLottoData, loadLottoFile, serializeLottoData } from "../core/excelLoader";
import {
  rankRecommendedNumbers,
  selectCoreNumber,
  type RankedNumber,
  type SelectionResult,
} from "../core/numberSelector";
import { analyzeParity, type ParityProfile } from "../core/parityAnalyzer";
import {
  analyzePatterns,
  patternBands,
  type PatternBands,
  type PatternStats,
} from "../core/patternAnalyzer";
import type { Analysis, LottoData } from "../core/types";
import { DataError } from "../core/validators";
import { decodeSeedRows, SEED_LATEST_ROUND } from "../data/seedDraws";
import {
  clearDataset,
  DEFAULT_SETTINGS,
  emptyTicket,
  loadMyTicket,
  loadSettings,
  loadStoredDataset,
  persistMyTicket,
  saveDataset,
  saveSettings,
  type MyTicket,
  type Settings,
} from "../storage/db";

export const SEED_SOURCE = "앱 내장 기본 데이터";

/** 화면에 보여줄 생성 결과 한 게임. 게임마다 어떤 방식으로 뽑았는지 함께 들고 있는다. */
export interface GeneratedGame {
  numbers: number[];
  mode: string;
}

interface AppStateValue {
  ready: boolean;
  data: LottoData | null;
  analysis: Analysis | null;
  selection: SelectionResult | null;
  /** 1~6순위 추천번호. 1순위는 selection.number와 항상 같다. */
  ranked: RankedNumber[];
  /** 내장 기본 데이터를 쓰는 중이면 true */
  usingSeed: boolean;
  dataSavedAt: string | null;
  warnings: string[];
  settings: Settings;
  /** 당첨 조합의 형태 패턴 통계 */
  patterns: PatternStats | null;
  /** 패턴 기반 생성이 쓰는 기준값 */
  bands: PatternBands | null;
  /** 최근 5·10회 홀짝 분포 (생성 시 목표 홀짝의 근거) */
  parity: ParityProfile | null;
  /** 내 번호 A~E 5칸 (비어 있으면 null) */
  ticket: MyTicket;
  /** 방금 생성한 게임들. 탭을 옮겨도 유지되도록 여기에 둔다. */
  games: GeneratedGame[];
  /** 결과 목록을 통째로 교체 (자동·반자동 생성) */
  setGeneratedGames: (numbers: number[][], mode: string) => void;
  /** 결과 목록 맨 앞에 한 게임 추가 (수동 입력) */
  addGeneratedGame: (numbers: number[], mode: string) => void;
  clearGeneratedGames: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** 고정번호 편집 — 6개를 넘기면 무시된다. */
  setFixedNumbers: (numbers: number[]) => void;
  /** 사용자가 고른 엑셀로 교체. 성공하면 안내 문구를 반환. */
  updateFromFile: (file: File) => Promise<{ ok: boolean; message: string }>;
  resetToSeed: () => Promise<void>;
  /** 지정한 칸(0~4)에 6개 번호를 저장. 이미 차 있으면 교체된다. */
  saveToSlot: (index: number, numbers: number[], mode: string) => Promise<void>;
  clearSlot: (index: number) => Promise<void>;
  clearTicket: () => Promise<void>;
  dismissWarnings: () => void;
}

const Ctx = createContext<AppStateValue | null>(null);

function seedLottoData(): LottoData {
  return buildLottoData(decodeSeedRows(), SEED_SOURCE);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<LottoData | null>(null);
  const [usingSeed, setUsingSeed] = useState(true);
  const [dataSavedAt, setDataSavedAt] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ticket, setTicket] = useState<MyTicket>(emptyTicket);
  const [games, setGames] = useState<GeneratedGame[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setSettings(loadSettings());
      const [stored, savedTicket] = await Promise.all([loadStoredDataset(), loadMyTicket()]);
      if (!alive) return;
      setTicket(savedTicket);
      if (stored && stored.rows.length > 0) {
        setData(buildLottoData(stored.rows, stored.source));
        setUsingSeed(false);
        setDataSavedAt(stored.savedAt);
      } else {
        setData(seedLottoData());
        setUsingSeed(true);
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const analysis = useMemo(() => (data ? analyze(data) : null), [data]);

  // 분석 결과가 바뀔 때만 다시 뽑는다. 규칙이 고정돼 있어 같은 데이터면 같은 번호가 나오고,
  // 완전 동률일 때만 무작위가 개입하므로 화면이 리렌더될 때마다 흔들리지 않도록 고정한다.
  const selection = useMemo(() => (analysis ? selectCoreNumber(analysis) : null), [analysis]);

  // 1~6순위. 같은 규칙을 후보만 줄여 가며 다시 돌린 결과라 1순위는 selection과 같다.
  const ranked = useMemo(() => (analysis ? rankRecommendedNumbers(analysis, 6) : []), [analysis]);

  // 전체 회차를 훑는 계산이라 데이터가 바뀔 때만 다시 돌린다.
  const patterns = useMemo(() => (data ? analyzePatterns(data) : null), [data]);
  const bands = useMemo(() => (patterns ? patternBands(patterns) : null), [patterns]);

  // 최근 5·10회의 실제 홀짝 분포. 데이터가 바뀌면 함께 다시 계산된다.
  const parity = useMemo(() => (analysis ? analyzeParity(analysis) : null), [analysis]);

  const setGeneratedGames = useCallback((numbers: number[][], mode: string) => {
    setGames(numbers.map((n) => ({ numbers: n, mode })));
  }, []);

  const addGeneratedGame = useCallback((numbers: number[], mode: string) => {
    setGames((prev) => [{ numbers: [...numbers].sort((a, b) => a - b), mode }, ...prev]);
  }, []);

  const clearGeneratedGames = useCallback(() => setGames([]), []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const setFixedNumbers = useCallback(
    (numbers: number[]) => {
      const clean = [...new Set(numbers)]
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 45)
        .sort((a, b) => a - b);
      if (clean.length > 6) return;
      updateSettings({ fixedNumbers: clean });
    },
    [updateSettings],
  );

  const updateFromFile = useCallback(async (file: File) => {
    try {
      const loaded = await loadLottoFile(file);
      const rows = serializeLottoData(loaded);
      const savedAt = new Date().toISOString();
      await saveDataset({
        rows,
        source: file.name,
        savedAt,
        latest: loaded.rounds[loaded.rounds.length - 1],
        count: loaded.rounds.length,
      });
      setData(loaded);
      setUsingSeed(false);
      setDataSavedAt(savedAt);
      setWarnings(loaded.warnings);
      // 기준 회차가 바뀌었으니 이전 결과는 지운다.
      setGames([]);
      return {
        ok: true,
        message: `${loaded.rounds[loaded.rounds.length - 1]}회까지 ${loaded.rounds.length}개 회차를 불러왔습니다.`,
      };
    } catch (e) {
      const message =
        e instanceof DataError
          ? e.message
          : `엑셀을 읽지 못했습니다: ${(e as Error).message ?? "알 수 없는 오류"}`;
      return { ok: false, message };
    }
  }, []);

  const resetToSeed = useCallback(async () => {
    await clearDataset();
    setData(seedLottoData());
    setUsingSeed(true);
    setDataSavedAt(null);
    setWarnings([]);
    setGames([]);
  }, []);

  const saveToSlot = useCallback(
    async (index: number, numbers: number[], mode: string) => {
      if (!analysis) return;
      const next = [...ticket];
      next[index] = {
        numbers: [...numbers].sort((a, b) => a - b),
        baseRound: analysis.latest,
        mode,
        savedAt: new Date().toISOString(),
      };
      setTicket(next);
      await persistMyTicket(next);
    },
    [analysis, ticket],
  );

  const clearSlot = useCallback(
    async (index: number) => {
      const next = [...ticket];
      next[index] = null;
      setTicket(next);
      await persistMyTicket(next);
    },
    [ticket],
  );

  const clearTicket = useCallback(async () => {
    const next = emptyTicket();
    setTicket(next);
    await persistMyTicket(next);
  }, []);

  const dismissWarnings = useCallback(() => setWarnings([]), []);

  const value: AppStateValue = {
    ready,
    data,
    analysis,
    selection,
    ranked,
    usingSeed,
    dataSavedAt,
    warnings,
    settings,
    patterns,
    bands,
    parity,
    ticket,
    games,
    setGeneratedGames,
    addGeneratedGame,
    clearGeneratedGames,
    updateSettings,
    setFixedNumbers,
    updateFromFile,
    resetToSeed,
    saveToSlot,
    clearSlot,
    clearTicket,
    dismissWarnings,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppStateProvider 안에서만 사용할 수 있습니다.");
  return v;
}

export { SEED_LATEST_ROUND };
