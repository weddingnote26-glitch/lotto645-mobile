// 번호 생성 영역 (추첨 방식 / 추천번호 포함 / 게임 수 / 결과 / 복사·공유·저장).
// 홈 화면과 '번호생성' 탭에서 함께 쓰며, 결과는 전역 상태에 두어 탭을 옮겨도 남는다.

import { useState } from "react";

import { generateGames } from "../core/combinationGenerator";
import { combinationPattern } from "../core/patternAnalyzer";
import type { Settings } from "../storage/db";
import { useAppState } from "../state/AppState";
import { canShare, copyText, formatGamesText, shareText } from "../utils/share";
import { BallRow, ZoneLegend } from "./Ball";
import { SlotPickerSheet } from "./MyTicket";

const COUNTS = [1, 5, 10, 20];

const MODES: Array<{ key: Settings["mode"]; label: string; help: string }> = [
  {
    key: "B",
    label: "분석 기반",
    help: "홀짝 2:4~4:2(3:3 우선), 10단위 구간 3개 이상, 15단위 구간 각 1개 이상, 연속번호 1쌍 이하가 되도록 쏠림만 줄입니다.",
  },
  {
    key: "C",
    label: "패턴 기반",
    help: "지금까지 실제로 당첨된 조합에서 흔했던 모양(홀짝·합계·연속번호·구간·저고 비율)에 맞춰 뽑습니다.",
  },
  {
    key: "A",
    label: "완전 랜덤",
    help: "1~45에서 중복 없이 6개를 무작위로 뽑습니다.",
  },
];

export function modeLabel(mode: Settings["mode"]): string {
  if (mode === "A") return "완전 랜덤";
  if (mode === "C") return "패턴 기반 추첨";
  return "분석 기반 균형 추첨";
}

export function Generator({ onToast }: { onToast: (msg: string) => void }) {
  const {
    analysis,
    selection,
    bands,
    settings,
    updateSettings,
    games,
    gamesMode,
    setGeneratedGames,
  } = useAppState();
  const [pending, setPending] = useState<number[] | null>(null);

  if (!analysis || !selection) return null;

  const current = MODES.find((m) => m.key === settings.mode) ?? MODES[0];

  // 20게임이라도 수 ms면 끝나므로 그 자리에서 계산한다. 화면이 백그라운드로
  // 내려가 있어도(rAF가 멈춰도) 버튼이 먹통이 되지 않는다.
  const onGenerate = () => {
    const core = settings.includeCore ? selection.number : null;
    const next = generateGames(settings.gameCount, settings.mode, core, undefined, bands);
    setGeneratedGames(next, modeLabel(settings.mode));
  };

  const text = games.length ? formatGamesText(games, analysis.latest, gamesMode) : "";

  const onCopy = async () => {
    onToast((await copyText(text)) ? "번호를 복사했습니다." : "복사에 실패했습니다.");
  };

  const onShare = async () => {
    const result = await shareText(text, "로또 6/45 분석기");
    if (result === "copied") onToast("공유를 지원하지 않아 번호를 복사했습니다.");
    else if (result === "failed") onToast("공유·복사에 실패했습니다.");
  };

  return (
    <>
      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 12 }}>
          번호 생성
        </h2>

        <div className="stack">
          <div className="field">
            <span className="field__label" id="mode-label">
              추첨 방식
            </span>
            <div className="segment" role="group" aria-labelledby="mode-label">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="segment__btn"
                  aria-pressed={settings.mode === m.key}
                  onClick={() => updateSettings({ mode: m.key })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="faint" style={{ margin: 0 }}>
              {current.help}
              {settings.mode === "A" ? "" : " 당첨 확률을 높이는 규칙이 아닙니다."}
            </p>
          </div>

          <label className="toggle">
            <span>
              <span className="toggle__text">핵심 추천번호 {selection.number} 포함</span>
              <br />
              <span className="faint">끄면 6개 전부 무작위로 뽑습니다.</span>
            </span>
            <input
              type="checkbox"
              checked={settings.includeCore}
              onChange={(e) => updateSettings({ includeCore: e.target.checked })}
            />
          </label>

          <div className="field">
            <span className="field__label" id="count-label">
              게임 수
            </span>
            <div className="segment" role="group" aria-labelledby="count-label">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="segment__btn"
                  aria-pressed={settings.gameCount === c}
                  onClick={() => updateSettings({ gameCount: c })}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="btn btn--primary btn--cta" onClick={onGenerate}>
            번호 생성하기
          </button>
        </div>
      </section>

      {games.length > 0 ? (
        <section className="card">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <h2 className="card__title">생성 결과</h2>
            <span className="faint nums">
              {analysis.latest}회 기준 · {gamesMode}
            </span>
          </div>

          <div className="stack">
            {games.map((combo, i) => {
              const p = combinationPattern(combo);
              return (
                <div className="game" key={`${i}-${combo.join(",")}`}>
                  <div className="game__head">
                    <span>게임 {i + 1}</span>
                    <span className="nums">
                      홀 {p.odd} : 짝 {6 - p.odd} · 합 {p.sum}
                    </span>
                  </div>
                  <BallRow numbers={combo} />
                  <div className="row row--between">
                    <span className="faint nums">
                      구간 {p.zones10}개 · 연속 {p.consecutive}쌍 · 저 {6 - p.high} : 고 {p.high}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setPending(combo)}
                    >
                      저장
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 12 }} className="stack">
            <ZoneLegend />
            <div className="row">
              <button type="button" className="btn btn--grow" onClick={onCopy}>
                전체 복사
              </button>
              <button type="button" className="btn btn--grow" onClick={onShare}>
                {canShare() ? "공유하기" : "공유(복사)"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <SlotPickerSheet
        numbers={pending}
        mode={gamesMode}
        open={pending !== null}
        onClose={() => setPending(null)}
        onToast={onToast}
      />
    </>
  );
}
