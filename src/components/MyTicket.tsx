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
            {/* 윗줄: 칸 이름 + 번호 6개 (항상 한 줄) */}
            <div className="slot__top">
              <span className="slot__label" aria-hidden="true">
                {SLOT_LABELS[i]}
              </span>
              {slot ? (
                <BallRow numbers={slot.numbers} size="fit" />
              ) : (
                <span className="faint">
                  비어 있음 — 생성 결과에서 [저장]을 누르면 이 칸에 넣을 수 있습니다.
                </span>
              )}
            </div>

            {/* 아랫줄: 저장 정보 + 비우기 */}
            {slot ? (
              <div className="slot__meta">
                <span className="faint">
                  {slot.baseRound}회 기준 · {slot.mode} · {formatDate(slot.savedAt)}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--danger"
                  onClick={async () => {
                    await clearSlot(i);
                    onToast(`${SLOT_LABELS[i]}칸을 비웠습니다.`);
                  }}
                >
                  비우기
                </button>
              </div>
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

/** 어느 게임이 어느 칸에 들어갈지 */
export interface SlotAssignment {
  index: number;
  numbers: number[];
  mode: string;
  /** 교체되는 기존 번호 (빈 칸이면 null) */
  replaces: number[] | null;
}

/**
 * 고른 게임들을 A~E 칸에 어떻게 넣을지 정한다.
 * 빈 칸을 먼저 채우고, 모자라면 앞 칸부터 교체한다.
 */
export function planAssignment(
  ticket: MyTicketType,
  picks: Array<{ numbers: number[]; mode: string }>,
): SlotAssignment[] {
  const empty: number[] = [];
  const filled: number[] = [];
  ticket.forEach((s, i) => (s === null ? empty.push(i) : filled.push(i)));
  const order = [...empty, ...filled];

  return picks.slice(0, order.length).map((p, k) => ({
    index: order[k],
    numbers: p.numbers,
    mode: p.mode,
    replaces: ticket[order[k]]?.numbers ?? null,
  }));
}

/** 저장 전에 어떤 칸에 들어가는지 보여 주고 확인받는 바텀시트 */
export function SaveConfirmSheet({
  plan,
  open,
  onClose,
  onToast,
  onViewTicket,
}: {
  plan: SlotAssignment[] | null;
  open: boolean;
  onClose: () => void;
  onToast: ShowToast;
  /** 저장 직후 '내번호 보기'로 이동시키고 싶을 때 */
  onViewTicket?: () => void;
}) {
  const { saveToSlots } = useAppState();

  if (!plan || plan.length === 0) return null;

  const replaced = plan.filter((a) => a.replaces !== null).length;

  return (
    <Sheet open={open} title="내번호에 저장" onClose={onClose}>
      <p className="card__sub" style={{ marginBottom: 12 }}>
        {plan.length}게임을 아래 칸에 저장합니다.
        {replaced > 0 ? ` 이미 번호가 있는 ${replaced}칸은 교체됩니다.` : ""}
      </p>

      <div className="stack" style={{ marginBottom: 14 }}>
        {plan.map((a) => (
          <div className={`slot${a.replaces ? " slot--replace" : ""}`} key={a.index}>
            <div className="slot__top">
              <span className="slot__label" aria-hidden="true">
                {SLOT_LABELS[a.index]}
              </span>
              <BallRow numbers={a.numbers} size="fit" />
            </div>
            <span className="faint">
              {a.replaces
                ? `기존 ${a.replaces.map((n) => String(n).padStart(2, "0")).join(", ")} 을(를) 교체`
                : "비어 있던 칸"}
            </span>
          </div>
        ))}
      </div>

      <div className="row">
        <button type="button" className="btn btn--grow" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="btn btn--primary btn--grow"
          onClick={async () => {
            await saveToSlots(plan);
            onToast(
              `${plan.length}게임을 내번호에 저장했습니다.`,
              onViewTicket ? { label: "내번호 보기", onClick: onViewTicket } : undefined,
            );
            onClose();
          }}
        >
          저장
        </button>
      </div>
    </Sheet>
  );
}
