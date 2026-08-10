// 번호 생성 영역.
//
// 화면 순서: ① 핵심 추천번호 → ② 상위 추천번호 5개 → ③ 자동/반자동/수동
//            → ④ 생성 설정 → ⑤ 생성 버튼 → ⑥ 바로 아래 결과
//
//   자동   — 프로그램이 6개를 다 뽑는다 (분석 기반 / 패턴 기반 / 완전 랜덤)
//   반자동 — 내가 고정한 번호 1~5개 + 나머지를 프로그램이 채운다
//   수동   — 1~45 번호판에서 6개를 직접 고른다
//
// 홀짝 구성은 고정값이 아니라 최근 5·10회의 실제 분포에서 계산한다
// (core/parityAnalyzer.ts). 데이터가 바뀌면 기준도 자동으로 바뀐다.

import { useEffect, useRef, useState } from "react";

import { generateGames, lockedNumbers } from "../core/combinationGenerator";
import { parityLabel, parityTargets } from "../core/parityAnalyzer";
import { combinationPattern } from "../core/patternAnalyzer";
import { SLOT_COUNT, type GenMethod, type Settings } from "../storage/db";
import { useAppState } from "../state/AppState";
import type { TabKey } from "../types/nav";
import type { ShowToast } from "../types/toast";
import { canShare, copyText, formatGamesText, shareText } from "../utils/share";
import { Ball, BallRow, ZoneLegend } from "./Ball";
import { planAssignment, SaveConfirmSheet, type SlotAssignment } from "./MyTicket";
import { NumberPad } from "./NumberPad";
import { RankedRow, type PickMode } from "./RankedRow";

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
    help: "10단위 구간 3개 이상, 15단위 구간 각 1개 이상, 연속번호 1쌍 이하가 되도록 쏠림만 줄입니다.",
  },
  {
    key: "C",
    label: "패턴 기반",
    help: "지금까지 당첨된 조합에서 흔했던 모양(합계·연속번호·구간·저고 비율)에 맞춰 뽑습니다.",
  },
  { key: "A", label: "완전 랜덤", help: "1~45에서 중복 없이 무작위로 뽑습니다." },
];

export function modeLabel(mode: Settings["mode"]): string {
  if (mode === "A") return "완전 랜덤";
  if (mode === "C") return "패턴 기반";
  return "분석 기반";
}

