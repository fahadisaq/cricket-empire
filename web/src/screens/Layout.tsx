import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, ClipboardList, Dumbbell, Gavel, Trophy, Building2,
  Search, Coins, Heart, Star, LogOut, CalendarDays, Crown,
} from "lucide-react";
import { useGame } from "../store/gameStore";
import { useAuth } from "../store/authStore";
import { money } from "../ui/format";
import { Crest } from "../ui/Crest";
import { reputationStatus } from "@engine/world/reputation.ts";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/squad", label: "Squad", icon: Users },
  { to: "/lineup", label: "Lineup", icon: ClipboardList },
  { to: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { to: "/training", label: "Training", icon: Dumbbell },
  { to: "/scout", label: "Scout", icon: Search },
  { to: "/auction", label: "Transfers", icon: Gavel },
  { to: "/league", label: "League", icon: Trophy },
  { to: "/legends", label: "Legends", icon: Crown },
  { to: "/club", label: "Club", icon: Building2 },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const club = useGame((s) => s.view?.club);
  const world = useGame((s) => s.world);
  const refreshWorld = useGame((s) => s.refreshWorld);
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    void refreshWorld();
  }, [refreshWorld]);

  if (!club || !world) return null;
  const rep = reputationStatus(club.reputationPoints);

  return (
    <div className="min-h-screen flex">
      {/* ---------- Sidebar ---------- */}
      <aside className="w-64 shrink-0 glass border-r border-white/5 flex flex-col">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏏</span>
            <div>
              <div className="font-display text-2xl tracking-wide text-white leading-none">CRICKET</div>
              <div className="font-display text-2xl tracking-wide text-pitch-500 leading-none">EMPIRE</div>
            </div>
          </div>
        </div>

        {/* Club card */}
        <div className="px-4 pb-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{club.name}</div>
                <div className="text-[11px] text-slate-400">Division {club.divisionTier} · {rep.level}</div>
              </div>
              <Crest crest={club.crest} name={club.name} size={40} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-pitch-400 font-semibold">
                <Coins size={13} /> {money(club.balance)}
              </div>
              <div className="flex items-center gap-1 text-rose-300 font-semibold justify-end">
                <Heart size={13} /> {club.fanClub.toLocaleString()}
              </div>
            </div>
            {/* reputation bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span className="flex items-center gap-1"><Star size={10} /> {rep.level}</span>
                {rep.nextLevel && <span>{rep.nextLevel}</span>}
              </div>
              <div className="skillbar">
                <span style={{ width: `${Math.round(rep.progress * 100)}%`, background: "#22c55e", color: "#22c55e" }} />
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "nav-active text-pitch-400" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <header className="glass border-b border-white/5 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <CalendarDays size={16} className="text-pitch-500" />
            <span className="text-white font-semibold">Week {world.week}</span>
            <span className="text-slate-600">·</span>
            <span>Season {Math.floor(world.week / 18) + 1}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-pitch-500 live-dot" />
              {world.clubs.length} clubs · {world.leagues.length} leagues
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative"
          style={{ backgroundImage: "radial-gradient(900px 500px at 80% -5%, rgba(34,197,94,0.06), transparent 60%)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
