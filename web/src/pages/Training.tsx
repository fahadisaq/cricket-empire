import { useGame } from "../store/gameStore";
import type { TrainingFocus } from "@engine/world/state.ts";
import {
  Dumbbell, Check, Target, Crosshair, Sparkles, Shield, Hand, HeartPulse, Zap,
} from "lucide-react";

const FOCI: { key: TrainingFocus; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: "batting", label: "Batting", desc: "Improves both seam & spin batting evenly.", icon: <Target size={18} /> },
  { key: "battingSeam", label: "Batting vs Seam", desc: "Skews growth toward facing seamers.", icon: <Crosshair size={18} /> },
  { key: "battingSpin", label: "Batting vs Spin", desc: "Skews growth toward facing spinners.", icon: <Crosshair size={18} /> },
  { key: "bowlingSeam", label: "Bowling (Seam)", desc: "Develops your seam bowlers.", icon: <Zap size={18} /> },
  { key: "bowlingSpin", label: "Bowling (Spin)", desc: "Develops your spin bowlers.", icon: <Sparkles size={18} /> },
  { key: "bowlingVariation", label: "Bowling Variation", desc: "Trains all bowlers' variations.", icon: <Sparkles size={18} /> },
  { key: "fielding", label: "Fielding", desc: "Improves the whole XI's fielding.", icon: <Shield size={18} /> },
  { key: "keeping", label: "Wicketkeeping", desc: "Trains your keepers (max 2/week).", icon: <Hand size={18} /> },
  { key: "fitness", label: "Fitness", desc: "Boosts fitness of those who played.", icon: <HeartPulse size={18} /> },
];

export function Training() {
  const club = useGame((s) => s.view!.club);
  const setFocus = useGame((s) => s.setTrainingFocus);

  return (
    <div className="p-6 max-w-4xl mx-auto rise">
      <h1 className="title-xl text-5xl flex items-center gap-3">
        <Dumbbell className="text-pitch-500" size={36} /> TRAINING
      </h1>
      <p className="text-slate-400 mt-1 max-w-2xl">
        Pick one focus per week. Younger players improve faster; higher skills
        improve slower. Only players in your XI get trained.
      </p>

      <div className="mt-5 card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pitch-600/15 grid place-items-center text-pitch-400">
            <Dumbbell size={20} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Facility level</div>
            <div className="text-xl font-bold text-white">Lv {club.trainingFacilityLevel}</div>
          </div>
        </div>
        <div className="text-sm text-slate-400 max-w-xs text-right">
          Higher facilities = faster training (upgrade in the Club page).
        </div>
      </div>

      <h2 className="mt-6 font-head text-lg text-white uppercase tracking-wide">Weekly focus</h2>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FOCI.map((f) => {
          const active = club.trainingFocus === f.key;
          return (
            <button
              key={f.key}
              onClick={() => void setFocus(f.key)}
              className={`card card-hover text-left p-4 relative transition ${
                active ? "ring-2 ring-pitch-500" : ""
              }`}
              style={active ? { boxShadow: "0 0 24px -4px rgba(34,197,94,0.45)" } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className={`grid place-items-center w-10 h-10 rounded-xl ${active ? "bg-pitch-500/20 text-pitch-400" : "bg-white/5 text-slate-400"}`}>
                  {f.icon}
                </span>
                {active && (
                  <span className="stat-pill bg-pitch-500/20 text-pitch-400">
                    <Check size={12} /> Selected
                  </span>
                )}
              </div>
              <div className="mt-3 font-semibold text-white">{f.label}</div>
              <p className="mt-1 text-xs text-slate-400">{f.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
