import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../store/gameStore";
import { skillIndex } from "@engine/engine/ability.ts";
import { money, roleEmoji } from "../ui/format";
import {
  Coins, Users, Trophy, Heart, TrendingUp, Newspaper, Building2,
  Dumbbell, ChevronRight, Sparkles,
} from "lucide-react";

export function Dashboard() {
  const club = useGame((s) => s.view!.club);
  const players = useGame((s) => s.view!.players);
  const world = useGame((s) => s.world)!;
  const fetchLog = useGame((s) => s.fetchLog);

  const [log, setLog] = useState<{ week: number; message: string }[]>([]);
  useEffect(() => { void fetchLog().then(setLog); }, [fetchLog]);

  const ranked = [...players].sort((a, b) => skillIndex(b.skills) - skillIndex(a.skills));
  const squadSI = Math.round(
    ranked.slice(0, 11).reduce((s, p) => s + skillIndex(p.skills), 0) / Math.min(11, players.length || 1),
  );
  const played = club.seasonWon + club.seasonLost + club.seasonTied;
  const myLog = log.slice(-10).reverse();

  return (
    <div className="p-6 max-w-6xl mx-auto rise">
      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="relative px-7 py-6"
          style={{ background: "linear-gradient(110deg, rgba(34,197,94,0.18), rgba(8,12,20,0) 60%)" }}>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-pitch-400 text-xs font-semibold tracking-widest uppercase">Division {club.divisionTier}</div>
              <h1 className="title-xl text-6xl leading-none mt-1">{club.name}</h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-300">
                <span className="stat-pill bg-pitch-500/15 text-pitch-400">
                  {club.seasonWon}W · {club.seasonLost}L · {club.seasonTied}T
                </span>
                <span className="text-slate-500">{played} matches this season</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Squad rating</div>
              <div className="font-display text-5xl text-white leading-none">{squadSI.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon={<Coins />} label="Balance" value={money(club.balance)} tone={club.balance >= 0 ? "good" : "bad"} />
        <Tile icon={<Users />} label="Squad size" value={`${players.length}`} />
        <Tile icon={<Heart />} label="Fan club" value={club.fanClub.toLocaleString()} />
        <Tile icon={<Trophy />} label="Reputation" value={`${club.reputationPoints}`} />
      </div>

      {/* Quick actions */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Action to="/lineup" icon={<ClipboardIcon />} label="Set Lineup" desc="XI, captain, tactics" />
        <Action to="/training" icon={<Dumbbell size={18} />} label={`Training`} desc={club.trainingFocus} />
        <Action to="/scout" icon={<Sparkles size={18} />} label="Scout" desc="Find young talent" />
        <Action to="/club" icon={<Building2 size={18} />} label="Club" desc={`${club.stadiumSeats.toLocaleString()} seats · ${club.pitchType}`} />
      </div>

      {/* Bottom: key players + news */}
      <div className="mt-5 grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-head text-lg text-white mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-pitch-500" /> Star players
          </h3>
          <div className="space-y-1.5">
            {ranked.slice(0, 6).map((p, i) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
                <span className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center text-xs text-slate-600">{i + 1}</span>
                  <span>{roleEmoji(p.role)}</span>
                  <span className="text-slate-100">{p.name}</span>
                  <span className="text-xs text-slate-500">age {p.age}</span>
                  {p.career && p.career.titlesWon > 0 && (
                    <span className="stat-pill bg-yellow-500/15 text-yellow-400">🏆 {p.career.titlesWon}</span>
                  )}
                </span>
                <span className="text-slate-300 font-semibold text-sm">{skillIndex(p.skills).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <Link to="/squad" className="mt-3 inline-flex items-center gap-1 text-xs text-pitch-400 hover:underline">
            View full squad <ChevronRight size={13} />
          </Link>
        </div>

        <div className="card p-5">
          <h3 className="font-head text-lg text-white mb-3 flex items-center gap-2">
            <Newspaper size={16} className="text-pitch-500" /> Club news
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {myLog.length === 0 && <p className="text-sm text-slate-500">The season is about to begin…</p>}
            {myLog.map((e, i) => (
              <div key={i} className="text-sm text-slate-400 flex gap-2">
                <span className="text-[10px] text-slate-600 mt-0.5 shrink-0">W{e.week}</span>
                <span>{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="card card-hover p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wide">
        <span className="[&>svg]:w-4 [&>svg]:h-4 text-pitch-500">{icon}</span>{label}
      </div>
      <div className={`mt-1.5 text-2xl font-bold ${tone === "bad" ? "text-red-400" : tone === "good" ? "text-pitch-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function Action({ to, icon, label, desc }: { to: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <Link to={to} className="card card-hover p-4 group">
      <div className="flex items-center gap-2 text-pitch-400">{icon}<span className="font-semibold text-white">{label}</span></div>
      <div className="mt-1 text-xs text-slate-500 capitalize truncate">{desc}</div>
    </Link>
  );
}

function ClipboardIcon() {
  return <Trophy size={18} />;
}
