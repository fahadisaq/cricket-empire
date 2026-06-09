/**
 * Lineup editor — the core management action, Hitwicket-style.
 * Choose your XI, batting order, Captain (C), Wicketkeeper (WK), bowling order,
 * and powerplay overs. Saved orders override the AI in the match engine.
 */
import { useEffect, useMemo, useState } from "react";
import { useGame } from "../store/gameStore";
import { skillIndex } from "@engine/engine/ability.ts";
import { featureUnlocks } from "@engine/world/reputation.ts";
import type { Player, MatchOrders } from "@engine/engine/types.ts";
import { roleEmoji } from "../ui/format";
import {
  ChevronUp, ChevronDown, Crown, Hand, Save, Wand2, Check, AlertTriangle,
  ClipboardList, Users, Target, Flame, Lock, X,
} from "lucide-react";

export function Lineup() {
  const club = useGame((s) => s.view!.club);
  const players = useGame((s) => s.view!.players);
  const saveLineup = useGame((s) => s.saveLineup);
  const autoPick = useGame((s) => s.autoLineup);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const unlocks = featureUnlocks(club.reputationPoints);

  // Initialize from saved orders, else auto-pick from the server.
  const [orders, setOrders] = useState<MatchOrders | null>(() =>
    club.savedOrders ? structuredClone(club.savedOrders) : null,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (orders) return;
    let cancelled = false;
    void autoPick().then((o) => {
      if (!cancelled && o) {
        setOrders(o);
        setSaved(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [orders, autoPick]);

  if (!orders) {
    return (
      <div className="p-6 max-w-5xl mx-auto rise">
        <h1 className="title-xl text-5xl flex items-center gap-3">
          <ClipboardList className="text-pitch-500" size={34} /> LINEUP
        </h1>
        <div className="mt-6 card p-10 text-center text-slate-400">
          <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-pitch-500/30 border-t-pitch-500 animate-spin" />
          Loading your lineup…
        </div>
      </div>
    );
  }

  const xiSet = new Set(orders.battingOrder);
  const bench = players.filter((p) => !xiSet.has(p.id));

  function update(next: MatchOrders) {
    setOrders(next);
    setSaved(false);
  }

  function move(i: number, dir: -1 | 1) {
    const order = [...orders!.battingOrder];
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    update({ ...orders!, battingOrder: order });
  }

  function swapIn(benchId: string, xiIndex: number) {
    const order = [...orders!.battingOrder];
    const out = order[xiIndex]!;
    order[xiIndex] = benchId;
    let { keeperId, captainId, bowlingOrder } = orders!;
    if (keeperId === out) keeperId = benchId;
    if (captainId === out) captainId = benchId;
    bowlingOrder = bowlingOrder.map((id) => (id === out ? benchId : id));
    update({ ...orders!, battingOrder: order, keeperId, captainId, bowlingOrder });
  }

  function setCaptain(id: string) {
    update({ ...orders!, captainId: id });
  }
  function setKeeper(id: string) {
    update({ ...orders!, keeperId: id });
  }
  function toggleBowler(id: string) {
    const has = orders!.bowlingOrder.includes(id);
    const bowlingOrder = has
      ? orders!.bowlingOrder.filter((b) => b !== id)
      : [...orders!.bowlingOrder, id];
    update({ ...orders!, bowlingOrder });
  }
  function moveBowler(i: number, dir: -1 | 1) {
    const bo = [...orders!.bowlingOrder];
    const j = i + dir;
    if (j < 0 || j >= bo.length) return;
    [bo[i], bo[j]] = [bo[j]!, bo[i]!];
    update({ ...orders!, bowlingOrder: bo });
  }

  // Validation.
  const errors: string[] = [];
  if (orders.battingOrder.length !== 11) errors.push("Pick exactly 11 players.");
  if (!xiSet.has(orders.keeperId)) errors.push("Keeper must be in the XI.");
  if (!xiSet.has(orders.captainId)) errors.push("Captain must be in the XI.");
  const bowlersInXi = orders.bowlingOrder.filter((id) => xiSet.has(id));
  if (bowlersInXi.length < 5) errors.push("Choose at least 5 bowlers.");

  function doSave() {
    if (errors.length) return;
    void saveLineup(orders!).then(() => setSaved(true));
  }

  async function doAutoPick() {
    const o = await autoPick();
    if (o) update(o);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto rise">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-xl text-5xl flex items-center gap-3">
            <ClipboardList className="text-pitch-500" size={34} /> LINEUP
          </h1>
          <p className="text-slate-400 mt-1">Set your XI, order, captain, keeper, bowlers & powerplay.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void doAutoPick()} className="btn btn-ghost">
            <Wand2 size={16} /> Auto-pick
          </button>
          <button onClick={doSave} disabled={errors.length > 0} className="btn btn-primary">
            {saved ? <Check size={16} /> : <Save size={16} />} {saved ? "Saved" : "Save lineup"}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>{errors.join(" ")}</div>
        </div>
      )}

      <div className="mt-5 grid lg:grid-cols-2 gap-5">
        {/* Batting XI */}
        <div className="card p-5">
          <h3 className="font-head text-lg text-white uppercase tracking-wide flex items-center gap-2">
            <Users size={17} className="text-pitch-500" /> Batting order (XI)
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            Positions #1, #3, #5 get batting training. Mix left & right handers.
          </p>
          <div className="space-y-1.5">
            {orders.battingOrder.map((id, i) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <div key={id} className="flex items-center gap-2 rounded-lg bg-ink-950/50 border border-white/5 px-2.5 py-2 hover:border-white/10 transition-colors">
                  <span className="w-5 text-center text-xs font-bold text-pitch-500/80">{i + 1}</span>
                  <span className="text-base">{roleEmoji(p.role)}</span>
                  <span className="flex-1 text-sm text-white truncate">
                    {p.name}
                    <span className="ml-2 text-[10px] text-slate-500">{p.battingHand}</span>
                  </span>
                  {orders.captainId === id && <Badge color="yellow">C</Badge>}
                  {orders.keeperId === id && <Badge color="blue">WK</Badge>}
                  <button onClick={() => setCaptain(id)} title="Make captain"
                    className={`p-1 rounded ${orders.captainId === id ? "text-yellow-400" : "text-slate-500 hover:text-yellow-400"}`}>
                    <Crown size={14} />
                  </button>
                  <button onClick={() => setKeeper(id)} title="Make keeper"
                    className={`p-1 rounded ${orders.keeperId === id ? "text-blue-400" : "text-slate-500 hover:text-blue-400"}`}>
                    <Hand size={14} />
                  </button>
                  <button onClick={() => move(i, -1)} className="p-1 text-slate-500 hover:text-white"><ChevronUp size={14} /></button>
                  <button onClick={() => move(i, 1)} className="p-1 text-slate-500 hover:text-white"><ChevronDown size={14} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          {/* Bench */}
          <div className="card p-5">
            <h3 className="font-head text-lg text-white uppercase tracking-wide flex items-center gap-2">
              <Users size={17} className="text-pitch-500" /> Bench
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-3">Click a bench player, then a #slot to swap in.</p>
            <BenchSwap bench={bench} orders={orders} onSwap={swapIn} />
          </div>

          {/* Bowling order */}
          <div className="card p-5">
            <h3 className="font-head text-lg text-white uppercase tracking-wide flex items-center gap-2">
              <Target size={17} className="text-pitch-500" /> Bowling order
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-3">Pick ≥5 bowlers. Seamers get a new-ball boost. Max 4 overs each.</p>
            <div className="space-y-1.5">
              {orders.bowlingOrder.filter((id) => xiSet.has(id)).map((id, i) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-2 rounded-lg bg-ink-950/50 border border-white/5 px-2.5 py-2">
                    <span className="w-5 text-center text-xs font-bold text-pitch-500/80">{i + 1}</span>
                    <span className="flex-1 text-sm text-white truncate">
                      {p.name}
                      <span className="ml-2 text-[10px] text-slate-500">{p.bowlerType}</span>
                    </span>
                    <button onClick={() => moveBowler(i, -1)} className="p-1 text-slate-500 hover:text-white"><ChevronUp size={14} /></button>
                    <button onClick={() => moveBowler(i, 1)} className="p-1 text-slate-500 hover:text-white"><ChevronDown size={14} /></button>
                    <button onClick={() => toggleBowler(id)} className="p-1 text-red-400/70 hover:text-red-300"><X size={14} /></button>
                  </div>
                );
              })}
            </div>
            {/* Add bowlers from XI not already bowling */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {orders.battingOrder
                .filter((id) => !orders.bowlingOrder.includes(id))
                .map((id) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  return (
                    <button key={id} onClick={() => toggleBowler(id)}
                      className="text-xs rounded-full border border-white/10 px-2.5 py-1 text-slate-300 hover:bg-pitch-600/15 hover:border-pitch-500/40 hover:text-white transition-colors">
                      + {p.name.split(" ")[1] ?? p.name}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Powerplay */}
          <div className="card p-5">
            <h3 className="font-head text-lg text-white uppercase tracking-wide flex items-center gap-2">
              <Flame size={17} className="text-pitch-500" /> Powerplay (5 overs)
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-3">Force aggression: more boundaries, more risk.</p>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={15}
                value={orders.powerplayStartOver}
                onChange={(e) => update({ ...orders, powerplayStartOver: Number(e.target.value) })}
                className="flex-1 accent-pitch-500"
              />
              <span className="stat-pill bg-pitch-500/15 text-pitch-400 w-28 justify-center">
                Overs {orders.powerplayStartOver + 1}–{orders.powerplayStartOver + 5}
              </span>
            </div>
          </div>

          {/* Aim For Target (reputation gated) */}
          <div className="card p-5">
            <h3 className="font-head text-lg text-white uppercase tracking-wide flex items-center gap-2">
              <Target size={17} className="text-pitch-500" /> Aim For Target
              {!unlocks.aimForTarget && (
                <span className="stat-pill bg-white/10 text-slate-400"><Lock size={11} /> Brilliant</span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              When batting first, pace your innings toward a target score.
            </p>
            {unlocks.aimForTarget ? (
              <div className="flex items-center gap-3">
                <input
                  type="number" min={0} step={5}
                  placeholder="e.g. 180"
                  value={orders.aimForTarget ?? ""}
                  onChange={(e) =>
                    update({ ...orders, aimForTarget: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-32 rounded-lg bg-ink-950 border border-white/10 px-3 py-2 text-white outline-none focus:border-pitch-500"
                />
                <span className="text-xs text-slate-500">Leave blank to bat naturally.</span>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Reach <b>Brilliant</b> reputation to unlock target-based batting.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BenchSwap({
  bench, orders, onSwap,
}: { bench: Player[]; orders: MatchOrders; onSwap: (benchId: string, xiIndex: number) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  if (bench.length === 0) return <p className="text-xs text-slate-500">Everyone's in the XI.</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {bench.map((p) => (
          <button
            key={p.id}
            onClick={() => setPicked(picked === p.id ? null : p.id)}
            className={`text-xs rounded-lg px-2.5 py-1.5 border transition-colors ${
              picked === p.id ? "border-pitch-500 bg-pitch-600/20 text-white" : "border-white/10 text-slate-300 hover:bg-white/5"
            }`}
          >
            {roleEmoji(p.role)} {p.name} <span className="text-slate-500">SI {skillIndex(p.skills).toLocaleString()}</span>
          </button>
        ))}
      </div>
      {picked && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 w-full">Swap in for position:</span>
          {orders.battingOrder.map((_, i) => (
            <button key={i} onClick={() => { onSwap(picked, i); setPicked(null); }}
              className="w-8 h-8 rounded-lg bg-ink-950 border border-white/10 text-xs text-slate-300 hover:bg-pitch-600/20 hover:border-pitch-500/40 transition-colors">
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: "yellow" | "blue" }) {
  return (
    <span className={`stat-pill ${color === "yellow" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-300"}`}>
      {children}
    </span>
  );
}
