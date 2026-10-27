import { useCallback, useEffect, useRef, useState } from "react";

import { BottomNav } from "./components/BottomNav";
import { GenerateScreen } from "./screens/GenerateScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { TicketScreen } from "./screens/TicketScreen";
import { AppStateProvider, useAppState } from "./state/AppState";
import type { TabKey } from "./types/nav";
import type { ToastAction } from "./types/toast";

const TITLES: Record<TabKey, string> = {
  home: "로또 6/45 분석기",
  generate: "번호 생성",
  ticket: "내 번호",
  stats: "상세 통계",
  settings: "설정",
};

function Shell() {
  const { ready, analysis } = useAppState();
  const [tab, setTab] = useState<TabKey>("home");
  const [toast, setToast] = useState<{ msg: string; action?: ToastAction } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string, action?: ToastAction) => {
    setToast({ msg, action });
    window.clearTimeout(toastTimer.current);
    // 바로가기가 있으면 누를 시간을 조금 더 준다.
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 4200 : 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const navigate = useCallback((next: TabKey) => {
    setTab(next);
    setToast(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <>
      <main className="app">
        <header className="appbar">
          <h1 className="appbar__title">{TITLES[tab]}</h1>
          {analysis ? <span className="appbar__meta nums">{analysis.latest}회 기준</span> : null}
        </header>

        {!ready ? (
          <p className="muted">데이터를 불러오는 중…</p>
        ) : (
          <>
            {tab === "home" ? <HomeScreen onToast={showToast} onNavigate={navigate} /> : null}
            {tab === "generate" ? (
              <GenerateScreen onToast={showToast} onNavigate={navigate} />
            ) : null}
            {tab === "ticket" ? (
              <TicketScreen onToast={showToast} onNavigate={navigate} />
            ) : null}
            {tab === "stats" ? <StatsScreen onNavigate={navigate} /> : null}
            {tab === "settings" ? <SettingsScreen onToast={showToast} /> : null}
          </>
        )}
      </main>

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast.msg}</span>
          {toast.action ? (
            <button type="button" className="toast__action" onClick={toast.action.onClick}>
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}

      <BottomNav current={tab} onChange={navigate} />
    </>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
