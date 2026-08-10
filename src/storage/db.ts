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

/** 실제 로또 용지 한 장처럼 A~E 5칸을 쓴다. */
export const SLOT_LABELS = ["A", "B", "C", "D", "E"] as const;
export const SLOT_COUNT = SLOT_LABELS.length;

export interface TicketSlot {
  numbers: number[];
  /** 저장 당시 기준 회차 */
  baseRound: number;
  /** 어떤 방식으로 뽑은 번호인지 */
  mode: string;
  savedAt: string;
}

/** 길이 5 고정. 비어 있는 칸은 null. */
export type MyTicket = Array<TicketSlot | null>;

export function emptyTicket(): MyTicket {
  return new Array<TicketSlot | null>(SLOT_COUNT).fill(null);
}

/** 저장된 값이 손상됐거나 길이가 달라도 항상 5칸으로 맞춘다. */
function normalizeTicket(raw: unknown): MyTicket {
  const ticket = emptyTicket();
  if (!Array.isArray(raw)) return ticket;
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const slot = raw[i] as TicketSlot | null | undefined;
    if (
      slot &&
      Array.isArray(slot.numbers) &&
      slot.numbers.length === 6 &&
      slot.numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)
    ) {
      ticket[i] = slot;
    }
  }
  return ticket;
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

// ---------- 내 번호 (A~E 5칸) ----------

export async function loadMyTicket(): Promise<MyTicket> {
  const raw = (await idbGet<unknown>("myTicket")) ?? lsGet<unknown>("myTicket");
  return normalizeTicket(raw);
}

export async function persistMyTicket(ticket: MyTicket): Promise<void> {
  const ok = await idbSet("myTicket", ticket);
  if (!ok) lsSet("myTicket", ticket);
}

// ---------- 화면 설정 ----------

export interface Settings {
  /** A=완전 랜덤, B=분석 기반 균형, C=패턴 기반 */
  mode: "A" | "B" | "C";
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
