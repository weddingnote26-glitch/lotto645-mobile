// 복사 / 공유 유틸.
//
// Clipboard API와 Web Share API는 둘 다 '보안 컨텍스트'(https 또는 localhost)에서만
// 동작한다. 같은 Wi-Fi에서 http://192.168.x.x:5173 으로 테스트할 때는 없을 수 있어
// 예전 방식(execCommand)까지 단계적으로 물러난다.

export function formatGamesText(games: number[][], baseRound: number, mode: string): string {
  const lines = games.map(
    (g, i) => `게임${i + 1}: ${g.map((n) => String(n).padStart(2, "0")).join(", ")}`,
  );
  return [`로또 6/45 분석기 — ${baseRound}회 기준 (${mode})`, ...lines].join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 대체 방식으로 진행 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** 공유 시트를 열고, 지원하지 않으면 복사로 대체한다. */
export async function shareText(text: string, title: string): Promise<ShareOutcome> {
  if (canShare()) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      // 사용자가 공유 시트를 닫은 경우는 오류가 아니다.
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  return (await copyText(text)) ? "copied" : "failed";
}
