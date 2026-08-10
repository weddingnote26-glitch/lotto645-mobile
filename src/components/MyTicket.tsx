// 내 번호 — 실제 로또 용지 한 장처럼 A~E 5칸 고정.
// 생성 결과에서 [저장]을 누르면 어느 칸에 넣을지 고르고, 차 있으면 교체된다.

import { SLOT_LABELS, type MyTicket as MyTicketType } from "../storage/db";
import { useAppState } from "../state/AppState";
import type { ShowToast } from "../types/toast";
import { copyText, shareText } from "../utils/share";
import { BallRow } from "./Ball";
import { Sheet } from "./Sheet";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ticketText(ticket: MyTicketType): string {
  const lines = ticket.map((slot, i) =>
    slot
      ? `${SLOT_LABELS[i]}. ${slot.numbers.map((n) => String(n).padStart(2, "0")).join(", ")}`
      : `${SLOT_LABELS[i]}. -`,
  );
  return ["내 번호 (로또 6/45 분석기)", ...lines].join("\n");
}

/** 홈·번호생성 탭에 함께 쓰는 '내 번호' 카드 */
export function MyTicketCard({ onToast }: { onToast: (msg: string) => void }) {
  const { ticket, clearSlot, clearTicket } = useAppState();
  const filled = ticket.filter(Boolean).length;

  const onCopy = async () => {
    onToast((await copyText(ticketText(ticket))) ? "내 번호를 복사했습니다." : "복사에 실패했습니다.");
  };

  const onShare = async () => {
    const r = await shareText(ticketText(ticket), "내 번호");
    if (r === "copied") onToast("공유를 지원하지 않아 복사했습니다.");
    else if (r === "failed") onToast("공유·복사에 실패했습니다.");
  };

  return (
    <section className="card">
      <div className="row row--between" style={{ marginBottom: 10 }}>
        <div>
          <h2 className="card__title">내 번호</h2>
          <p className="card__sub">로또 용지처럼 A~E 5칸. 이 휴대폰에만 저장됩니다.</p>
        </div>
        <span className="chip nums">{filled}/5칸</span>
      </div>

      <div className="stack">
        {ticket.map((slot, i) => (
          <div className={`slot${slot ? "" : " slot--empty"}`} key={SLOT_LABELS[i]}>
            <span className="slot__label" aria-hidden="true">
              {SLOT_LABELS[i]}
            </span>
            <div className="slot__body">
              {slot ? (
                <>
                  <BallRow numbers={slot.numbers} size="sm" />
                  <span className="faint">
                    {slot.baseRound}회 기준 · {slot.mode} · {formatDate(slot.savedAt)}
                  </span>
                </>
              ) : (
                <span className="faint">
                  비어 있음 — 생성 결과에서 [저장]을 누르면 이 칸에 넣을 수 있습니다.
                </span>
              )}
            </div>
            {slot ? (
              <button
                type="button"
                className="btn btn--ghost btn--danger slot__action"
                onClick={async () => {
                  await clearSlot(i);
                  onToast(`${SLOT_LABELS[i]}칸을 비웠습니다.`);
                }}
              >
                비우기
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {filled > 0 ? (
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn--grow" onClick={onCopy}>
            전체 복사
          </button>
          <button type="button" className="btn btn--grow" onClick={onShare}>
            공유
          </button>
          <button
            type="button"
            className="btn btn--grow btn--danger"
            onClick={async () => {
              await clearTicket();
              onToast("내 번호를 모두 비웠습니다.");
            }}
          >
            전체 비우기
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** 저장할 칸(A~E)을 고르는 바텀시트 */
export function SlotPickerSheet({
  numbers,
  mode,
  open,
  onClose,
  onToast,
  onViewTicket,
}: {
  numbers: number[] | null;
  mode: string;
  open: boolean;
  onClose: () => void;
  onToast: ShowToast;
  /** 저장 직후 '내번호 보기'로 이동시키고 싶을 때 */
  onViewTicket?: () => void;
}) {
  const { ticket, saveToSlot } = useAppState();

  if (!numbers) return null;

  const firstEmpty = ticket.findIndex((s) => s === null);

  return (
    <Sheet open={open} title="어느 칸에 저장할까요?" onClose={onClose}>
      <div className="stack" style={{ marginBottom: 12 }}>
        <BallRow numbers={numbers} size="md" />
        <p className="faint" style={{ margin: 0 }}>
          {firstEmpty === -1
            ? "5칸이 모두 차 있습니다. 교체할 칸을 고르세요."
            : `비어 있는 ${SLOT_LABELS[firstEmpty]}칸을 추천합니다.`}
        </p>
      </div>

      <div className="stack">
        {ticket.map((slot, i) => (
          <button
            type="button"
            key={SLOT_LABELS[i]}
            className={`slot slot--pick${i === firstEmpty ? " slot--suggest" : ""}`}
            onClick={async () => {
              await saveToSlot(i, numbers, mode);
              onToast(
                `내번호 ${SLOT_LABELS[i]}칸에 저장했습니다.`,
                onViewTicket ? { label: "내번호 보기", onClick: onViewTicket } : undefined,
              );
              onClose();
            }}
          >
            <span className="slot__label" aria-hidden="true">
              {SLOT_LABELS[i]}
            </span>
            <span className="slot__body">
              {slot ? (
                <>
                  <BallRow numbers={slot.numbers} size="sm" />
                  <span className="faint">누르면 이 번호로 교체됩니다.</span>
                </>
              ) : (
                <span className="faint">비어 있음 — 여기에 저장</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
