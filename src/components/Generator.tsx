// 번호 생성 영역.
//
//   자동   — 프로그램이 6개를 다 뽑는다 (분석 기반 / 패턴 기반 / 완전 랜덤)
//   반자동 — 내가 고정한 번호 1~5개 + 나머지를 프로그램이 채운다
//   수동   — 1~45 번호판에서 6개를 직접 고른다
//
// '고정번호'는 반자동에서 고른 번호를 그대로 쓰며, 자동 생성에도 켜 두면 모든
// 게임에 들어간다. 브라우저에 저장되어 앱을 껐다 켜도 남는다.

import { useState } from "react";

import { generateGames, lockedNumbers } from "../core/combinationGenerator";
import { combinationPattern } from "../core/patternAnalyzer";
import type { GenMethod, Settings } from "../storage/db";
import { useAppState } from "../state/AppState";
import { canShare, copyText, formatGamesText, shareText } from "../utils/share";
import { BallRow, ZoneLegend } from "./Ball";
import { SlotPickerSheet } from "./MyTicket";
import { NumberPad } from "./NumberPad";

const COUNTS = [1, 5, 10, 20];

const METHODS: Array<{ key: GenMethod; label: string; help: string }> = [
  { key: "auto", label: "자동", help: "6개 번호를 모두 프로그램이 뽑습니다." },
  {
    key: "semi",
    label: "반자동",
    help: "원하는 번호를 1~5개 고정하면 나머지를 프로그램이 채웁니다.",
  },
  { key: "manual", label: "수동", help: "1~45에서 6개를 직접 고릅니다." },
];

const FILL_MODES: Array<{ key: Settings["mode"]; label: string; help: string }> = [
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
  { key: "A", label: "완전 랜덤", help: "1~45에서 중복 없이 무작위로 뽑습니다." },
];

export function modeLabel(mode: Settings["mode"]): string {
  if (mode === "A") return "완전 랜덤";
  if (mode === "C") return "패턴 기반";
  return "분석 기반";
}

