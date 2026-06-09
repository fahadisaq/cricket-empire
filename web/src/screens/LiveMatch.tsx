/**
 * Live, time-synced match viewer — 2011-Hitwicket style.
 * The match plays ball-by-ball at a natural pace. If the match is already in
 * progress (started a while ago), it joins live at the right ball; if it's
 * over, it shows the result. Built on the deterministic engine + timeline so
 * everyone watching sees the same ball at the same moment.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Radio } from "lucide-react";
import type { MatchResult, BallEvent } from "@engine/engine/types.ts";
import { buildTimeline, ballsRevealedAt } from "@engine/engine/timeline.ts";
import { useGame } from "../store/gameStore";

export function LiveMatch({
  result, startedAt, onClose,
}: { result: MatchResult; startedAt: number; onClose: () => void }) {
  const world = useGame((s) => s.world)!;
  const myId = useGame((s) => s.myClubId);

  // Natural, deterministic timeline for this match.
  const timeline = useMemo(() => buildTimeline(result, { baseSecondsPerBall: 2.6 }), [result]);

  const [revealed, setRevealed] = useState(0);
  const [view, setView] = useState<"commentary" | "scorecard">("commentary");
  const [flash, setFlash] = useState<{ kind: string; key: number } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const nameOf = (id: string) => world.clubs.find((c) => c.id === id)?.name ?? "(club)";
  const teamAId = result.innings[0].battingTeamId;
  const teamBId = result.innings[0].bowlingTeamId;

  // Time-synced playback: compute revealed balls from real elapsed time.
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const n = ballsRevealedAt(timeline, elapsed);
      setRevealed((prev) => {
        if (n > prev) {
          const ev = timeline.balls[n - 1]?.event;
          if (ev) {
            if (ev.outcome === "W") setFlash({ kind: "wicket", key: n });
            else if (ev.outcome === 6) setFlash({ kind: "six", key: n });
            else if (ev.outcome === 4) setFlash({ kind: "four", key: n });
          }
        }
        return Math.max(prev, n);
      });
    };
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  }, [timeline, startedAt]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => { feedRef.current?.scrollTo({ top: 0 }); }, [revealed]);

  const shownEvents = timeline.balls.slice(0, revealed).map((b) => b.event);
  const finished = revealed >= timeline.balls.length;
  const live = useMemo(() => deriveLive(shownEvents), [revealed]);
  const feed = shownEvents.slice(-50).reverse();

  const won = result.winnerTeamId;
  const myResult = won === null ? "tie" : won === myId ? "win" : "loss";

  return (
    <div className="fixed inset-0 z-50 glass flex flex-col" style={{ background: "rgba(6,9,15,0.94)" }}>
      {/* Scoreboard */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        <div className="flex-1 grid grid-cols-2 gap-4 max-w-3xl mx-auto">
          <Score name={nameOf(teamAId)} mine={teamAId === myId} s={live.inn1} batting={live.batting === 1} />
          <Score name={nameOf(teamBId)} mine={teamBId === myId} s={live.inn2} batting={live.batting === 2}
            target={live.batting === 2 ? live.inn1.runs + 1 : undefined} />
        </div>
        {!finished && (
          <span className="flex items-center gap-1.5 text-xs text-pitch-400">
            <Radio size={13} className="live-dot" /> LIVE
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden max-w-5xl w-full mx-auto p-4 grid md:grid-cols-[1fr_340px] gap-4">
        {/* Field / flash */}
        <div className="relative card overflow-hidden grid place-items-center"
          style={{ background: "radial-gradient(circle at 50% 40%, rgba(34,197,94,0.12), transparent 60%)" }}>
          <div className="absolute w-64 h-64 rounded-full border-2 border-pitch-500/15" />
          <div className="absolute w-40 h-40 rounded-full border border-pitch-500/10" />
          <div className="absolute w-2 h-20 bg-pitch-500/15 rounded" />
          <AnimatePresence>
            {flash && (
              <motion.div key={flash.key}
                initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 16 }}
                className={`relative z-10 font-display tracking-wider text-7xl ${
                  flash.kind === "six" ? "text-yellow-400" : flash.kind === "four" ? "text-pitch-400" : "text-red-500"}`}>
                {flash.kind === "six" ? "SIX!" : flash.kind === "four" ? "FOUR!" : "OUT!"}
              </motion.div>
            )}
          </AnimatePresence>
          {finished && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 text-center">
              <Trophy className={`mx-auto mb-2 ${myResult === "win" ? "text-yellow-400" : "text-slate-500"}`} size={42} />
              <div className="font-display text-4xl text-white">{won === null ? "MATCH TIED" : `${nameOf(won)} WON`}</div>
              <div className="text-slate-400">{result.margin}</div>
              <div className={`mt-2 inline-block stat-pill ${
                myResult === "win" ? "bg-pitch-500/20 text-pitch-400" : myResult === "loss" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-300"}`}>
                {myResult === "win" ? "You won! 🎉" : myResult === "loss" ? "You lost" : "Tied"}
              </div>
              <div className="mt-3 text-sm text-slate-400">Player of the Match: <b className="text-white">{result.manOfTheMatch.name}</b></div>
            </motion.div>
          )}
        </div>

        {/* Commentary / Scorecard */}
        <div className="card flex flex-col overflow-hidden">
          <div className="flex border-b border-white/5">
            <Tab active={view === "commentary"} onClick={() => setView("commentary")}>Commentary</Tab>
            <Tab active={view === "scorecard"} onClick={() => setView("scorecard")}>Scorecard</Tab>
          </div>
          {view === "commentary" ? (
            <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {feed.length === 0 && <p className="text-slate-600 text-sm">The match is starting…</p>}
              {feed.map((e, i) => <Line key={shownEvents.length - i} ev={e} fresh={i === 0} />)}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-4"><Card result={result} nameOf={nameOf} /></div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-3 flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="text-xs text-slate-500">
          {finished ? "Match complete" : `Following live · ball ${revealed} of ${timeline.balls.length}`}
        </div>
        <button onClick={onClose} className="btn btn-primary">{finished ? "Continue" : "Watch later"}</button>
      </div>
      <div className="h-1 bg-white/5">
        <div className="h-full bg-pitch-500 transition-all" style={{ width: `${(revealed / Math.max(1, timeline.balls.length)) * 100}%` }} />
      </div>
    </div>
  );
}

