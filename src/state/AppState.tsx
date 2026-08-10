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
import { selectCoreNumber, type SelectionResult } from "../core/numberSelector";
import type { Analysis, LottoData } from "../core/types";
import { DataError } from "../core/validators";
import { decodeSeedRows, SEED_LATEST_ROUND } from "../data/seedDraws";
import {
  clearDataset,
  DEFAULT_SETTINGS,
  loadSavedGames,
  loadSettings,
  loadStoredDataset,
  persistSavedGames,
  saveDataset,
  saveSettings,
  type SavedGame,
  type Settings,
} from "../storage/db";

export const SEED_SOURCE = "앱 내장 기본 데이터";

interface AppStateValue {
  ready: boolean;
  data: LottoData | null;
  analysis: Analysis | null;
  selection: SelectionResult | null;
  /** 내장 기본 데이터를 쓰는 중이면 true */
  usingSeed: boolean;
  dataSavedAt: string | null;
  warnings: string[];
  settings: Settings;
  savedGames: SavedGame[];
  /** 방금 생성한 게임들. 탭을 옮겨도 유지되도록 여기에 둔다. */
  games: number[][];
  gamesMode: string;
  setGeneratedGames: (games: number[][], mode: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** 사용자가 고른 엑셀로 교체. 성공하면 안내 문구를 반환. */
  updateFromFile: (file: File) => Promise<{ ok: boolean; message: string }>;
  resetToSeed: () => Promise<void>;
  addSavedGames: (games: number[][], mode: string) => Promise<number>;
  removeSavedGame: (id: string) => Promise<void>;
  clearSavedGames: () => Promise<void>;
  dismissWarnings: () => void;
}

const Ctx = createContext<AppStateValue | null>(null);

function seedLottoData(): LottoData {
  return buildLottoData(decodeSeedRows(), SEED_SOURCE);
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<LottoData | null>(null);
  const [usingSeed, setUsingSeed] = useState(true);
  const [dataSavedAt, setDataSavedAt] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [games, setGames] = useState<number[][]>([]);
  const [gamesMode, setGamesMode] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setSettings(loadSettings());
      const [stored, games] = await Promise.all([loadStoredDataset(), loadSavedGames()]);
      if (!alive) return;
      setSavedGames(games);
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

  const setGeneratedGames = useCallback((next: number[][], mode: string) => {
    setGames(next);
    setGamesMode(mode);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

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
      setGamesMode("");
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
    setGamesMode("");
  }, []);

  const addSavedGames = useCallback(
    async (games: number[][], mode: string) => {
      if (!analysis) return 0;
      const savedAt = new Date().toISOString();
      const entries: SavedGame[] = games.map((numbers) => ({
        id: makeId(),
        numbers,
        baseRound: analysis.latest,
        mode,
        savedAt,
      }));
      const next = [...entries, ...savedGames];
      setSavedGames(next);
      await persistSavedGames(next);
      return entries.length;
    },
    [analysis, savedGames],
  );

  const removeSavedGame = useCallback(
    async (id: string) => {
      const next = savedGames.filter((g) => g.id !== id);
      setSavedGames(next);
      await persistSavedGames(next);
    },
    [savedGames],
  );

  const clearSavedGames = useCallback(async () => {
    setSavedGames([]);
    await persistSavedGames([]);
  }, []);

  const dismissWarnings = useCallback(() => setWarnings([]), []);

  const value: AppStateValue = {
    ready,
    data,
    analysis,
    selection,
    usingSeed,
    dataSavedAt,
    warnings,
    settings,
    savedGames,
    games,
    gamesMode,
    setGeneratedGames,
    updateSettings,
    updateFromFile,
    resetToSeed,
    addSavedGames,
    removeSavedGame,
    clearSavedGames,
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
