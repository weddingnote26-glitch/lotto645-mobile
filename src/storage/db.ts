// 브라우저 내부 저장소. 서버·계정·외부 전송 없음.
//
// - 당첨번호 데이터와 저장한 번호: IndexedDB (용량이 크고 영구적)
// - 화면 설정값(추첨 방식 등): localStorage (작고 동기 접근이 편함)
//
// IndexedDB를 못 쓰는 환경(사생활 보호 모드 등)에서는 조용히 localStorage로
// 물러난다. 저장이 안 되더라도 앱 기능 자체는 계속 동작해야 한다.

const DB_NAME = "lotto645";
const DB_VERSION = 1;
const STORE = "kv";
const LS_PREFIX = "lotto645:";

export interface StoredDataset {
  /** [회차, n1..n6, 보너스] */
  rows: number[][];
  source: string;
  savedAt: string;
  latest: number;
  count: number;
}

export interface SavedGame {
  id: string;
  numbers: number[];
  baseRound: number;
  mode: string;
  savedAt: string;
  memo?: string;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
  } catch {
    /* 저장소를 못 쓰는 환경 — 무시 */
  }
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* 용량 초과 등 — 무시 */
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* 무시 */
  }
}

// ---------- 당첨번호 데이터 ----------

export async function loadStoredDataset(): Promise<StoredDataset | null> {
  return (await idbGet<StoredDataset>("dataset")) ?? lsGet<StoredDataset>("dataset");
}

export async function saveDataset(dataset: StoredDataset): Promise<void> {
  const ok = await idbSet("dataset", dataset);
  // IndexedDB가 없을 때만 localStorage를 쓴다 (데이터가 커서 용량 한계에 걸릴 수 있음).
  if (!ok) lsSet("dataset", dataset);
}

export async function clearDataset(): Promise<void> {
  await idbDelete("dataset");
  lsRemove("dataset");
}

// ---------- 저장한 번호 ----------

export async function loadSavedGames(): Promise<SavedGame[]> {
  return (await idbGet<SavedGame[]>("savedGames")) ?? lsGet<SavedGame[]>("savedGames") ?? [];
}

export async function persistSavedGames(games: SavedGame[]): Promise<void> {
  const ok = await idbSet("savedGames", games);
  if (!ok) lsSet("savedGames", games);
}

// ---------- 화면 설정 ----------

export interface Settings {
  mode: "A" | "B";
  includeCore: boolean;
  gameCount: number;
}

export const DEFAULT_SETTINGS: Settings = { mode: "B", includeCore: true, gameCount: 5 };

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(lsGet<Partial<Settings>>("settings") ?? {}) };
}

export function saveSettings(settings: Settings): void {
  lsSet("settings", settings);
}