function Score({ name, mine, s, batting, target }: {
  name: string; mine: boolean; s: { runs: number; wkts: number; balls: number }; batting: boolean; target?: number;
}) {
  const overs = `${Math.floor(s.balls / 6)}.${s.balls % 6}`;
  return (
    <div className={`rounded-xl p-3 ${batting ? "bg-pitch-600/15 ring-1 ring-pitch-500/40" : "bg-white/5"}`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold truncate ${mine ? "text-pitch-400" : "text-white"}`}>{name}</span>
        {batting && <span className="text-[10px] text-pitch-400">● BATTING</span>}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl text-white">{s.runs}/{s.wkts}</span>
        <span className="text-xs text-slate-400">({overs})</span>
      </div>
      {target !== undefined && <div className="text-xs text-slate-400">Target {target}</div>}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-wider ${active ? "text-pitch-400 bg-pitch-600/10" : "text-slate-400 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

function Line({ ev, fresh }: { ev: BallEvent; fresh: boolean }) {
  const tone = ev.outcome === "W" ? "border-red-500/50 bg-red-500/5"
    : ev.outcome === 6 ? "border-yellow-500/40 bg-yellow-500/5"
    : ev.outcome === 4 ? "border-pitch-500/40 bg-pitch-500/5" : "border-white/5";
  return (
    <motion.div initial={fresh ? { opacity: 0, x: 12 } : false} animate={{ opacity: 1, x: 0 }}
      className={`text-sm rounded-lg border px-2.5 py-1.5 text-slate-300 ${tone}`}>
      {ev.commentary}
    </motion.div>
  );
}

function Card({ result, nameOf }: { result: MatchResult; nameOf: (id: string) => string }) {
  return (
    <>
      {result.innings.map((inn, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between">
            <h4 className="font-head text-white">{nameOf(inn.battingTeamId)}</h4>
            <span className="text-sm text-slate-300">{inn.runs}/{inn.wickets} ({(inn.balls / 6).toFixed(1)})</span>
          </div>
          <table className="w-full text-xs mt-1">
            <tbody>
              {inn.batting.filter((b) => b.balls > 0 || b.out).map((b) => (
                <tr key={b.playerId} className="border-b border-white/5">
                  <td className="py-1 text-slate-200">{b.name}</td>
                  <td className="py-1 text-slate-500 text-right pr-2">{b.out ? b.dismissal : "not out"}</td>
                  <td className="py-1 text-white text-right font-semibold">{b.runs}</td>
                  <td className="py-1 text-slate-500 text-right">({b.balls})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function deriveLive(shown: BallEvent[]) {
  let inn1 = { runs: 0, wkts: 0, balls: 0 };
  let inn2 = { runs: 0, wkts: 0, balls: 0 };
  let batting: 1 | 2 = 1;
  for (const e of shown) {
    if (e.inning === 1) { inn1 = { runs: e.teamScore, wkts: e.teamWickets, balls: inn1.balls + 1 }; batting = 1; }
    else { inn2 = { runs: e.teamScore, wkts: e.teamWickets, balls: inn2.balls + 1 }; batting = 2; }
  }
  return { inn1, inn2, batting };
}
