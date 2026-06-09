import { useGame } from "../store/gameStore";
import { money } from "../ui/format";
import { reputationStatus, featureUnlocks } from "@engine/world/reputation.ts";
import type { Club } from "@engine/world/state.ts";
import {
  Building2, Coins, Heart, Users, Trophy, MapPin, Dumbbell, Plus, Minus, Check,
} from "lucide-react";

const PITCHES: { key: Club["pitchType"]; label: string; desc: string; emoji: string }[] = [
  { key: "sporting", label: "Sporting", desc: "Balanced between bat and ball.", emoji: "⚖️" },
  { key: "green", label: "Green", desc: "Boosts your seam bowlers.", emoji: "🌱" },
  { key: "crumbling", label: "Crumbling", desc: "Boosts your spin bowlers.", emoji: "🏜️" },
  { key: "flat", label: "Flat", desc: "Boosts batsmen — high scores.", emoji: "🏏" },
];

export function ClubPage() {
  const club = useGame((s) => s.view!.club);
  const setPitch = useGame((s) => s.setPitch);
  const upgradeStadium = useGame((s) => s.upgradeStadium);
  const upgradeFacility = useGame((s) => s.upgradeFacility);
  const unlocks = featureUnlocks(club.reputationPoints);
  const rep = reputationStatus(club.reputationPoints);
  const facilityCost = club.trainingFacilityLevel * 500_000;

  return (
    <div className="p-6 max-w-4xl mx-auto rise">
      <h1 className="title-xl text-5xl flex items-center gap-3">
        <Building2 className="text-pitch-500" size={34} /> CLUB
      </h1>
      <p className="text-slate-400 mt-1">{club.name} · Division {club.divisionTier} · {rep.level}</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Info icon={<Coins />} label="Balance" value={money(club.balance)} tone={club.balance >= 0 ? "good" : "bad"} />
        <Info icon={<Heart />} label="Fan club" value={club.fanClub.toLocaleString()} />
        <Info icon={<Users />} label="Stadium seats" value={club.stadiumSeats.toLocaleString()} />
        <Info icon={<Trophy />} label="Reputation" value={`${club.reputationPoints}`} />
        <Info icon={<MapPin />} label="Scout country" value={club.scoutCountry} />
        <Info icon={<Dumbbell />} label="Facility level" value={`Lv ${club.trainingFacilityLevel}`} />
      </div>

      {/* Stadium */}
      <div className="mt-6 card p-5">
        <h2 className="font-head text-lg text-white uppercase tracking-wide flex items-center gap-2">
          <Building2 size={18} className="text-pitch-500" /> Stadium
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Add seats to earn more from ticket sales (₹50/seat). Only expand if you fill it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1000, 2500, 5000].map((s) => (
            <button
              key={s}
              onClick={() => void upgradeStadium(s)}
              disabled={club.balance < s * 50}
              className="btn btn-primary text-sm"
            >
              <Plus size={15} /> {s.toLocaleString()} seats ({money(s * 50)})
            </button>
          ))}
          <button
            onClick={() => void upgradeStadium(-1000)}
            className="btn btn-ghost text-sm"
          >
            <Minus size={15} /> 1,000 seats
          </button>
        </div>
      </div>

      {/* Training facility */}
      <div className="mt-4 card p-5">
        <h2 className="font-head text-lg text-white uppercase tracking-wide flex items-center gap-2">
          <Dumbbell size={18} className="text-pitch-500" /> Training Facility
          {!unlocks.stadiumUpgrade && <span className="stat-pill bg-white/10 text-slate-400">🔒 Reliable</span>}
        </h2>
        <p className="text-sm text-slate-400 mt-1">Higher levels train your players faster.</p>
        <div className="mt-3">
          <button
            onClick={() => void upgradeFacility()}
            disabled={club.trainingFacilityLevel >= 10 || club.balance < facilityCost}
            className="btn btn-primary text-sm"
          >
            {club.trainingFacilityLevel >= 10
              ? "Max level"
              : `Upgrade to Lv ${club.trainingFacilityLevel + 1} (${money(facilityCost)})`}
          </button>
        </div>
      </div>

      {/* Home pitch */}
      <div className="mt-4 card p-5">
        <h2 className="font-head text-lg text-white uppercase tracking-wide">Home pitch</h2>
        <p className="text-sm text-slate-400 mt-1">Tailor your pitch to your squad's strengths.</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {PITCHES.map((p) => {
            const active = club.pitchType === p.key;
            return (
              <button
                key={p.key}
                onClick={() => void setPitch(p.key)}
                className={`card card-hover text-left p-4 ${active ? "ring-2 ring-pitch-500" : ""}`}
                style={active ? { boxShadow: "0 0 24px -4px rgba(34,197,94,0.45)" } : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-white capitalize">
                    <span className="text-lg">{p.emoji}</span> {p.label}
                  </span>
                  {active && (
                    <span className="stat-pill bg-pitch-500/20 text-pitch-400">
                      <Check size={12} /> Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 border-t border-white/5 pt-5 text-xs text-slate-500">
        Progress saves automatically to the cloud.
      </div>
    </div>
  );
}

function Info({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="card card-hover p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wide">
        <span className="[&>svg]:w-4 [&>svg]:h-4 text-pitch-500">{icon}</span>{label}
      </div>
      <div className={`mt-1.5 text-lg font-bold capitalize ${tone === "bad" ? "text-red-400" : tone === "good" ? "text-pitch-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
