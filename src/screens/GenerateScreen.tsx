// 번호 생성 탭. 홈과 같은 생성기를 쓰고, 아래에 내 번호 A~E 칸을 붙였다.

import { Ball } from "../components/Ball";
import { Generator } from "../components/Generator";
import { MyTicketCard } from "../components/MyTicket";
import { useAppState } from "../state/AppState";

export function GenerateScreen({ onToast }: { onToast: (msg: string) => void }) {
  const { analysis, selection } = useAppState();

  if (!analysis || !selection) return null;

  return (
    <div className="screen">
      <section className="card">
        <div className="row row--between">
          <div>
            <h2 className="card__title">핵심 추천번호</h2>
            <p className="card__sub nums">{analysis.latest}회 기준</p>
          </div>
          <Ball n={selection.number} size="md" />
        </div>
      </section>

      <Generator onToast={onToast} />

      <MyTicketCard onToast={onToast} />

      <p className="disclaimer">
        생성된 번호는 과거 데이터 기반의 통계 추천일 뿐, 당첨을 예측하거나 보장하지 않습니다.
      </p>
    </div>
  );
}
