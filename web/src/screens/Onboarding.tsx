/**
 * First-time experience — modelled on Hitwicket's new-manager flow.
 * Steps: Welcome → Name your club → Meet your starter squad → Enter the game.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, ChevronRight, Sparkles, Building2, Shuffle } from "lucide-react";
import { useGame } from "../store/gameStore";
import { skillIndex } from "@engine/engine/ability.ts";
import type { ClubCrest } from "@engine/world/state.ts";
import { roleEmoji } from "../ui/format";
import { Crest } from "../ui/Crest";

const SHAPES: ClubCrest["shape"][] = ["shield", "circle", "diamond", "banner"];
const EMBLEMS: ClubCrest["emblem"][] = ["bats", "ball", "stumps", "lion", "star", "crown"];

export function Onboarding({ onDone, hasClub }: { onDone: () => void; hasClub: boolean }) {
  const [step, setStep] = useState(hasClub ? 2 : 0);
  const [clubName, setClubName] = useState("");
  const [creating, setCreating] = useState(false);
  const [crest, setCrest] = useState<ClubCrest>({
    shape: "shield", emblem: "bats", primaryHue: 150, secondaryHue: 280,
  });
  const createClub = useGame((s) => s.createClub);
  const view = useGame((s) => s.view);
  const myClubId = useGame((s) => s.myClubId);

  async function finishNaming() {
    if (creating) return;
    setCreating(true);
    await createClub(clubName, crest);
    setCreating(false);
    setStep(2);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-ink-950 via-ink-900 to-pitch-900/40">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card p-10 text-center"
            >
              <div className="text-6xl mb-4">🏏</div>
              <h1 className="font-display text-6xl tracking-wide text-white">
                CRICKET EMPIRE
              </h1>
              <p className="mt-2 text-pitch-500 font-semibold tracking-widest text-sm">
                T20 STRATEGY MANAGEMENT
              </p>
              <p className="mt-6 text-slate-300 leading-relaxed">
                You're not a player — you're the <b>manager and owner</b> of a
                T20 cricket club. Build your squad, train future superstars,
                outwit rivals with tactics, climb from the lower divisions to
                the top, and rule the cricketing world.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
                <Feature icon={<Users size={18} />} title="Manage" desc="Squad, lineups, tactics" />
                <Feature icon={<Sparkles size={18} />} title="Train" desc="Develop young talent" />
                <Feature icon={<Trophy size={18} />} title="Win" desc="Climb the divisions" />
              </div>
              <button
                onClick={() => setStep(1)}
                className="mt-9 inline-flex items-center gap-2 rounded-xl bg-pitch-600 hover:bg-pitch-500 px-7 py-3 font-semibold text-white transition"
              >
                Start your journey <ChevronRight size={18} />
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card p-8"
            >
              <Building2 className="text-pitch-500 mb-3" />
              <h2 className="font-display text-4xl text-white tracking-wide">CREATE YOUR CLUB</h2>
              <p className="mt-2 text-slate-400">Name your club and design its crest.</p>

              <div className="mt-6 flex gap-6 items-start flex-col sm:flex-row">
                {/* Live crest preview */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="p-4 rounded-2xl bg-ink-950/60 border border-white/10">
                    <Crest crest={crest} name={clubName || "Club"} size={120} />
                  </div>
                  <button
                    onClick={() => setCrest({
                      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)]!,
                      emblem: EMBLEMS[Math.floor(Math.random() * EMBLEMS.length)]!,
                      primaryHue: Math.floor(Math.random() * 360),
                      secondaryHue: Math.floor(Math.random() * 360),
                    })}
                    className="btn btn-ghost text-xs"
                  >
                    <Shuffle size={13} /> Randomize
                  </button>
                </div>

                {/* Controls */}
                <div className="flex-1 w-full space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Club name</label>
                    <input
                      autoFocus value={clubName} onChange={(e) => setClubName(e.target.value)}
                      placeholder="e.g. Royal Strikers" maxLength={24}
                      className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-3 text-lg text-white outline-none focus:border-pitch-500"
                    />
                  </div>

                  <Picker label="Shape" options={SHAPES} value={crest.shape}
                    onPick={(v) => setCrest({ ...crest, shape: v as ClubCrest["shape"] })} />
                  <Picker label="Emblem" options={EMBLEMS} value={crest.emblem}
                    onPick={(v) => setCrest({ ...crest, emblem: v as ClubCrest["emblem"] })}
                    labels={{ bats: "Bats", ball: "Ball", stumps: "Stumps", lion: "Lion 🦁", star: "Star ★", crown: "Crown 👑" }} />

                  <div className="grid grid-cols-2 gap-3">
                    <ColorPick label="Primary" hue={crest.primaryHue} onPick={(h) => setCrest({ ...crest, primaryHue: h })} />
                    <ColorPick label="Secondary" hue={crest.secondaryHue} onPick={(h) => setCrest({ ...crest, secondaryHue: h })} />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(0)} className="btn btn-ghost">Back</button>
                <button onClick={finishNaming} disabled={creating} className="btn btn-primary flex-1">
                  {creating ? "Creating…" : "Claim my club"}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                You'll start in the lowest division with a fresh squad — just like every great manager begins.
              </p>
            </motion.div>
          )}

          {step === 2 && myClubId && (
            <motion.div
              key="squad"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card p-8"
            >
              <h2 className="font-display text-4xl text-white tracking-wide">
                MEET YOUR SQUAD
              </h2>
              <p className="mt-1 text-slate-400">
                An average team with a few standouts — and one promising young
                <span className="text-pitch-400 font-semibold"> First Scout</span> to build around.
              </p>
              <div className="mt-5 max-h-72 overflow-y-auto pr-1 space-y-1">
                {(view?.players ?? [])
                  .map((p) => ({ p, si: skillIndex(p.skills) }))
                  .sort((a, b) => b.si - a.si)
                  .map(({ p, si }, i) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg bg-ink-950/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span>{roleEmoji(p.role)}</span>
                        <span className="text-sm text-white">{p.name}</span>
                        {i === 0 && (
                          <span className="stat-pill bg-yellow-500/20 text-yellow-400">star</span>
                        )}
                        {p.age <= 18 && (
                          <span className="stat-pill bg-pitch-500/20 text-pitch-400">youth</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>age {p.age}</span>
                        <span className="text-slate-300 font-semibold">SI {si.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
              </div>
              <button
                onClick={onDone}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-pitch-600 hover:bg-pitch-500 px-5 py-3 font-semibold text-white"
              >
                Enter the dressing room <ChevronRight size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-ink-950/50 p-3">
      <div className="text-pitch-500 flex justify-center">{icon}</div>
      <div className="mt-1 font-semibold text-white text-sm">{title}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </div>
  );
}

function Picker({ label, options, value, onPick, labels }: {
  label: string; options: readonly string[]; value: string;
  onPick: (v: string) => void; labels?: Record<string, string>;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} onClick={() => onPick(o)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize border transition ${
              value === o ? "border-pitch-500 bg-pitch-600/20 text-white" : "border-white/10 text-slate-300 hover:bg-white/5"
            }`}>
            {labels?.[o] ?? o}
          </button>
        ))}
      </div>
    </div>
  );
}

const HUES = [0, 25, 45, 90, 150, 175, 200, 230, 265, 300, 330];
function ColorPick({ label, hue, onPick }: { label: string; hue: number; onPick: (h: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {HUES.map((h) => (
          <button key={h} onClick={() => onPick(h)}
            className={`w-6 h-6 rounded-full border-2 transition ${hue === h ? "border-white scale-110" : "border-transparent"}`}
            style={{ background: `hsl(${h} 65% 46%)` }} />
        ))}
      </div>
    </div>
  );
}
