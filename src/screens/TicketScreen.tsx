// 내 번호 탭. 저장한 A~E 5칸을 보는 곳으로, 카드 내용은 기존 것을 그대로 쓴다.

import { MyTicketCard } from "../components/MyTicket";
import { useAppState } from "../state/AppState";
import type { TabKey } from "../types/nav";

export function TicketScreen({
  onToast,
  onNavigate,
}: {
  onToast: (msg: string) => void;
  onNavigate: (tab: TabKey) => void;
}) {
  const { ticket } = useAppState();
  const empty = ticket.every((s) => s === null);

  return (
    <div className="screen">
      <MyTicketCard onToast={onToast} />

      {empty ? (
        <button type="button" className="btn btn--primary btn--cta" onClick={() => onNavigate("generate")}>
          번호 만들러 가기
        </button>
      ) : (
        <button type="button" className="btn" onClick={() => onNavigate("generate")}>
          번호 더 만들기
        </button>
      )}

      <p className="disclaimer">
        저장한 번호는 이 휴대폰 안에만 보관됩니다. 로또 추첨은 매회 독립적인 무작위 추첨이며,
        저장된 번호가 당첨을 보장하지 않습니다.
      </p>
    </div>
  );
}
