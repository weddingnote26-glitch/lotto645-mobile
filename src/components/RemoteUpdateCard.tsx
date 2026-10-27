// 공개 미러에서 최신 회차를 받아오는 카드.
//
// 받아온 내용을 바로 저장하지 않고, 무엇이 들어올지 먼저 보여 준 뒤
// 사용자가 확인을 누를 때만 반영한다. 미러가 멈추거나 값이 이상할 수 있어서다.

import { useState } from "react";

import {
  checkForUpdates,
  MIRROR_NAME,
  MIRROR_URL,
  type RemoteDraw,
} from "../core/remoteUpdate";
import { useAppState } from "../state/AppState";
import type { ShowToast } from "../types/toast";
import { BallRow } from "./Ball";

type Phase = "idle" | "checking" | "found" | "upToDate" | "error" | "saving";

export function RemoteUpdateCard({ onToast }: { onToast: ShowToast }) {
  const { data, analysis, addDraws } = useAppState();
  const [phase, setPhase] = useState<Phase>("idle");
  const [found, setFound] = useState<RemoteDraw[]>([]);
  const [remoteLatest, setRemoteLatest] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data || !analysis) return null;

  const onCheck = async () => {
    setPhase("checking");
    setError(null);
    const result = await checkForUpdates(data.rounds);
    if (!result.ok) {
      setError(result.error);
      setPhase("error");
      return;
    }
    setRemoteLatest(result.latestRemote);
    if (result.newDraws.length === 0) {
      setPhase("upToDate");
      return;
    }
    setFound(result.newDraws);
    setPhase("found");
  };

  const onApply = async () => {
    setPhase("saving");
    const result = await addDraws(
      found.map((d) => ({ round: d.round, numbers: d.numbers, bonus: d.bonus })),
      `${MIRROR_NAME} 미러`,
    );
    if (result.ok) {
      setFound([]);
      setPhase("upToDate");
      onToast(result.message);
    } else {
      setError(result.message);
      setPhase("error");
    }
  };

  return (
    <section className="card">
      <h2 className="card__title" style={{ marginBottom: 4 }}>
        최신 회차 자동 확인
      </h2>
      <p className="card__sub" style={{ marginBottom: 10 }}>
        공개된 회차 데이터를 조회해 빠진 회차를 찾아 줍니다. 현재 기준은{" "}
        <strong>{analysis.latest}회</strong>입니다.
      </p>

      <button
        type="button"
        className="btn btn--primary btn--cta"
        disabled={phase === "checking" || phase === "saving"}
        onClick={onCheck}
      >
        {phase === "checking" ? "확인하는 중…" : "최신 회차 확인"}
      </button>

      {phase === "upToDate" ? (
        <div className="notice notice--info" style={{ marginTop: 12 }}>
          이미 최신입니다
          {remoteLatest !== null ? ` (공개 데이터도 ${remoteLatest}회까지)` : ""}.
        </div>
      ) : null}

      {phase === "error" && error ? (
        <>
          <div className="notice notice--warn" style={{ marginTop: 12 }}>
            {error}
          </div>
          <p className="faint" style={{ marginTop: 8, marginBottom: 0 }}>
            아래 “최신 회차 직접 추가”로 손수 넣으실 수 있습니다.
          </p>
        </>
      ) : null}

      {phase === "found" || phase === "saving" ? (
        <>
          <div className="row row--between" style={{ marginTop: 14, marginBottom: 8 }}>
            <span className="field__label">새로 추가할 회차 {found.length}개</span>
            <span className="chip chip--accent nums">
              {analysis.latest} → {remoteLatest}회
            </span>
          </div>

          <div className="stack">
            {found.map((d) => (
              <div className="picked" key={d.round}>
                <span className="picked__label nums">{d.round}회</span>
                <BallRow numbers={d.numbers} size="sm" />
                {d.bonus !== null ? (
                  <span className="faint nums">보너스 {d.bonus}</span>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn--primary btn--cta"
            style={{ marginTop: 12 }}
            disabled={phase === "saving"}
            onClick={onApply}
          >
            {phase === "saving" ? "반영하는 중…" : `${found.length}개 회차 추가하기`}
          </button>
          <button
            type="button"
            className="btn"
            style={{ marginTop: 8, width: "100%" }}
            disabled={phase === "saving"}
            onClick={() => {
              setFound([]);
              setPhase("idle");
            }}
          >
            취소
          </button>
        </>
      ) : null}

      <div className="notice notice--warn" style={{ marginTop: 12 }}>
        출처는 개인이 운영하는 비공식 공개 저장소(
        <a href={MIRROR_URL} target="_blank" rel="noreferrer">
          {MIRROR_NAME}
        </a>
        )입니다. 제1~{analysis.latest}회를 대조해 한 건도 어긋나지 않는 것을 확인했지만, 갱신이
        늦거나 멈출 수 있습니다. 중요한 번호는 동행복권에서 다시 확인해 주세요.
      </div>
    </section>
  );
}
