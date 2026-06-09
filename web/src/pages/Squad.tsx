import { useState } from "react";
import { useGame } from "../store/gameStore";
import { skillIndex } from "@engine/engine/ability.ts";
import type { Player } from "@engine/engine/types.ts";
import { SkillBar } from "../ui/SkillBar";
import { PlayerCard } from "../ui/PlayerCard";
import { Crest } from "../ui/Crest";
import { overall } from "../ui/ratings";
import { money, roleEmoji, tierLabel } from "../ui/format";
import { Users, Trash2, Activity, Zap, X } from "lucide-react";

export function Squad() {
  const club = useGame((s) => s.view!.club);
  const players = useGame((s) => s.view!.players);
  const [selected, setSelected] = useState<Player | null>(null);

  const sorted = [...players].sort((a, b) => overall(b) - overall(a));
  const squadOvr = Math.round(sorted.slice(0, 11).reduce((s, p) => s + overall(p), 0) / Math.min(11, players.length || 1));

  return (
    <div className="p-6 max-w-6xl mx-auto rise">
      {/* Club header with crest */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-5 flex items-center gap-4"
          style={{ background: "linear-gradient(110deg, rgba(34,197,94,0.14), transparent 65%)" }}>
          <Crest crest={club.crest} name={club.name} size={56} />
          <div className="flex-1">
            <h1 className="title-xl text-4xl leading-none">{club.name}</h1>
            <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
              <Users size={14} className="text-pitch-500" /> {players.length} players · Division {club.divisionTier}
            </p>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Squad OVR</div>
            <div className="font-display text-5xl text-pitch-400 leading-none">{squadOvr}</div>
          </div>
        </div>
      </div>

      {/* Player card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {sorted.map((p, i) => (
          <PlayerCard
            key={p.id}
            player={p}
            selected={selected?.id === p.id}
            badge={i === 0 ? "★ STAR" : p.age <= 19 ? "YOUTH" : undefined}
            onClick={() => setSelected(p)}
          />
        ))}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md h-full glass border-l border-white/10 overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
            <PlayerDetail key={selected.id} p={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerDetail({ p, onClose }: { p: Player; onClose: () => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 pr-8">
        <div className="w-14 h-14 rounded-xl bg-pitch-600/15 grid place-items-center text-3xl">{roleEmoji(p.role)}</div>
        <div className="min-w-0">
          <div className="font-display text-3xl text-pitch-400 leading-none">{overall(p)}</div>
          <h3 className="text-lg font-bold text-white truncate">{p.name}</h3>
          <p className="text-xs text-slate-500 capitalize">{p.role} · {p.bowlerType} · {p.battingHand}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini label="Age" value={`${p.age}`} />
        <Mini label="SI" value={skillIndex(p.skills).toLocaleString()} />
        <Mini label="Salary" value={money(p.salary)} />
      </div>

      {p.career && p.career.matches > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Mini label="Mat" value={`${p.career.matches}`} />
          <Mini label="Runs" value={`${p.career.runs}`} />
          <Mini label="Wkts" value={`${p.career.wickets}`} />
          <Mini label="🏆" value={`${p.career.titlesWon}`} />
        </div>
      )}

      <div className="mt-5">
        <div className="font-head text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
          <Zap size={12} className="text-pitch-500" /> Skills
        </div>
        <div className="space-y-2">
          <SkillBar label="Bat v Seam" value={p.skills.batVsSeam} />
          <SkillBar label="Bat v Spin" value={p.skills.batVsSpin} />
          <SkillBar label="Bowl Main" value={p.skills.bowlMain} />
          <SkillBar label="Bowl Var" value={p.skills.bowlVariation} />
          <SkillBar label="Fielding" value={p.skills.fielding} />
          <SkillBar label="Keeping" value={p.skills.wicketkeeping} />
        </div>
      </div>

      <div className="mt-5">
        <div className="font-head text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
          <Activity size={12} className="text-pitch-500" /> Condition
        </div>
        <div className="space-y-2">
          <SkillBar label="Fitness" value={p.fitness} />
          <SkillBar label="Form" value={p.form} />
          <SkillBar label="Experience" value={p.experience} />
          <SkillBar label="Potential" value={p.potential} />
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Class: <span className="text-slate-300 font-semibold">{tierLabel((p.skills.batVsSeam + p.skills.bowlMain) / 2)}</span>
      </p>
      <FireButton playerId={p.id} onClose={onClose} />
    </div>
  );
}

function FireButton({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const fire = useGame((s) => s.firePlayer);
  const players = useGame((s) => s.view!.players);
  if (players.length <= 11) return null;
  return (
    <button
      onClick={async () => {
        if (confirm("Release this player permanently? You get nothing back.")) { await fire(playerId); onClose(); }
      }}
      className="btn mt-4 w-full border border-red-500/30 text-red-400 hover:bg-red-500/10"
    >
      <Trash2 size={15} /> Release player
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-950/60 border border-white/5 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-white truncate">{value}</div>
    </div>
  );
}
