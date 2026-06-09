import { useEffect, useMemo, useState } from "react";
import { useGame } from "../store/gameStore";
import { skillIndex } from "@engine/engine/ability.ts";
import { recommendedPrice } from "@engine/world/systems/auction.ts";
import type { Player } from "@engine/engine/types.ts";
import { money, roleEmoji } from "../ui/format";
import { Gavel, Tag, ShoppingCart, TrendingUp, CheckCircle2 } from "lucide-react";

interface AuctionView {
  id: string;
  playerId: string;
  sellerClubId: string | null;
  askingPrice: number;
  currentBid: number;
  currentBidderClubId: string | null;
  closesOnWeek: number;
  player?: Player;
}

export function Auction() {
  const world = useGame((s) => s.world)!;
  const club = useGame((s) => s.view!.club);
  const players = useGame((s) => s.view!.players);
  const bid = useGame((s) => s.bid);
  const listPlayer = useGame((s) => s.listPlayer);
  const fetchAuctions = useGame((s) => s.fetchAuctions);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [listings, setListings] = useState<AuctionView[]>([]);

  const refetch = () => void fetchAuctions().then(setListings);

  useEffect(() => {
    void fetchAuctions().then(setListings);
  }, [fetchAuctions]);

  // Map club id -> name for seller display (world snapshot has clubs: Club[]).
  const clubNames = useMemo(
    () => new Map(world.clubs.map((c) => [c.id, c.name])),
    [world.clubs],
  );

  return (
    <div className="p-6 max-w-6xl mx-auto rise">
      <h1 className="title-xl text-5xl flex items-center gap-3">
        <Gavel className="text-pitch-500" size={34} /> AUCTION HOUSE
      </h1>

      <div className="mt-4 inline-flex gap-1 p-1 rounded-xl bg-ink-950/60 border border-white/5">
        <TabBtn active={tab === "buy"} onClick={() => setTab("buy")}>
          <ShoppingCart size={15} /> Buy ({listings.length})
        </TabBtn>
        <TabBtn active={tab === "sell"} onClick={() => setTab("sell")}>
          <Tag size={15} /> Sell your players
        </TabBtn>
      </div>

      {tab === "buy" && (
        <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {listings.length === 0 && (
            <div className="card p-10 text-center text-slate-500 col-span-full">
              <Gavel className="mx-auto mb-3 opacity-40" size={28} />
              No open listings. Play weeks — clubs list surplus players regularly.
            </div>
          )}
          {listings.map((a) => {
            const p = a.player;
            if (!p) return null;
            const sellerName = a.sellerClubId ? clubNames.get(a.sellerClubId) ?? a.sellerClubId : null;
            const mineBid = a.currentBidderClubId === club.id;
            const minNext = Math.max(a.askingPrice, a.currentBid + 10_000);
            const canAfford = club.balance >= minNext;
            const isMine = a.sellerClubId === club.id;
            return (
              <div key={a.id} className="card card-hover p-4 flex flex-col">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-pitch-600/15 grid place-items-center text-xl">
                    {roleEmoji(p.role)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-500 capitalize">{p.role} · age {p.age} · {p.bowlerType}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">SI</div>
                    <div className="font-bold text-white">{skillIndex(p.skills).toLocaleString()}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm rounded-lg bg-ink-950/40 px-3 py-2">
                  <span className="text-slate-400 text-xs">{isMine ? "Your listing" : `From ${sellerName ?? "Free agent"}`}</span>
                  <span className="text-pitch-400 font-bold">
                    {a.currentBid > 0 ? money(a.currentBid) : `ask ${money(a.askingPrice)}`}
                  </span>
                </div>

                {mineBid && (
                  <div className="text-xs text-pitch-400 mt-2 flex items-center gap-1">
                    <CheckCircle2 size={13} /> You're the top bidder
                  </div>
                )}

                {!isMine && (
                  <button
                    onClick={() => void bid(a.id, minNext).then(refetch)}
                    disabled={!canAfford}
                    className="btn btn-primary text-sm mt-3 w-full"
                  >
                    <Gavel size={15} /> Bid {money(minNext)}
                  </button>
                )}
                <div className="text-[11px] text-slate-600 mt-2">Resolves week {a.closesOnWeek}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "sell" && (
        <div className="mt-5 card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-[11px] uppercase tracking-wider border-b border-white/5 font-head">
                <th className="text-left px-4 py-3">Player</th>
                <th className="px-3 py-3">Age</th>
                <th className="px-3 py-3">SI</th>
                <th className="px-3 py-3">Recommended</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {[...players]
                .sort((a, b) => skillIndex(a.skills) - skillIndex(b.skills))
                .map((p) => {
                  const listed = listings.some((a) => a.playerId === p.id);
                  const rec = recommendedPrice(p);
                  return (
                    <tr key={p.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2.5 text-white">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-lg">{roleEmoji(p.role)}</span> {p.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300">{p.age}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-white">{skillIndex(p.skills).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-center text-pitch-400 font-medium">{money(rec)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {listed ? (
                          <span className="stat-pill bg-pitch-500/15 text-pitch-400">
                            <CheckCircle2 size={12} /> Listed
                          </span>
                        ) : (
                          <button
                            onClick={() => void listPlayer(p.id, Math.round(rec * 0.7)).then(refetch)}
                            disabled={players.length <= 11}
                            className="btn btn-ghost text-xs py-1.5 px-3"
                          >
                            <Tag size={13} /> List for sale
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p className="px-4 py-3 border-t border-white/5 text-xs text-slate-500 flex items-start gap-2">
            <TrendingUp size={14} className="text-pitch-500 mt-0.5 shrink-0" />
            Listings resolve next week. If sold far above the recommended price, the
            Transfer Review Commission may withhold part of the fee.
          </p>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
        active ? "bg-pitch-600/20 text-pitch-400 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.3)]" : "text-slate-400 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