export function Generator({
  onToast,
  onNavigate,
}: {
  onToast: ShowToast;
  onNavigate: (tab: TabKey) => void;
}) {
  const {
    analysis,
    selection,
    ranked,
    bands,
    parity,
    settings,
    updateSettings,
    setFixedNumbers,
    ticket,
    games,
    setGeneratedGames,
    addGeneratedGame,
    clearGeneratedGames,
  } = useAppState();

  // 수동 선택은 이번 게임에만 쓰는 값이라 저장하지 않는다.
  const [manual, setManual] = useState<number[]>([]);
  // 결과에서 체크한 게임들 (내번호에 한 번에 저장할 대상)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [plan, setPlan] = useState<SlotAssignment[] | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const scrollPending = useRef(false);

  // 결과가 새로 만들어지면 체크는 비운다.
  useEffect(() => setSelected(new Set()), [games]);

  // 결과가 화면에 그려진 다음 그 위치로 부드럽게 이동시킨다.
  useEffect(() => {
    if (!scrollPending.current) return;
    scrollPending.current = false;
    const el = resultRef.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

    const before = window.scrollY;
    el.scrollIntoView({ behavior: "smooth", block: "start" });

    // 화면이 백그라운드에 있는 등 부드러운 이동이 아예 실행되지 않는 환경이 있다.
    // 잠시 뒤에도 그대로면 즉시 이동으로 대체해, 결과를 놓치는 일이 없게 한다.
    const timer = window.setTimeout(() => {
      if (window.scrollY === before) el.scrollIntoView({ behavior: "auto", block: "start" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [games]);

  if (!analysis || !selection) return null;

  const method = settings.genMethod;
  const fill = FILL_MODES.find((m) => m.key === settings.mode) ?? FILL_MODES[0];
  const fixed = settings.fixedNumbers;
  const core = settings.includeCore ? selection.number : null;
  const usesParity = settings.mode !== "A";

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

  // 반자동·수동일 때만 추천번호를 눌러 번호판에 넣을 수 있다.
  const pickMode: PickMode | undefined =
    method === "semi"
      ? { selected: fixed, onToggle: onToggleFixed }
      : method === "manual"
        ? { selected: manual, onToggle: onToggleManual }
        : undefined;

  // 최근 5·10회 홀짝 분포로 게임별 목표 홀수 개수를 정한다.
  const targets = usesParity && parity ? parityTargets(parity, settings.gameCount) : [];
  const targetMix = targets.reduce<Map<number, number>>((m, t) => {
    m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, new Map());

  const onGenerate = () => {
    const useFixedNow = method === "semi" ? fixed : settings.useFixed ? fixed : [];
    const next = generateGames(
      settings.gameCount,
      settings.mode,
      core,
      undefined,
      bands,
      useFixedNow,
      targets,
    );
    const label =
      method === "semi" ? `반자동 · ${modeLabel(settings.mode)}` : `자동 · ${modeLabel(settings.mode)}`;
    scrollPending.current = true;
    setGeneratedGames(next, label);
    if (next.length < settings.gameCount) {
      onToast(`서로 다른 조합이 ${next.length}게임까지만 가능해 그만큼만 만들었습니다.`);
    }
  };

  const onAddManual = () => {
    scrollPending.current = true;
    addGeneratedGame(manual, "수동");
    setManual([]);
  };

  // ---- 결과 선택 / 일괄 저장 ----
  // 내번호는 A~E 5칸뿐이라 한 번에 5게임까지만 고를 수 있다.
  const selectableCount = Math.min(SLOT_COUNT, games.length);
  const allChecked = selectableCount > 0 && selected.size === selectableCount;

  const toggleGame = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else if (next.size >= SLOT_COUNT) {
        onToast(`내번호는 ${SLOT_COUNT}칸이라 한 번에 ${SLOT_COUNT}게임까지 고를 수 있습니다.`);
        return prev;
      } else {
        next.add(i);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(Array.from({ length: selectableCount }, (_, i) => i)));
    if (games.length > SLOT_COUNT) {
      onToast(`앞에서 ${SLOT_COUNT}게임만 선택했습니다. 내번호가 ${SLOT_COUNT}칸이기 때문입니다.`);
    }
  };

  const openSaveConfirm = () => {
    const picks = [...selected]
      .sort((a, b) => a - b)
      .map((i) => ({ numbers: games[i].numbers, mode: games[i].mode }));
    if (picks.length === 0) return;
    setPlan(planAssignment(ticket, picks));
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

  const parityNote =
    usesParity && parity?.top ? (
      <div className="parity">
        <div className="row row--between">
          <span className="parity__label">홀짝 구성 기준</span>
          <strong className="parity__value nums">{parityLabel(parity.top.odd)} 중심</strong>
        </div>
        {targetMix.size > 1 ? (
          <span className="faint nums">
            {settings.gameCount}게임 구성 ·{" "}
            {[...targetMix.entries()].map(([odd, n]) => `${odd}:${6 - odd} ${n}게임`).join(" · ")}
          </span>
        ) : null}
        <span className="faint">
          전체 {parity.totalRounds}회 실제 분포에 최근 5·10회 흐름
          {parity.recentTop ? ` (${parityLabel(parity.recentTop.odd)} 우세)` : ""}을 함께 반영합니다.
          데이터를 바꾸면 기준도 자동으로 바뀝니다.
        </span>
      </div>
    ) : null;

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
      {/* ① 핵심 추천번호 + ② 상위 추천번호 */}
      <section className="card">
        <div className="core">
          <span className="core__label">통계 분석 핵심번호</span>
          {pickMode ? (
            <button
              type="button"
              className={`core__pick${pickMode.selected.includes(selection.number) ? " core__pick--on" : ""}`}
              aria-pressed={pickMode.selected.includes(selection.number)}
              onClick={() => pickMode.onToggle(selection.number)}
            >
              <Ball n={selection.number} size="lg" />
            </button>
          ) : (
            <Ball n={selection.number} size="lg" />
          )}
          {pickMode ? <span className="faint">누르면 번호판에 추가됩니다</span> : null}
        </div>

        <RankedRow ranked={ranked} pick={pickMode} />
      </section>

      {/* ③ 생성 방식 + ④ 설정 + ⑤ 생성 버튼 */}
      <section className="card">
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
              {parityNote}
              {coreToggle}

              {fixed.length > 0 ? (
                <label className="toggle">
                  <span>
                    <span className="toggle__text">고정번호 사용</span>
                    <br />
                    <span className="faint">
                      모든 게임에 {fixed.join(", ")} 포함 (반자동에서 편집)
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
              <NumberPad
                selected={fixed}
                onToggle={onToggleFixed}
                max={6}
                title="고정할 번호 (1~5개)"
              />

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
              {fixed.length === 6 ? null : parityNote}
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
              <NumberPad
                selected={manual}
                onToggle={onToggleManual}
                max={6}
                title="수동 선택 — 6개를 고르세요"
              />

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
                {manual.length === 6 ? "이 번호로 추가" : `${6 - manual.length}개 더 선택하세요`}
              </button>
            </>
          ) : null}
        </div>
      </section>

      {/* ⑥ 결과 — 생성 버튼 바로 아래 */}
      {games.length > 0 ? (
        <section className="card" ref={resultRef}>
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <h2 className="card__title">생성 결과</h2>
            <span className="faint nums">{analysis.latest}회 기준</span>
          </div>

          {/* 상단 일괄 저장 바 — 체크한 게임을 한 번에 내번호로 */}
          <div className="savebar">
            <label className="savebar__all">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                aria-label="전체 선택"
              />
              <span>전체 선택</span>
            </label>
            <span className="savebar__count nums">
              선택 {selected.size} / {SLOT_COUNT}
            </span>
            <button
              type="button"
              className="btn btn--primary savebar__btn"
              disabled={selected.size === 0}
              onClick={openSaveConfirm}
            >
              내번호에 저장
            </button>
          </div>

          <div className="stack">
            {games.map((g, i) => {
              const p = combinationPattern(g.numbers);
              const on = selected.has(i);
              return (
                <label
                  className={`game game--pick${on ? " game--on" : ""}`}
                  key={`${i}-${g.numbers.join(",")}`}
                >
                  <div className="game__head">
                    <span>게임 {i + 1}</span>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleGame(i)}
                      aria-label={`게임 ${i + 1} 선택`}
                    />
                  </div>
                  <BallRow numbers={g.numbers} size="fit" />
                  <span className="faint nums">
                    {g.mode} · 홀 {p.odd} 짝 {6 - p.odd} · 합 {p.sum} · 구간 {p.zones10}개
                  </span>
                </label>
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

      <SaveConfirmSheet
        plan={plan}
        open={plan !== null}
        onClose={() => setPlan(null)}
        onToast={onToast}
        onViewTicket={() => onNavigate("ticket")}
      />
    </>
  );
}
