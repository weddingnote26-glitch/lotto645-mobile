// 번호생성 탭. 화면 구성은 Generator가 순서대로 담당한다.
//   ① 핵심 추천번호 → ② 상위 추천번호 5개 → ③ 자동/반자동/수동
//   → ④ 생성 설정 → ⑤ 생성 버튼 → ⑥ 바로 아래 결과

import { Generator } from "../components/Generator";
import type { TabKey } from "../types/nav";
import type { ShowToast } from "../types/toast";

export function GenerateScreen({
  onToast,
  onNavigate,
}: {
  onToast: ShowToast;
  onNavigate: (tab: TabKey) => void;
}) {
  return (
    <div className="screen">
      <Generator onToast={onToast} onNavigate={onNavigate} />

      <p className="disclaimer">
        생성된 번호는 과거 데이터 기반의 통계 추천일 뿐, 당첨을 예측하거나 보장하지 않습니다.
      </p>
    </div>
  );
}
