import { useEffect, useState } from "react";
import { useGame } from "../store/gameStore";
import type { Club } from "@engine/world/state.ts";
import { Trophy, ChevronDown } from "lucide-react";

function nrr(c: Club): number {
  const forR = c.seasonBallsFor > 0 ? (c.seasonRunsFor / c.seasonBallsFor) * 6 : 0;
  const agR = c.seasonBallsAgainst > 0 ? (c.seasonRunsAgainst / c.seasonBallsAgainst) * 6 : 0;
  return forR - agR;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function League() {
  const world = useGame((s) => s.world)!;
  const myId = useGame((s) => s.myClubId);
  const myClub = useGame((s) => s.view!.club);
  const fetchLeague = useGame((s) => s.fetchLeague);

  const leagueId = myClub.leagueId;
  const league = leagueId
    ? world.leagues.find((l) => l.id === leagueId) ?? null
    : null;

  const [clubs, setClubs] = useState<Club[]>([]);

  useEffect(() => {
    if (!leagueId) {
      setClubs([]);
      return;
    }
    void fetchLeague(leagueId).then(setClubs);
  }, [fetchLeague, leagueId]);

  const sorted = [...clubs].sort(
    (a, b) => b.seasonPoints - a.seasonPoints || nrr(b) - nrr(a),
  );

  return (
    <div className="p-6 max-w-4xl mx-auto rise">
      <h1 className="title-xl text-5xl flex items-center gap-3">
        <Trophy className="text-pitch-500" size={34} /> LEAGUE TABLE
      </h1>
      <p className="text-slate-400 mt-1">{league?.name ?? "Your division"} · Week {world.week}</p>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-[11px] uppercase tracking-wider border-b border-white/5 font-head">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-3 py-3 text-left">Club</th>
              <th className="px-3 py-3">P</th>
              <th className="px-3 py-3">W</th>
              <th className="px-3 py-3">L</th>
              <th className="px-3 py-3">T</th>
              <th className="px-3 py-3">Pts</th>
              <th className="px-4 py-3 text-right">NRR</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const played = c.seasonWon + c.seasonLost + c.seasonTied;
              const mine = c.id === myId;
              const relegation = i >= sorted.length - 2 && sorted.length > 4;
              return (
                <tr
                  key={c.id}
                  className={`border-t border-white/5 transition-colors ${
                    mine ? "bg-pitch-600/15" : "hover:bg-white/5"
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      {MEDALS[i] ? (
                        <span className="text-base leading-none">{MEDALS[i]}</span>
                      ) : (
                        <span className="text-slate-500 w-4 text-center">{i + 1}</span>
                      )}
                      {relegation && <ChevronDown size={13} className="text-red-400" />}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={mine ? "text-pitch-400 font-bold" : "text-white"}>
                      {c.name}
                    </span>
                    {mine && (
                      <span className="stat-pill bg-blue-500/20 text-blue-300 ml-2">you</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-400">{played}</td>
                  <td className="px-3 py-2.5 text-center text-pitch-400 font-medium">{c.seasonWon}</td>
                  <td className="px-3 py-2.5 text-center text-red-300/80">{c.seasonLost}</td>
                  <td className="px-3 py-2.5 text-center text-slate-400">{c.seasonTied}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-white">{c.seasonPoints}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${nrr(c) >= 0 ? "text-slate-300" : "text-red-300/80"}`}>
                    {nrr(c) >= 0 ? "+" : ""}{nrr(c).toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-white/5 flex items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">🥇 Promotion places</span>
          <span className="flex items-center gap-1"><ChevronDown size={12} className="text-red-400" /> Relegation zone</span>
        </div>
      </div>
    </div>
  );
}
