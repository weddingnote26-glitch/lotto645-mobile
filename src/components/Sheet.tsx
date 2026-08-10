// 바텀 시트. 선정 과정·상세 보기처럼 '잠깐 펼쳐 보는' 내용에 쓴다.
// 배경을 누르거나 ESC로 닫히고, 열려 있는 동안 뒤쪽 스크롤을 막는다.

import { useEffect, useRef, type ReactNode } from "react";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="sheet__grip" />
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
