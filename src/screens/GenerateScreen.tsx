// 번호 생성 탭. 홈과 같은 생성기를 쓰고, 아래에 저장해 둔 번호 목록을 붙였다.

import { Ball, BallRow } from "../components/Ball";
import { Generator } from "../components/Generator";
import { useAppState } from "../state/AppState";
import { copyText } from "../utils/share";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function GenerateScreen({ onToast }: { onToast: (msg: string) => void }) {
  const { analysis, selection, savedGames, removeSavedGame, clearSavedGames } = useAppState();

  if (!analysis || !selection) return null;

  const onCopySaved = async () => {
    const text = savedGames
      .map((g) => `${g.baseRound}회 기준: ${g.numbers.map((n) => String(n).padStart(2, "0")).join(", ")}`)
      .join("\n");
    onToast((await copyText(text)) ? "저장된 번호를 복사했습니다." : "복사에 실패했습니다.");
  };

  return (
    <div className="screen">
      <section className="card">
        <div className="row row--between">
          <div>
            <h2 className="card__title">핵심 추천번호</h2>
            <p className="card__sub nums">{analysis.latest}회 기준</p>
          </div>
          <Ball n={selection.number} size="md" />
        </div>
      </section>

      <Generator onToast={onToast} />

      <section className="card">
        <div className="row row--between" style={{ marginBottom: 10 }}>
          <div>
            <h2 className="card__title">저장한 번호</h2>
            <p className="card__sub">이 휴대폰 안에만 저장됩니다.</p>
          </div>
          <span className="chip nums">{savedGames.length}게임</span>
        </div>

        {savedGames.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            아직 저장한 번호가 없습니다. 생성 결과에서 [저장]을 누르면 여기에 쌓입니다.
          </p>
        ) : (
          <>
            <div className="stack">
              {savedGames.map((g) => (
                <div className="game" key={g.id}>
                  <div className="game__head">
                    <span className="nums">
                      {g.baseRound}회 기준 · {g.mode}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger"
                      onClick={() => removeSavedGame(g.id)}
                    >
                      삭제
                    </button>
                  </div>
                  <BallRow numbers={g.numbers} size="sm" />
                  <span className="faint">{formatDate(g.savedAt)}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn--grow" onClick={onCopySaved}>
                전체 복사
              </button>
              <button
                type="button"
                className="btn btn--grow btn--danger"
                onClick={async () => {
                  await clearSavedGames();
                  onToast("저장한 번호를 모두 지웠습니다.");
                }}
              >
                전체 삭제
              </button>
            </div>
          </>
        )}
      </section>

      <p className="disclaimer">
        생성된 번호는 과거 데이터 기반의 통계 추천일 뿐, 당첨을 예측하거나 보장하지 않습니다.
      </p>
    </div>
  );
}
