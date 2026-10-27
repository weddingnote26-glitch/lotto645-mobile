// 엑셀 없이 최신 회차 한 줄을 직접 넣는 카드.
//
// 매주 늘어나는 건 숫자 7개뿐이라, 엑셀을 내려받아 첨부하는 대신
//   ① 번호판에서 탭하거나
//   ② 어디서든 복사해 붙여넣거나
// 둘 중 편한 쪽으로 끝낼 수 있게 한다.
//
// 보너스 번호는 분석에서 제외되므로(본번호 6개만 씀) 입력하지 않아도 된다.

import { useState } from "react";

import { parseDrawText, validateDrawInput } from "../core/drawInput";
import { useAppState } from "../state/AppState";
import type { ShowToast } from "../types/toast";
import { BallRow } from "./Ball";
import { NumberPad } from "./NumberPad";

type Mode = "pad" | "paste";

export function AddDrawCard({ onToast }: { onToast: ShowToast }) {
  const { data, analysis, addDraw } = useAppState();
  const [mode, setMode] = useState<Mode>("pad");
  const [round, setRound] = useState<string>("");
  const [numbers, setNumbers] = useState<number[]>([]);
  const [bonus, setBonus] = useState<number[]>([]);
  const [showBonus, setShowBonus] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data || !analysis) return null;

  const suggested = analysis.latest + 1;
  const existing = new Set(data.rounds);
  const roundValue = round.trim() === "" ? suggested : Number(round);

  const parsed = mode === "paste" ? parseDrawText(text, suggested) : null;

  // 지금 저장하려는 내용
  const draft =
    mode === "pad"
      ? { round: roundValue, numbers, bonus: bonus[0] ?? null }
      : parsed && parsed.ok
        ? parsed.draw
        : null;

  const problem = draft
    ? validateDrawInput(draft.round, draft.numbers, draft.bonus, existing)
    : mode === "paste" && parsed && !parsed.ok
      ? parsed.error
      : "번호를 입력해 주세요.";

  const reset = () => {
    setRound("");
    setNumbers([]);
    setBonus([]);
    setText("");
    setError(null);
  };

  const onSubmit = async () => {
    if (!draft || problem) return;
    setBusy(true);
    const result = await addDraw(draft.round, draft.numbers, draft.bonus);
    setBusy(false);
    if (result.ok) {
      reset();
      onToast(result.message);
    } else {
      setError(result.message);
    }
  };

  return (
    <section className="card">
      <h2 className="card__title" style={{ marginBottom: 4 }}>
        최신 회차 직접 추가
      </h2>
      <p className="card__sub" style={{ marginBottom: 10 }}>
        엑셀 파일 없이 숫자만 넣으면 됩니다. 다음 회차는 <strong>{suggested}회</strong>입니다.
      </p>

      <div className="segment" role="group" aria-label="입력 방식" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="segment__btn"
          aria-pressed={mode === "pad"}
          onClick={() => {
            setMode("pad");
            setError(null);
          }}
        >
          번호판
        </button>
        <button
          type="button"
          className="segment__btn"
          aria-pressed={mode === "paste"}
          onClick={() => {
            setMode("paste");
            setError(null);
          }}
        >
          붙여넣기
        </button>
      </div>

      <div className="stack">
        {mode === "pad" ? (
          <>
            <div className="field">
              <label className="field__label" htmlFor="draw-round">
                회차
              </label>
              <input
                id="draw-round"
                className="select"
                type="number"
                inputMode="numeric"
                placeholder={String(suggested)}
                value={round}
                onChange={(e) => setRound(e.target.value)}
              />
            </div>

            <NumberPad
              selected={numbers}
              onToggle={(n) =>
                setNumbers((prev) =>
                  prev.includes(n)
                    ? prev.filter((v) => v !== n)
                    : prev.length >= 6
                      ? prev
                      : [...prev, n].sort((a, b) => a - b),
                )
              }
              max={6}
              title="당첨번호 6개"
            />

            <label className="toggle">
              <span>
                <span className="toggle__text">보너스 번호 입력</span>
                <br />
                <span className="faint">분석에는 쓰지 않으므로 건너뛰어도 됩니다.</span>
              </span>
              <input
                type="checkbox"
                checked={showBonus}
                onChange={(e) => {
                  setShowBonus(e.target.checked);
                  if (!e.target.checked) setBonus([]);
                }}
              />
            </label>

            {showBonus ? (
              <NumberPad
                selected={bonus}
                onToggle={(n) => setBonus((prev) => (prev.includes(n) ? [] : [n]))}
                max={1}
                title="보너스 번호 1개"
              />
            ) : null}
          </>
        ) : (
          <>
            <div className="field">
              <label className="field__label" htmlFor="draw-text">
                당첨번호를 복사해 붙여넣으세요
              </label>
              <textarea
                id="draw-text"
                className="textarea"
                rows={4}
                placeholder={`예) ${suggested}회 3 7 12 20 33 41 + 15`}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <p className="faint" style={{ margin: 0 }}>
              회차·금액·날짜가 섞여 있어도 숫자만 알아서 골라냅니다. 회차가 없으면{" "}
              {suggested}회로 넣습니다.
            </p>
          </>
        )}

        {/* 저장 전 미리보기 */}
        {draft && draft.numbers.length === 6 ? (
          <div className="picked">
            <span className="picked__label nums">{draft.round}회</span>
            <BallRow numbers={draft.numbers} size="sm" />
            {draft.bonus !== null ? (
              <span className="faint nums">보너스 {draft.bonus}</span>
            ) : null}
          </div>
        ) : null}

        {problem && (mode === "pad" ? numbers.length > 0 : text.trim() !== "") ? (
          <div className="notice notice--warn">{problem}</div>
        ) : null}
        {error ? <div className="notice notice--warn">{error}</div> : null}

        <button
          type="button"
          className="btn btn--primary btn--cta"
          disabled={busy || !draft || !!problem}
          onClick={onSubmit}
        >
          {busy ? "추가하는 중…" : draft && !problem ? `${draft.round}회 추가하기` : "번호를 입력하세요"}
        </button>
      </div>
    </section>
  );
}