export function Generator({ onToast }: { onToast: (msg: string) => void }) {
  const {
    analysis,
    selection,
    bands,
    settings,
    updateSettings,
    setFixedNumbers,
    games,
    setGeneratedGames,
    addGeneratedGame,
    clearGeneratedGames,
  } = useAppState();

  // 수동 선택은 이번 게임에만 쓰는 값이라 저장하지 않는다.
  const [manual, setManual] = useState<number[]>([]);
  const [pending, setPending] = useState<{ numbers: number[]; mode: string } | null>(null);

  if (!analysis || !selection) return null;

  const method = settings.genMethod;
  const fill = FILL_MODES.find((m) => m.key === settings.mode) ?? FILL_MODES[0];
  const fixed = settings.fixedNumbers;
  const core = settings.includeCore ? selection.number : null;

  // 자동에서 실제로 들어갈 번호 = 추천번호 + (켜져 있으면) 고정번호. 중복은 한 번만.
  const autoLocked = lockedNumbers(core, settings.useFixed ? fixed : []);
  const semiLocked = lockedNumbers(core, fixed);

  const toggle = (list: number[], n: number, max: number): number[] => {
    if (list.includes(n)) return list.filter((v) => v !== n);
    if (list.length >= max) return list;
    return [...list, n].sort((a, b) => a - b);
  };

  const onToggleFixed = (n: number) => {
    if (!fixed.includes(n) && fixed.length >= 6) {
      onToast("고정번호는 최대 6개까지 고를 수 있습니다.");
      return;
    }
    const next = toggle(fixed, n, 6);
    setFixedNumbers(next);
    if (next.length === 6) {
      onToast("6개를 모두 고정하면 수동 번호와 같습니다. 그대로 한 게임이 만들어집니다.");
    }
  };

  const onToggleManual = (n: number) => {
    if (!manual.includes(n) && manual.length >= 6) {
      onToast("로또 번호는 최대 6개까지 선택할 수 있습니다.");
      return;
    }
    setManual(toggle(manual, n, 6));
  };

  const onGenerate = () => {
    const useFixedNow = method === "semi" ? fixed : settings.useFixed ? fixed : [];
    const next = generateGames(
      settings.gameCount,
      settings.mode,
      core,
      undefined,
      bands,
      useFixedNow,
    );
    const label =
      method === "semi" ? `반자동 · ${modeLabel(settings.mode)}` : `자동 · ${modeLabel(settings.mode)}`;
    setGeneratedGames(next, label);
    if (next.length < settings.gameCount) {
      onToast(`서로 다른 조합이 ${next.length}게임까지만 가능해 그만큼만 만들었습니다.`);
    }
  };

  const onAddManual = () => {
    addGeneratedGame(manual, "수동");
    onToast("수동 번호를 결과에 추가했습니다.");
    setManual([]);
  };

  const text = games.length
    ? formatGamesText(
        games.map((g) => g.numbers),
        analysis.latest,
        games[0].mode,
      )
    : "";

  const onCopy = async () => {
    onToast((await copyText(text)) ? "번호를 복사했습니다." : "복사에 실패했습니다.");
  };

  const onShare = async () => {
    const result = await shareText(text, "로또 6/45 분석기");
    if (result === "copied") onToast("공유를 지원하지 않아 번호를 복사했습니다.");
    else if (result === "failed") onToast("공유·복사에 실패했습니다.");
  };

  const fillModeField = (
    <div className="field">
      <span className="field__label" id="fill-label">
        {method === "semi" ? "나머지 번호 채우는 방식" : "추첨 방식"}
      </span>
      <div className="segment" role="group" aria-labelledby="fill-label">
        {FILL_MODES.map((m) => (
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
        {fill.help}
        {settings.mode === "A" ? "" : " 당첨 확률을 높이는 규칙이 아닙니다."}
      </p>
    </div>
  );

  const countField = (
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
  );

  const coreToggle = (
    <label className="toggle">
      <span>
        <span className="toggle__text">핵심 추천번호 {selection.number} 포함</span>
        <br />
        <span className="faint">
          {fixed.includes(selection.number) && (method === "semi" || settings.useFixed)
            ? "고정번호에 이미 들어 있어 중복으로 넣지 않습니다."
            : "끄면 추천번호 없이 뽑습니다."}
        </span>
      </span>
      <input
        type="checkbox"
        checked={settings.includeCore}
        onChange={(e) => updateSettings({ includeCore: e.target.checked })}
      />
    </label>
  );

  return (
    <>
      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 12 }}>
          번호 생성
        </h2>

        <div className="stack">
          <div className="field">
            <span className="field__label" id="method-label">
              생성 방식
            </span>
            <div className="segment" role="group" aria-labelledby="method-label">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="segment__btn"
                  aria-pressed={method === m.key}
                  onClick={() => updateSettings({ genMethod: m.key })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="faint" style={{ margin: 0 }}>
              {METHODS.find((m) => m.key === method)?.help}
            </p>
          </div>

          {/* ---------- 자동 ---------- */}
          {method === "auto" ? (
            <>
              {fillModeField}
              {coreToggle}

              {fixed.length > 0 ? (
                <label className="toggle">
                  <span>
                    <span className="toggle__text">고정번호 사용</span>
                    <br />
                    <span className="faint">
                      모든 게임에 {fixed.join(", ")} 포함 (반자동 탭에서 편집)
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.useFixed}
                    onChange={(e) => updateSettings({ useFixed: e.target.checked })}
                  />
                </label>
              ) : null}

              {autoLocked.length > 0 ? (
                <div className="picked">
                  <span className="picked__label">항상 들어갈 번호</span>
                  <BallRow numbers={autoLocked} size="sm" />
                </div>
              ) : null}

              {countField}

              <button type="button" className="btn btn--primary btn--cta" onClick={onGenerate}>
                번호 생성하기
              </button>
            </>
          ) : null}

          {/* ---------- 반자동 ---------- */}
          {method === "semi" ? (
            <>
              <div className="field">
                <div className="row row--between">
                  <span className="field__label">고정할 번호를 고르세요 (1~5개)</span>
                  <span className="chip nums">{fixed.length}/6</span>
                </div>
                <NumberPad selected={fixed} onToggle={onToggleFixed} max={6} />
              </div>

              <div className="picked">
                <span className="picked__label">
                  고정번호 {fixed.length > 0 ? "" : "— 아직 없음"}
                </span>
                {fixed.length > 0 ? (
                  <>
                    <BallRow numbers={fixed} size="sm" />
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger"
                      onClick={() => setFixedNumbers([])}
                    >
                      고정번호 초기화
                    </button>
                  </>
                ) : (
                  <span className="faint">
                    번호판에서 1~5개를 고르면 나머지를 프로그램이 채웁니다.
                  </span>
                )}
              </div>

              {fixed.length === 6 ? (
                <div className="notice notice--warn">
                  6개를 모두 고정했습니다. 이 번호 그대로 한 게임이 만들어집니다.
                </div>
              ) : null}

              {fillModeField}
              {coreToggle}

              {semiLocked.length > 0 ? (
                <div className="picked">
                  <span className="picked__label">항상 들어갈 번호</span>
                  <BallRow numbers={semiLocked} size="sm" />
                </div>
              ) : null}

              {fixed.length === 6 ? null : countField}

              <button
                type="button"
                className="btn btn--primary btn--cta"
                onClick={onGenerate}
                disabled={fixed.length === 0}
              >
                {fixed.length === 0 ? "고정할 번호를 먼저 고르세요" : "반자동 생성"}
              </button>
            </>
          ) : null}

          {/* ---------- 수동 ---------- */}
          {method === "manual" ? (
            <>
              <div className="field">
                <div className="row row--between">
                  <span className="field__label">6개 번호를 선택하세요</span>
                  <span className="chip nums">선택 {manual.length}/6</span>
                </div>
                <NumberPad selected={manual} onToggle={onToggleManual} max={6} />
              </div>

              <div className="picked">
                <span className="picked__label">선택한 번호</span>
                {manual.length > 0 ? (
                  <>
                    <BallRow numbers={manual} size="sm" />
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger"
                      onClick={() => setManual([])}
                    >
                      초기화
                    </button>
                  </>
                ) : (
                  <span className="faint">아직 고른 번호가 없습니다.</span>
                )}
              </div>

              <button
                type="button"
                className="btn btn--primary btn--cta"
                onClick={onAddManual}
                disabled={manual.length !== 6}
              >
                {manual.length === 6
                  ? "이 번호로 추가"
                  : `${6 - manual.length}개 더 선택하세요`}
              </button>
            </>
          ) : null}
        </div>
      </section>

      {games.length > 0 ? (
        <section className="card">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <h2 className="card__title">생성 결과</h2>
            <span className="faint nums">{analysis.latest}회 기준</span>
          </div>

          <div className="stack">
            {games.map((g, i) => {
              const p = combinationPattern(g.numbers);
              return (
                <div className="game" key={`${i}-${g.numbers.join(",")}`}>
                  <div className="game__head">
                    <span>
                      게임 {i + 1} · {g.mode}
                    </span>
                    <span className="nums">
                      홀 {p.odd} : 짝 {6 - p.odd} · 합 {p.sum}
                    </span>
                  </div>
                  <BallRow numbers={g.numbers} />
                  <div className="row row--between">
                    <span className="faint nums">
                      구간 {p.zones10}개 · 연속 {p.consecutive}쌍 · 저 {6 - p.high} : 고 {p.high}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setPending({ numbers: g.numbers, mode: g.mode })}
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
              <button type="button" className="btn btn--grow" onClick={clearGeneratedGames}>
                지우기
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <SlotPickerSheet
        numbers={pending?.numbers ?? null}
        mode={pending?.mode ?? ""}
        open={pending !== null}
        onClose={() => setPending(null)}
        onToast={onToast}
      />
    </>
  );
}
