import { useGame } from "../store/gameStore";
import { skillIndex } from "@engine/engine/ability.ts";
import { SkillBar } from "../ui/SkillBar";
import { money, roleEmoji } from "../ui/format";
import { Search, MapPin, Check, X, Sparkles } from "lucide-react";

export function Scout() {
  const club = useGame((s) => s.view!.club);
  const pendingScout = useGame((s) => s.view!.pendingScout);
  const scout = useGame((s) => s.scout);

  const youth = pendingScout;
  const fee = youth ? Math.round(80_000 * (1 + (20 - youth.age) * 0.15)) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto rise">
      <h1 className="title-xl text-5xl flex items-center gap-3">
        <Search className="text-pitch-500" size={34} /> YOUTH SCOUT
      </h1>
      <p className="text-slate-400 mt-1 flex items-center gap-1.5">
        <MapPin size={14} className="text-pitch-500" />
        Scouting in <b className="text-slate-200">{club.scoutCountry}</b> · a new prospect
        is offered each week — gems are rare.
      </p>

      {!youth ? (
        <div className="mt-6 card p-6">
          <div className="text-center py-12 text-slate-500">
            <Search className="mx-auto mb-3 opacity-40" size={32} />
            No prospect right now. Play a week — your scout will bring someone in.
          </div>
        </div>
      ) : (
        <div className="mt-6 card card-hover overflow-hidden">
          {/* Hero header */}
          <div
            className="relative px-6 py-6"
            style={{ background: "linear-gradient(110deg, rgba(34,197,94,0.18), rgba(8,12,20,0) 65%)" }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-16 h-16 rounded-2xl bg-pitch-600/20 grid place-items-center text-4xl">
                {roleEmoji(youth.role)}
              </div>
              <div className="min-w-0">
                <div className="text-pitch-400 text-[11px] font-semibold tracking-widest uppercase flex items-center gap-1">
                  <Sparkles size={12} /> Scouting Report
                </div>
                <h3 className="title-xl text-4xl leading-none mt-0.5">{youth.name}</h3>
                <p className="text-xs text-slate-400 capitalize mt-1">
                  {youth.role} · age {youth.age} · {youth.bowlerType} · {youth.battingHand}
                </p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Skill Index</div>
                <div className="font-display text-4xl text-white leading-none">
                  {skillIndex(youth.skills).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 pt-5">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              <SkillBar label="Bat v Seam" value={youth.skills.batVsSeam} />
              <SkillBar label="Bat v Spin" value={youth.skills.batVsSpin} />
              <SkillBar label="Bowl Main" value={youth.skills.bowlMain} />
              <SkillBar label="Bowl Var" value={youth.skills.bowlVariation} />
              <SkillBar label="Fielding" value={youth.skills.fielding} />
              <SkillBar label="Keeping" value={youth.skills.wicketkeeping} />
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
              <SkillBar label="Potential" value={youth.potential} />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => void scout(true)}
                disabled={club.balance < fee}
                className="btn btn-primary flex-1"
              >
                <Check size={16} /> Sign for {money(fee)}
              </button>
              <button
                onClick={() => void scout(false)}
                className="btn btn-ghost"
              >
                <X size={16} /> Reject
              </button>
            </div>
            {club.balance < fee && (
              <p className="mt-2 text-xs text-red-400">Not enough funds to sign this player.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
