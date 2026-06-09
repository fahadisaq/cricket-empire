import { useEffect, useState } from "react";
import { useGame, type FixtureView, type ScheduleInfo, type MatchResultView } from "../store/gameStore";
import { Home, Plane, Clock, CheckCircle2, CircleDot, PlayCircle } from "lucide-react";
import { LiveMatch } from "../screens/LiveMatch";

export function Fixtures() {
  const fetchFixtures = useGame((s) => s.fetchFixtures);
  const fetchSchedule = useGame((s) => s.fetchSchedule);
  const fetchMatch = useGame((s) => s.fetchMatch);
  const club = useGame((s) => s.view!.club);

  const [fixtures, setFixtures] = useState<FixtureView[]>([]);
  const [sched, setSched] = useState<ScheduleInfo | null>(null);
  const [countdown, setCountdown] = useState("");
  const [match, setMatch] = useState<{ result: MatchResultView; startedAt: number } | null>(null);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    void fetchFixtures().then(setFixtures);
    void fetchSchedule().then(setSched);
    void fetchMatch().then((m) => {
      if (m.match && m.startedAt) setMatch({ result: m.match, startedAt: m.startedAt });
    });
  }, [fetchFixtures, fetchSchedule, fetchMatch]);

  // Live countdown to next match day (next tick).
  useEffect(() => {
    if (!sched?.nextTickAt) return;
    const id = setInterval(() => {
      const ms = Math.max(0, sched.nextTickAt! - Date.now());
      const h = Math.floor(ms / 3.6e6);
      const m = Math.floor((ms % 3.6e6) / 6e4);
      const s = Math.floor((ms % 6e4) / 1000);
      setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(id);
  }, [sched]);

  const next = fixtures.find((f) => f.status === "next");

  return (
    <div className="p-6 max-w-4xl mx-auto rise">
      <h1 className="title-xl text-5xl">FIXTURES</h1>
      <p className="text-slate-400">Your season schedule · {club.name}</p>

      {/* Watch your most recent match */}
      {match && (
        <div className="mt-5 card card-hover p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PlayCircle className="text-pitch-400" size={28} />
            <div>
              <div className="text-white font-semibold">Your latest match is ready</div>
              <div className="text-xs text-slate-500">Watch it unfold ball-by-ball</div>
            </div>
          </div>
          <button onClick={() => setWatching(true)} className="btn btn-primary">Watch</button>
        </div>
      )}

      {watching && match && (
        <LiveMatch result={match.result} startedAt={match.startedAt} onClose={() => setWatching(false)} />
      )}

      {/* Next match banner */}
      {next && (
        <div className="mt-5 card overflow-hidden">
          <div className="px-6 py-5" style={{ background: "linear-gradient(110deg, rgba(34,197,94,0.18), transparent 60%)" }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-pitch-400 font-semibold uppercase tracking-widest">Next match · Week {next.week}</div>
                <div className="mt-1 text-2xl font-bold text-white">
                  {next.home ? "vs" : "@"} {next.opponentName}
                </div>
                <div className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  {next.home ? <Home size={14} /> : <Plane size={14} />}
                  {next.home ? "Home" : "Away"} · {next.pitch} pitch
                </div>
              </div>
              {sched?.autoTick && (
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1 justify-end">
                    <Clock size={12} /> Starts in
                  </div>
                  <div className="font-display text-3xl text-pitch-400">{countdown || "…"}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full fixture list */}
      <div className="mt-5 card overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 font-head text-lg text-white">Season schedule</div>
        <div className="divide-y divide-white/5">
          {fixtures.map((f) => (
            <div key={f.round} className={`flex items-center gap-3 px-4 py-3 ${f.status === "next" ? "bg-pitch-600/10" : ""}`}>
              <div className="w-12 text-xs text-slate-500">R{f.round + 1}</div>
              <div className="w-7">
                {f.status === "played" ? <CheckCircle2 size={16} className="text-slate-600" />
                  : f.status === "next" ? <CircleDot size={16} className="text-pitch-400" />
                  : <Clock size={15} className="text-slate-600" />}
              </div>
              <div className="flex items-center gap-2 flex-1">
                {f.home ? <Home size={13} className="text-slate-500" /> : <Plane size={13} className="text-slate-500" />}
                <span className="text-sm text-white">{f.home ? "vs" : "@"} {f.opponentName}</span>
              </div>
              <div className="text-xs text-slate-500 capitalize">{f.pitch}</div>
              <div className="w-20 text-right text-xs">
                {f.status === "played" ? <span className="text-slate-500">Played</span>
                  : f.status === "next" ? <span className="text-pitch-400 font-semibold">Next</span>
                  : <span className="text-slate-600">Week {f.week}</span>}
              </div>
            </div>
          ))}
          {fixtures.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">No fixtures scheduled yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
