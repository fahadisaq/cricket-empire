/**
 * Auction system. AI clubs list surplus/ageing players and bid on listings that
 * fill a need. Implements the original's PTF (Previous Team Fee) and a simple
 * Transfer Review Commission cap on wildly inflated sales.
 *
 * Runs each tick: (1) resolve listings closing this week, (2) AI places new
 * listings, (3) AI places bids on open listings.
 */
import { RNG, combineSeeds } from "../../engine/rng.js";
import { skillIndex } from "../../engine/ability.js";
import type { Player } from "../../engine/types.js";
import type { GameWorld, Club, AuctionListing } from "../state.js";
import { pushLog } from "../state.js";

let auctionCounter = 0;

/** Recommended price from skill index + age (younger = pricier). */
export function recommendedPrice(p: Player): number {
  const si = skillIndex(p.skills);
  const ageMult = p.age <= 22 ? 1.4 : p.age <= 27 ? 1.0 : Math.max(0.4, 1 - (p.age - 27) * 0.08);
  return Math.round(si * 22 * ageMult);
}

/** Value a club places on acquiring a player (willingness to pay). */
function valuationFor(world: GameWorld, club: Club, p: Player): number {
  const rec = recommendedPrice(p);
  // Don't overspend relative to balance.
  const affordCap = club.balance * 0.5;
  return Math.min(rec * 1.2, affordCap);
}

function clubPlayers(world: GameWorld, club: Club): Player[] {
  return club.squadPlayerIds
    .map((id) => world.players[id])
    .filter((p): p is Player => !!p);
}

/** AI: which players a club is willing to sell (ageing & low SI, keeping depth). */
function surplusToSell(world: GameWorld, club: Club): Player[] {
  const players = clubPlayers(world, club);
  if (players.length <= 16) return [];
  return players
    .filter((p) => p.age > 29 && skillIndex(p.skills) < 14000)
    .slice(0, players.length - 16);
}

function resolveClosing(world: GameWorld): void {
  for (const listing of Object.values(world.auctions)) {
    if (listing.status !== "open") continue;
    if (world.week < listing.closesOnWeek) continue;

    const player = world.players[listing.playerId];
    if (!player) {
      listing.status = "unsold";
      continue;
    }

    if (!listing.currentBidderClubId || listing.currentBid <= 0) {
      listing.status = "unsold";
      continue;
    }

    const buyer = world.clubs[listing.currentBidderClubId];
    if (!buyer || buyer.balance < listing.currentBid) {
      listing.status = "unsold";
      continue;
    }

    // Transfer Review Commission: cap released amount if far above recommended.
    const rec = recommendedPrice(player);
    let releasedToSeller = listing.currentBid;
    if (listing.currentBid > rec * 2 && listing.sellerClubId) {
      releasedToSeller = Math.round(rec * 1.5);
    }

    // PTF: pay previous club a cut of profit (only if there's a profit & seller).
    let ptf = 0;
    if (listing.sellerClubId) {
      const profit = listing.currentBid - listing.sellerAcquiredPrice;
      if (profit > 0) {
        const daysHeld = (world.week - listing.sellerAcquiredWeek) * 7;
        const ptfPct = Math.max(0, 0.8 - daysHeld * 0.01); // 80% day0, -1%/day, 0 by ~80d
        ptf = Math.round(profit * ptfPct);
      }
    }

    // Move money.
    buyer.balance -= listing.currentBid;
    if (listing.sellerClubId) {
      const seller = world.clubs[listing.sellerClubId];
      if (seller) {
        seller.balance += Math.max(0, releasedToSeller - ptf);
        // Remove from seller squad.
        seller.squadPlayerIds = seller.squadPlayerIds.filter((id) => id !== player.id);
      }
    }

    // Add to buyer squad & record acquisition for future PTF.
    buyer.squadPlayerIds.push(player.id);
    listing.status = "sold";
    buyer.reputationPoints += 2;

    pushLog(
      world,
      "transfer",
      `${buyer.name} bought ${player.name} for ${listing.currentBid}` +
        (ptf > 0 ? ` (PTF ${ptf})` : ""),
      buyer.id,
    );

    // Stash acquisition info on the player record via a side map embedded in id?
    // Simpler: store on a world-level acquisitions registry.
    world.players[player.id] = player;
    (player as Player & { _acqWeek?: number; _acqPrice?: number })._acqWeek = world.week;
    (player as Player & { _acqWeek?: number; _acqPrice?: number })._acqPrice = listing.currentBid;
  }

  // Clean up resolved listings (keep recent for history feed).
  const open = Object.values(world.auctions).filter((l) => l.status === "open");
  if (Object.keys(world.auctions).length > open.length + 200) {
    world.auctions = {};
    for (const l of open) world.auctions[l.id] = l;
  }
}

function placeListings(world: GameWorld, rng: RNG): void {
  for (const club of Object.values(world.clubs)) {
    if (club.managerType !== "ai") continue;
    const surplus = surplusToSell(world, club);
    for (const p of surplus) {
      // Don't double-list.
      const already = Object.values(world.auctions).some(
        (l) => l.status === "open" && l.playerId === p.id,
      );
      if (already) continue;

      const rec = recommendedPrice(p);
      const acq = p as Player & { _acqWeek?: number; _acqPrice?: number };
      const listing: AuctionListing = {
        id: `au_${world.week}_${(auctionCounter++).toString(36)}`,
        playerId: p.id,
        sellerClubId: club.id,
        askingPrice: Math.round(rec * 0.6),
        currentBid: 0,
        currentBidderClubId: null,
        closesOnWeek: world.week + 1, // ~72h => next tick
        sellerAcquiredWeek: acq._acqWeek ?? 0,
        sellerAcquiredPrice: acq._acqPrice ?? Math.round(rec * 0.5),
        status: "open",
      };
      world.auctions[listing.id] = listing;
    }
  }
  void rng;
}

function placeBids(world: GameWorld, rng: RNG): void {
  const openListings = Object.values(world.auctions).filter((l) => l.status === "open");
  rng.shuffle(openListings);

  for (const listing of openListings) {
    const player = world.players[listing.playerId];
    if (!player) continue;

    // Each AI club considers bidding if it needs depth and can afford.
    const candidates = Object.values(world.clubs).filter(
      (c) =>
        c.managerType === "ai" &&
        c.id !== listing.sellerClubId &&
        c.squadPlayerIds.length < 20,
    );
    rng.shuffle(candidates);

    for (const club of candidates.slice(0, 4)) {
      const valuation = valuationFor(world, club, player);
      const minBid = Math.max(listing.askingPrice, listing.currentBid + 10_000);
      if (valuation >= minBid && club.balance > minBid + 100_000) {
        // Bid somewhere between minBid and valuation.
        const bid = Math.round(minBid + rng.float(0, 1) * (valuation - minBid));
        listing.currentBid = bid;
        listing.currentBidderClubId = club.id;
      }
    }
  }
}

export function runAuctions(world: GameWorld): void {
  const rng = new RNG(combineSeeds(world.seed, world.week, 303));
  resolveClosing(world);
  placeListings(world, rng);
  placeBids(world, rng);
}
