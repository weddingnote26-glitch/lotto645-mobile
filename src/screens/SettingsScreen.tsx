// 설정. 핵심은 [당첨번호 데이터 업데이트] — 휴대폰에서 고른 .xlsx를 브라우저 안에서
// 직접 읽어 분석을 다시 돌리고, 결과를 IndexedDB에 저장한다. 파일은 업로드되지 않는다.

import { useRef, useState } from "react";

import { AddDrawCard } from "../components/AddDrawCard";
import { useAppState } from "../state/AppState";
import { ANALYSIS_FROM_OPTIONS } from "../storage/db";
import { SEED_LATEST_ROUND, SEED_ROUND_COUNT } from "../data/seedDraws";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SettingsScreen({ onToast }: { onToast: (msg: string) => void }) {
  const { data, analysis, usingSeed, dataSavedAt, warnings, dismissWarnings, updateFromFile, resetToSeed, settings, updateSettings } =
    useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data || !analysis) return null;

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await updateFromFile(file);
    setBusy(false);
    if (result.ok) onToast(result.message);
    else setError(result.message);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="screen">
      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 10 }}>
          당첨번호 데이터
        </h2>
        <div className="kv" style={{ marginBottom: 12 }}>
          <div className="kv__item">
            <div className="kv__k">최신 회차</div>
            <div className="kv__v">{analysis.latest}회</div>
          </div>
          <div className="kv__item">
            <div className="kv__k">회차 수</div>
            <div className="kv__v">{data.rounds.length}개</div>
          </div>
          <div className="kv__item">
            <div className="kv__k">출처</div>
            <div className="kv__v" style={{ fontSize: 12.5, wordBreak: "break-all" }}>
              {data.source}
            </div>
          </div>
          <div className="kv__item">
            <div className="kv__k">업데이트</div>
            <div className="kv__v" style={{ fontSize: 12.5 }}>
              {usingSeed ? "내장 기본" : formatDate(dataSavedAt)}
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          className="file-input"
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <div className="stack">
          <button
            type="button"
            className="btn btn--primary btn--cta"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "읽는 중…" : "당첨번호 데이터 업데이트"}
          </button>
          {!usingSeed ? (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await resetToSeed();
                setError(null);
                onToast(`내장 기본 데이터(${SEED_LATEST_ROUND}회)로 되돌렸습니다.`);
              }}
            >
              내장 기본 데이터로 되돌리기
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="notice notice--warn" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        ) : null}

        <p className="faint" style={{ marginTop: 10, marginBottom: 0 }}>
          동행복권에서 내려받은 “로또 회차별 당첨번호” 엑셀(.xlsx)을 그대로 고르면 됩니다. 회차·당첨번호
          6개 열이 있으면 열 이름이 조금 달라도 자동으로 인식합니다. 보너스 번호는 형식만 확인하고
          분석에서는 제외합니다. 앱에는 제{SEED_LATEST_ROUND}회까지 {SEED_ROUND_COUNT}개 회차가 들어
          있습니다.
        </p>
      </section>

      {warnings.length ? (
        <section className="card">
          <div className="row row--between" style={{ marginBottom: 8 }}>
            <h2 className="card__title">데이터 경고 {warnings.length}건</h2>
            <button type="button" className="btn btn--ghost" onClick={dismissWarnings}>
              지우기
            </button>
          </div>
          <div className="notice notice--warn">
            아래 항목은 분석에서 제외했습니다.
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {warnings.slice(0, 15).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            {warnings.length > 15 ? <div style={{ marginTop: 6 }}>… 외 {warnings.length - 15}건</div> : null}
          </div>
        </section>
      ) : null}

      <AddDrawCard onToast={onToast} />

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 4 }}>
          수열 분석 범위
        </h2>
        <p className="card__sub" style={{ marginBottom: 10 }}>
          세로줄 · 끝수 · 9궁도 · 끝회차 분석을 몇 회차부터 집계할지 정합니다.
        </p>
        <div className="segment" role="group" aria-label="분석 시작 회차">
          {ANALYSIS_FROM_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="segment__btn"
              aria-pressed={settings.analysisFrom === o.value}
              onClick={() => updateSettings({ analysisFrom: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="faint" style={{ marginTop: 8, marginBottom: 0 }}>
          {ANALYSIS_FROM_OPTIONS.find((o) => o.value === settings.analysisFrom)?.help}{" "}
          {settings.analysisFrom === 262
            ? `1~261회 ${data.rounds.filter((r) => r < 262).length}개 회차를 빼고 봅니다.`
            : ""}
        </p>
        <div className="notice notice--info" style={{ marginTop: 10 }}>
          참고로 1~261회와 262회 이후의 번호 분포를 비교해 보면 통계적으로 차이가 없었습니다
          (동질성 카이제곱 27.9, 임계 60.5). 표본이 많을수록 수치가 안정되므로 전체 회차를
          권합니다.
        </div>
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 8 }}>
          개인정보 · 권한
        </h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
          <li>계정·로그인이 없고, 서버로 보내는 데이터가 없습니다.</li>
          <li>고른 엑셀 파일은 휴대폰 브라우저 안에서만 읽고 저장합니다.</li>
          <li>위치·카메라·마이크·연락처 권한을 쓰지 않습니다.</li>
          <li>데이터를 지우려면 브라우저의 사이트 데이터 삭제를 사용하세요.</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: 8 }}>
          홈 화면에 앱처럼 추가하기
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>
          <strong>Android Chrome</strong> — 우측 상단 ⋮ → “홈 화면에 추가”
          <br />
          <strong>iPhone Safari</strong> — 하단 공유 → “홈 화면에 추가”
          <br />
          추가하지 않고 주소만으로 사용해도 모든 기능이 똑같이 동작합니다.
        </p>
      </section>

      <p className="disclaimer">
        로또 6/45 분석기 · 과거 데이터 통계 분석 도구
        <br />
        로또 추첨은 매회 독립적인 무작위 추첨입니다. 이 앱은 미래 번호를 예측하지 않으며, 생성된
        번호는 당첨을 보장하지 않습니다.
      </p>
    </div>
  );
}
