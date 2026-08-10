// 난수원. PC 버전은 파이썬 random 모듈을 그대로 썼고, 여기서는 같은 역할을
// 하는 얇은 래퍼를 둔다. 테스트에서는 시드 고정 rng를 끼워 결정론적으로 검증한다.

import type { Rng } from "./types";

export function makeRng(randomFn: () => number): Rng {
  return {
    random: randomFn,
    choice<T>(seq: T[]): T {
      return seq[Math.floor(randomFn() * seq.length)];
    },
    /** 서로 다른 k개 추출 (부분 Fisher-Yates). PC: random.sample */
    sample<T>(pool: T[], k: number): T[] {
      const arr = [...pool];
      const n = Math.min(k, arr.length);
      for (let i = 0; i < n; i += 1) {
        const j = i + Math.floor(randomFn() * (arr.length - i));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr.slice(0, n);
    },
  };
}

/** 고정 시드 없는 기본 난수원 (실사용). */
export const defaultRng: Rng = makeRng(Math.random);

/** 테스트용 시드 고정 난수원 (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return makeRng(() => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}
