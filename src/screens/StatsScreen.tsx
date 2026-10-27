// 상세 통계. PC의 가로로 긴 1~45 표를 모바일에서는 카드 + 아코디언으로 바꿨다.
// 정렬 기준을 바꿔 가며 볼 수 있고, 펼치면 과거 출현 회차까지 보여준다.

import { useMemo, useState } from "react";

import { Ball } from "../components/Ball";
import { PatternPanel } from "../components/PatternPanel";
import { SequencePanel } from "../components/SequencePanel";
import { Zone15Bars, Zone10Bars, OddEvenSplit } from "../components/WindowSummary";
import { ZONE10_LABELS, ZONE15_LABELS } from "../core/analyzer";
import { useAppState } from "../state/AppState";
import type { TabKey } from "../types/nav";

type View = "numbers" | "patterns" | "sequence";
type SortKey = "number" | "cnt5" | "cnt10" | "cntTotal" | "gap";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "number", label: "번호순" },
  { key: "cnt5", label: "최근 5회 많은순" },
  { key: "cnt10", label: "최근 10회 많은순" },
  { key: "cntTotal", label: "전체 출현 많은순" },
  { key: "gap", label: "오래 안 나온순" },
];

export function StatsScreen({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { analysis, selection, patterns, bands } = useAppState();
  const [view, setView] = useState<View>("numbers");
  const [sort, setSort] = useState<SortKey>("number");
  const [open, setOpen] = useState<number | null>(null);

  const ordered = useMemo(() => {
    if (!analysis) return [];
    const all = Array.from({ length: 45 }, (_, i) => analysis.stats[i + 1]);
    if (sort === "number") return all;
    return [...all].sort((a, b) => b[sort] - a[sort] || a.number - b.number);
  }, [analysis, sort]);

  if (!analysis) return null;

  const switcher = (
    <div className="segment" role="group" aria-label="통계 종류">
      <button
        type="button"
        className="segment__btn"
        aria-pressed={view === "numbers"}
        onClick={() => setView("numbers")}
      >
        번호별 통계
      </button>
      <button
        type="button"
        className="segment__btn"
        aria-pressed={view === "patterns"}
        onClick={() => setView("patterns")}
      >
        조합 패턴
      </button>
      <button
        type="button"
        className="segment__btn"
        aria-pressed={view === "sequence"}
        onClick={() => setView("sequence")}
      >
        수열
      </button>
    </div>
  );

  if (view === "sequence") {
    return (
      <div className="screen">
        {switcher}
        <SequencePanel onNavigate={onNavigate} />
      </div>
    );
  }

  if (view === "patterns") {
    return (
      <div className="screen">
        {switcher}
        {patterns && bands ? (
          <PatternPanel stats={patterns} bands={bands} />
        ) : (
          <p className="muted">패턴을 계산하는 중…</p>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      {switcher}

      <section className="card">
        <h2 className="card__title">최근 10회 홀짝</h2>
        <p className="card__sub nums" style={{ marginBottom: 10 }}>
          {analysis.win10.rounds[0]}~{analysis.latest}회
        </p>
        <div className="stack">
          <OddEvenSplit w={analysis.win10} />
          <div>
            <div className="field__label" style={{ marginBottom: 8 }}>
              15단위 구간
            </div>
            <Zone15Bars w={analysis.win10} />
          </div>
          <div>
            <div className="field__label" style={{ marginBottom: 8 }}>
              10단위 구간 (크기 보정)
            </div>
            <Zone10Bars w={analysis.win10} showLevel />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="field">
          <label className="field__label" htmlFor="sort">
            1~45 번호별 통계 · 정렬
          </label>
          <select
            id="sort"
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div>
        {ordered.map((st) => {
          const isOpen = open === st.number;
          const recent = [...st.appearances].reverse().slice(0, 30);
          return (
            <div className="acc" key={st.number}>
              <button
                type="button"
                className="acc__head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : st.number)}
              >
                <Ball n={st.number} size="md" />
                <span className="acc__facts">
                  <span className="acc__line1 nums">
                    최근5회 {st.cnt5} · 최근10회 {st.cnt10} · 미출현 {st.gap}회
                    {st.number === selection?.number ? " · 추천번호" : ""}
                  </span>
                  <span className="acc__line2 nums">
                    {st.odd ? "홀수" : "짝수"} · {ZONE10_LABELS[st.zone10]} ·{" "}
                    {ZONE15_LABELS[st.zone15]} · 전체 {st.cntTotal}회
                  </span>
                </span>
                <span className="acc__chev" aria-hidden="true">
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>

              {isOpen ? (
                <div className="acc__body">
                  <div className="kv" style={{ marginBottom: 10 }}>
                    <div className="kv__item">
                      <div className="kv__k">최근 5회 출현</div>
                      <div className="kv__v">{st.cnt5}회</div>
                    </div>
                    <div className="kv__item">
                      <div className="kv__k">최근 10회 출현</div>
                      <div className="kv__v">{st.cnt10}회</div>
                    </div>
                    <div className="kv__item">
                      <div className="kv__k">마지막 출현</div>
                      <div className="kv__v">
                        {st.lastRound !== null ? `${st.lastRound}회` : "없음"}
                      </div>
                    </div>
                    <div className="kv__item">
                      <div className="kv__k">미출현 간격</div>
                      <div className="kv__v">{st.gap}회</div>
                    </div>
                    <div className="kv__item">
                      <div className="kv__k">직전 회차</div>
                      <div className="kv__v">{st.inPrev ? "출현" : "미출현"}</div>
                    </div>
                    <div className="kv__item">
                      <div className="kv__k">전체 출현</div>
                      <div className="kv__v">{st.cntTotal}회</div>
                    </div>
                  </div>
                  <div className="faint" style={{ marginBottom: 4 }}>
                    최근 출현 회차 (최신순, 최대 30개)
                  </div>
                  <div className="step__after">
                    {recent.length ? recent.map((r) => `${r}회`).join(", ") : "출현 기록 없음"}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
