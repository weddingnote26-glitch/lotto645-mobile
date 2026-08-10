// 하단 고정 내비게이션. iOS 홈 인디케이터를 피하도록 safe-area를 반영했고,
// 각 버튼의 터치 영역은 62px로 권장치(44px)보다 넉넉하게 잡았다.

import type { TabKey } from "../types/nav";

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "홈", icon: "◆" },
  { key: "stats", label: "통계", icon: "▦" },
  { key: "generate", label: "번호생성", icon: "⬤" },
  { key: "settings", label: "설정", icon: "⚙" },
];

export function BottomNav({
  current,
  onChange,
}: {
  current: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <nav className="nav" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className="nav__btn"
          aria-current={current === t.key ? "page" : undefined}
          onClick={() => onChange(t.key)}
        >
          <span className="nav__icon" aria-hidden="true">
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
