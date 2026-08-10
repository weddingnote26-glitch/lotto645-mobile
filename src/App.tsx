import { useCallback, useEffect, useRef, useState } from "react";

import { BottomNav } from "./components/BottomNav";
import { GenerateScreen } from "./screens/GenerateScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { AppStateProvider, useAppState } from "./state/AppState";
import type { TabKey } from "./types/nav";

const TITLES: Record<TabKey, string> = {
  home: "로또 6/45 분석기",
  stats: "상세 통계",
  generate: "번호 생성",
  settings: "설정",
};

function Shell() {
  const { ready, analysis } = useAppState();
  const [tab, setTab] = useState<TabKey>("home");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const navigate = useCallback((next: TabKey) => {
    setTab(next);
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
            {tab === "stats" ? <StatsScreen /> : null}
            {tab === "generate" ? <GenerateScreen onToast={showToast} /> : null}
            {tab === "settings" ? <SettingsScreen onToast={showToast} /> : null}
          </>
        )}
      </main>

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
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
