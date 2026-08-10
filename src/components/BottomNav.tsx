// 하단 고정 내비게이션. iOS 홈 인디케이터를 피하도록 safe-area를 반영했고,
// 각 버튼의 터치 영역은 62px로 권장치(44px)보다 넉넉하게 잡았다.

import type { TabKey } from "../types/nav";

// 실제 사용 흐름(추천 확인 → 번호 생성 → 저장 → 내번호 확인) 순서로 배치한다.
// 아이콘은 컬러 이모지를 쓴다. 단색 기호보다 작은 화면에서 구분이 훨씬 빠르다.
const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "홈", icon: "🏠" },
  { key: "generate", label: "번호생성", icon: "🎲" },
  { key: "ticket", label: "내번호", icon: "🎫" },
  { key: "stats", label: "통계", icon: "📊" },
  { key: "settings", label: "설정", icon: "⚙️" },
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
