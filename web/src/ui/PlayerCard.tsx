import { motion } from "framer-motion";
import type { Player } from "@engine/engine/types.ts";
import { overall, cardTier, TIER_STYLE, roleShort } from "./ratings";

/** FIFA/FC-style player card. */
export function PlayerCard({
  player, onClick, selected, badge,
}: { player: Player; onClick?: () => void; selected?: boolean; badge?: string }) {
  const ovr = overall(player);
  const tier = cardTier(ovr);
  const st = TIER_STYLE[tier]!;
  const [first, ...rest] = player.name.split(" ");

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative w-full rounded-2xl p-3 text-left overflow-hidden"
      style={{
        background: st.bg,
        boxShadow: selected ? `0 0 0 2px ${st.ring}, 0 14px 30px -12px rgba(0,0,0,0.7)` : "0 10px 24px -14px rgba(0,0,0,0.7)",
        border: `1px solid ${st.ring}40`,
      }}
    >
      {/* foil sheen */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(120% 60% at 80% 0%, ${st.ring}, transparent 60%)` }} />

      {/* top row: OVR + role */}
      <div className="relative flex items-start justify-between">
        <div className="leading-none">
          <div className="font-display text-4xl" style={{ color: st.text }}>{ovr}</div>
          <div className="font-head text-[11px] tracking-widest" style={{ color: st.text }}>{roleShort(player.role)}</div>
          <div className="mt-1 text-[10px] text-white/60">{player.bowlerType === "seam" ? "Seam" : "Spin"} · {player.battingHand}</div>
        </div>
        {badge && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: st.ring, color: "#0b1020" }}>{badge}</span>
        )}
      </div>

      {/* player "portrait" — silhouette avatar */}
      <div className="relative my-1 flex justify-center">
        <Avatar tierRing={st.ring} />
      </div>

      {/* name */}
      <div className="relative text-center">
        <div className="text-[11px] text-white/70 leading-none">{first}</div>
        <div className="font-head text-white text-sm truncate leading-tight">{rest.join(" ") || first}</div>
      </div>

      {/* mini attributes */}
      <div className="relative mt-2 grid grid-cols-3 gap-1 text-center">
        <Mini label="BAT" v={Math.round((player.skills.batVsSeam + player.skills.batVsSpin) / 2)} c={st.text} />
        <Mini label="BWL" v={Math.round(player.skills.bowlMain * 0.4 + player.skills.bowlVariation * 0.6)} c={st.text} />
        <Mini label="FLD" v={Math.round(player.skills.fielding)} c={st.text} />
      </div>

      <div className="relative mt-1.5 flex items-center justify-between text-[10px] text-white/50">
        <span>Age {player.age}</span>
        <span>Fit {Math.round(player.fitness)}</span>
      </div>
    </motion.button>
  );
}

function Mini({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div>
      <div className="font-bold text-sm" style={{ color: c }}>{v}</div>
      <div className="text-[8px] tracking-widest text-white/50">{label}</div>
    </div>
  );
}

function Avatar({ tierRing }: { tierRing: string }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="26" fill="rgba(0,0,0,0.25)" stroke={tierRing} strokeWidth="1.5" opacity="0.6" />
      {/* head + shoulders silhouette */}
      <circle cx="28" cy="22" r="9" fill="rgba(255,255,255,0.85)" />
      <path d="M12 50 C12 38 20 34 28 34 C36 34 44 38 44 50 Z" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}
