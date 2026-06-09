/**
 * Game home screen — cinematic floodlit stadium with parallax depth, a live
 * mini-scoreboard, a batsman silhouette playing a shot, drifting particles and
 * a flying ball. Pure CSS/SVG — no external assets. Reacts to mouse for depth.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Play, ChevronRight, Radio } from "lucide-react";

export function Landing({ onEnter }: { onEnter: () => void }) {
  // Parallax: track mouse, feed springs.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 2);
      my.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  // Precompute fixed parallax layers (hooks must run unconditionally).
  const L = {
    stars: { x: useTransform(sx, (v) => v * 6), y: useTransform(sy, (v) => v * 6) },
    bowl: { x: useTransform(sx, (v) => v * 10), y: useTransform(sy, (v) => v * 10) },
    crowd: { x: useTransform(sx, (v) => v * 16), y: useTransform(sy, (v) => v * 16) },
    ground: { x: useTransform(sx, (v) => v * 24), y: useTransform(sy, (v) => v * 24) },
    bat: { x: useTransform(sx, (v) => v * 30), y: useTransform(sy, (v) => v * 30) },
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black select-none">
      {/* sky */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(180deg,#04060c 0%,#081024 40%,#0b2f1c 100%)",
      }} />

      {/* stars / far parallax */}
      <motion.div className="absolute inset-0 opacity-40" style={{ ...L.stars,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
        backgroundSize: "120px 120px" }} />

      {/* distant stadium bowl */}
      <motion.div className="absolute inset-x-0 top-0 h-[60%]" style={{ ...L.bowl,
        background: "radial-gradient(120% 100% at 50% 0%, rgba(48,72,130,0.55), transparent 62%)" }} />

      {/* crowd tiers */}
      <motion.div className="absolute inset-x-0 top-[6%] h-[42%]" style={L.crowd}>
        {[0, 1, 2].map((tier) => (
          <div key={tier} className="absolute inset-x-0" style={{
            top: `${tier * 11}%`, height: "12%",
            backgroundImage: "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1.4px)",
            backgroundSize: `${6 + tier * 2}px ${6 + tier * 2}px`,
            opacity: 0.5 - tier * 0.1,
            maskImage: "linear-gradient(180deg, black, transparent)",
            WebkitMaskImage: "linear-gradient(180deg, black, transparent)",
          }} />
        ))}
      </motion.div>

      {/* floodlights */}
      <Floodlight side="left" />
      <Floodlight side="right" />

      {/* ground + pitch (near parallax) */}
      <motion.div className="absolute inset-x-0 bottom-0 h-[50%]" style={{ ...L.ground,
        background: "radial-gradient(85% 130% at 50% 125%, #239249 0%, #14592b 45%, #0a3017 80%, transparent 100%)" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute bottom-0 h-full" style={{
            left: `${i * 12.5}%`, width: "6.25%",
            background: i % 2 ? "rgba(255,255,255,0.05)" : "transparent" }} />
        ))}
        {/* pitch strip + crease */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-36 h-[78%]"
          style={{ background: "linear-gradient(180deg, rgba(214,198,150,0), rgba(200,180,128,0.9))",
            clipPath: "polygon(36% 0, 64% 0, 100% 100%, 0 100%)" }} />
        <div className="absolute left-1/2 bottom-[20%] -translate-x-1/2 w-24 h-px bg-white/50" />
      </motion.div>

      {/* batsman silhouette + shot */}
      <motion.div className="absolute left-1/2 bottom-[15%] z-20" style={L.bat}
        initial={{ x: "-50%" }}>
        <Batsman />
      </motion.div>

      {/* flying ball */}
      <motion.div className="absolute z-30"
        initial={{ left: "46%", top: "62%" }}
        animate={{ left: ["46%", "80%", "112%"], top: ["62%", "20%", "48%"], rotate: [0, 360, 720] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", repeatDelay: 2.6, times: [0, 0.5, 1] }}>
        <div className="relative w-5 h-5 rounded-full"
          style={{ background: "radial-gradient(circle at 35% 30%,#ff7b7b,#b91c1c)", boxShadow: "0 0 16px rgba(239,68,68,0.8)" }}>
          <div className="absolute inset-0 rounded-full border-t-2 border-white/50" />
        </div>
      </motion.div>

      {/* drifting particles */}
      <Particles />

      {/* live mini scoreboard (top-right) */}
      <MiniScore />

      {/* ===== content ===== */}
      <div className="relative z-40 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-pitch-400 tracking-[0.4em] text-xs font-semibold mb-3">
          <Radio size={12} className="live-dot" /> LIVE T20 MANAGEMENT
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 1.12, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.9 }}
          className="font-display leading-[0.8]" style={{ textShadow: "0 8px 50px rgba(0,0,0,0.85)" }}>
          <span className="block text-7xl sm:text-8xl md:text-9xl text-white">CRICKET</span>
          <span className="block text-7xl sm:text-8xl md:text-9xl"
            style={{ color: "#22c55e", textShadow: "0 0 50px rgba(34,197,94,0.7)" }}>EMPIRE</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-5 text-slate-300/90 max-w-lg">
          Own a club. Build legends. Rule the cricketing world.
        </motion.p>

        <motion.button onClick={onEnter}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
          className="mt-9 group relative inline-flex items-center gap-3 rounded-2xl px-14 py-5 font-display text-3xl tracking-wider text-white overflow-hidden"
          style={{ background: "linear-gradient(180deg,#22c55e,#15803d)", boxShadow: "0 12px 50px -8px rgba(34,197,94,0.85)" }}>
          {/* shine sweep */}
          <motion.span className="absolute inset-0 -skew-x-12"
            style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)" }}
            animate={{ x: ["-120%", "220%"] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5 }} />
          <Play size={26} className="fill-white relative z-10" />
          <span className="relative z-10">PLAY NOW</span>
        </motion.button>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="mt-5 flex items-center gap-2 text-xs text-slate-400">
          <span>Free to play</span><span className="text-slate-700">•</span>
          <span>Persistent online league</span><span className="text-slate-700">•</span>
          <span>Sign up in seconds</span>
        </motion.div>
      </div>

      <motion.button
        onClick={() => document.getElementById("learn")?.scrollIntoView({ behavior: "smooth" })}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 text-slate-400 hover:text-white flex flex-col items-center text-xs">
        <span>What is this game?</span>
        <motion.span animate={{ y: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>▾</motion.span>
      </motion.button>

      {/* learn section */}
      <section id="learn" className="relative z-40 bg-ink-950/96 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="title-xl text-5xl text-center">NOT JUST A CRICKET GAME</h2>
          <p className="text-center text-slate-400 mt-3 max-w-2xl mx-auto">
            You don't swing the bat — you run the club. Pick your XI, set tactics, train youth into
            superstars, win the transfer market, and climb a living division pyramid where every
            rival is a real manager or a smart AI playing by the same rules.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK.map((q, i) => (
              <motion.div key={q.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="card card-hover p-5 text-center">
                <div className="text-3xl">{q.e}</div>
                <div className="mt-2 font-head text-white">{q.t}</div>
                <div className="text-xs text-slate-400 mt-1">{q.d}</div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-12">
            <button onClick={onEnter} className="btn btn-primary text-lg px-8 py-4">
              Start your empire <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Floodlight({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div className={`absolute top-0 ${isLeft ? "left-[14%]" : "right-[14%]"} z-10`}>
      <div className="w-1 h-24 bg-slate-700/80 mx-auto" />
      <motion.div className="w-16 h-9 -mt-24 rounded bg-slate-800 grid grid-cols-4 gap-0.5 p-1"
        animate={{ filter: ["brightness(1)", "brightness(1.25)", "brightness(1)"] }}
        transition={{ duration: 3, repeat: Infinity, delay: isLeft ? 0 : 1.2 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-[1px]" style={{ background: "#fef9c3", boxShadow: "0 0 5px #fde68a" }} />
        ))}
      </motion.div>
      <div className="absolute top-9 left-1/2 -translate-x-1/2 w-44 h-[72vh] opacity-20"
        style={{ background: `linear-gradient(${isLeft ? "200deg" : "160deg"}, rgba(255,250,200,0.6), transparent 70%)`,
          clipPath: isLeft ? "polygon(40% 0,55% 0,100% 100%,0 100%)" : "polygon(45% 0,60% 0,100% 100%,0 100%)",
          filter: "blur(10px)" }} />
    </div>
  );
}

function Batsman() {
  return (
    <motion.svg width="90" height="150" viewBox="0 0 90 150" className="drop-shadow-2xl"
      animate={{ rotate: [0, -4, 8, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.6, times: [0, 0.35, 0.5, 1] }}
      style={{ originX: 0.5, originY: 1 }}>
      <g fill="#05140b" stroke="#0f3d22" strokeWidth="1">
        {/* legs */}
        <rect x="38" y="95" width="7" height="45" rx="3" />
        <rect x="47" y="95" width="7" height="45" rx="3" />
        {/* body */}
        <rect x="36" y="55" width="20" height="45" rx="8" />
        {/* head + helmet */}
        <circle cx="46" cy="44" r="11" />
        <rect x="34" y="40" width="12" height="6" rx="3" />
        {/* arms + bat (raised in a drive) */}
        <rect x="52" y="50" width="26" height="6" rx="3" transform="rotate(-35 52 50)" />
        <rect x="70" y="20" width="6" height="38" rx="3" transform="rotate(-30 70 20)" fill="#7a4a1e" />
      </g>
    </motion.svg>
  );
}

function Particles() {
  const items = useRef([...Array(18)].map(() => ({
    left: Math.random() * 100, dur: 6 + Math.random() * 8, delay: Math.random() * 6, size: 1 + Math.random() * 2,
  }))).current;
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {items.map((p, i) => (
        <motion.span key={i} className="absolute rounded-full bg-white/40"
          style={{ left: `${p.left}%`, bottom: -10, width: p.size, height: p.size }}
          animate={{ y: [-0, -700], opacity: [0, 0.7, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeOut" }} />
      ))}
    </div>
  );
}

function MiniScore() {
  const [s, setS] = useState({ runs: 142, wkts: 4, balls: 96 });
  useEffect(() => {
    const id = setInterval(() => {
      setS((p) => {
        const add = [0, 1, 1, 2, 4, 6][Math.floor(Math.random() * 6)] ?? 0;
        const out = Math.random() < 0.06 && p.wkts < 9;
        const balls = p.balls + 1;
        if (balls >= 120) return { runs: 142, wkts: 4, balls: 96 };
        return { runs: p.runs + add, wkts: p.wkts + (out ? 1 : 0), balls };
      });
    }, 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}
      className="absolute top-5 right-5 z-40 glass rounded-xl px-4 py-2 hidden sm:block">
      <div className="flex items-center gap-2 text-[10px] text-pitch-400 uppercase tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-dot" /> Live now
      </div>
      <div className="font-display text-2xl text-white leading-none mt-1">
        {s.runs}/{s.wkts} <span className="text-sm text-slate-400">({Math.floor(s.balls / 6)}.{s.balls % 6})</span>
      </div>
    </motion.div>
  );
}

const QUICK = [
  { e: "🧢", t: "Manage", d: "XI, order, captain, tactics" },
  { e: "🌱", t: "Develop", d: "Scout & train young talent" },
  { e: "💰", t: "Trade", d: "Auctions vs real rivals" },
  { e: "🏆", t: "Conquer", d: "Climb to the top division" },
];
