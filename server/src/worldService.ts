/**
 * Server-authoritative world service. ALL game logic runs here, never on the
 * client. The browser sends action requests; this validates and applies them,
 * then persists to Supabase. Supabase is the single source of truth.
 *
 * An in-memory cache of the world is kept for speed; every mutation is written
 * back to the DB so a restart resumes exactly where it left off.
 */
import { SupabaseStore } from "../../src/world/supabaseStore.js";
import { requireSupabaseConfig } from "../../src/world/config.js";
import { createWorld } from "../../src/world/createWorld.js";
import { tick } from "../../src/world/tick.js";
import { buildSchedule } from "../../src/league/season.js";
import { combineSeeds } from "../../src/engine/rng.js";
import { createHumanClub, findClubByUser } from "../../src/world/onboarding.js";
import { selectOrders, derivePersonality } from "../../src/ai/manager.js";
import type { GameWorld, Club } from "../../src/world/state.js";
import type { Player, MatchOrders, MatchResult } from "../../src/engine/types.js";

const SEED = 2025;

/** Auto-tick config: one game-week per real interval. */
export const AUTO_TICK = process.env.AUTO_TICK !== "off";
export const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS ?? 24 * 60 * 60 * 1000); // default 1 day

export class WorldService {
  private store: SupabaseStore;
  private world: GameWorld | null = null;
  private loading: Promise<void> | null = null;
  public nextTickAt: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.store = new SupabaseStore(requireSupabaseConfig());
  }

  /** Start the automatic game clock: one tick (game-week) per interval. */
  startScheduler(): void {
    if (!AUTO_TICK || this.timer) return;
    this.nextTickAt = Date.now() + TICK_INTERVAL_MS;
    this.timer = setInterval(() => {
      this.runTick(1)
        .then((r) => {
          this.nextTickAt = Date.now() + TICK_INTERVAL_MS;
          console.log(`⏱️  Auto-tick → week ${r.week} (${r.results.length} matches)`);
        })
        .catch((e) => console.error("Auto-tick failed:", e));
    }, TICK_INTERVAL_MS);
    console.log(`⏱️  Scheduler on: 1 game-week every ${(TICK_INTERVAL_MS / 1000).toFixed(0)}s`);
  }

  /** Load (or create) the world once; subsequent calls reuse the cache. */
  async ready(): Promise<GameWorld> {
    if (this.world) return this.world;
    if (!this.loading) {
      this.loading = (async () => {
        let w = await this.store.load();
        if (!w) {
          w = createWorld({ seed: SEED, clubsPerLeague: 10, divisions: 3 });
          await this.store.save(w);
        }
        this.world = w;
      })();
    }
    await this.loading;
    return this.world!;
  }

  private async save(): Promise<void> {
    if (this.world) await this.store.save(this.world);
  }

  /* ----------------------- read APIs ----------------------- */

  async snapshot() {
    const w = await this.ready();
    return {
      week: w.week,
      clubs: Object.values(w.clubs).map(publicClub),
      leagues: Object.values(w.leagues),
    };
  }

  async clubView(clubId: string) {
    const w = await this.ready();
    const club = w.clubs[clubId];
    if (!club) return null;
    return {
      club: publicClub(club),
      players: club.squadPlayerIds.map((id) => w.players[id]).filter(Boolean),
      pendingScout: club.pendingScoutPlayerId ? w.players[club.pendingScoutPlayerId] : null,
    };
  }

  async leagueTable(leagueId: string) {
    const w = await this.ready();
    return Object.values(w.clubs)
      .filter((c) => c.leagueId === leagueId)
      .map(publicClub)
      .sort((a, b) => b.seasonPoints - a.seasonPoints);
  }

  async auctions() {
    const w = await this.ready();
    return Object.values(w.auctions)
      .filter((a) => a.status === "open")
      .map((a) => ({ ...a, player: w.players[a.playerId] }));
  }

  async log(limit = 50) {
    const w = await this.ready();
    return w.log.slice(-limit).reverse();
  }

  /** Hall of Fame — retired legends, sorted by career impact. */
  async hallOfFame(limit = 100) {
    const w = await this.ready();
    return [...w.hallOfFame]
      .sort((a, b) =>
        (b.career.runs + b.career.wickets * 20 + b.career.titlesWon * 200) -
        (a.career.runs + a.career.wickets * 20 + a.career.titlesWon * 200),
      )
      .slice(0, limit);
  }

  /** All-time leaders among ACTIVE players (records board). */
  async records() {
    const w = await this.ready();
    const withCareer = Object.values(w.players).filter((p) => p.career && p.career.matches > 0);
    const top = (key: (c: NonNullable<(typeof withCareer)[number]["career"]>) => number, n = 5) =>
      [...withCareer]
        .sort((a, b) => key(b.career!) - key(a.career!))
        .slice(0, n)
        .map((p) => ({ id: p.id, name: p.name, age: p.age, career: p.career }));
    return {
      runs: top((c) => c.runs),
      wickets: top((c) => c.wickets),
      titles: top((c) => c.titlesWon),
      mom: top((c) => c.manOfTheMatch),
    };
  }

  /**
   * Fixtures for a club's league this season: who plays whom each round,
   * with results for rounds already played and "upcoming" for future rounds.
   */
  async clubFixtures(clubId: string) {
    const w = await this.ready();
    const club = w.clubs[clubId];
    if (!club || !club.leagueId) return [];
    const league = w.leagues[club.leagueId];
    if (!league) return [];

    const n = league.clubIds.length;
    const roundsTotal = (n - 1) * 2;
    const seasonStartWeek = Math.floor(w.week / roundsTotal) * roundsTotal;
    const schedule = buildSchedule(
      league.clubIds.map((id) => ({ id, name: w.clubs[id]?.name ?? id, isAI: true, squad: [] })),
      combineSeeds(w.seed, seasonStartWeek),
    );

    const currentRound = w.week % roundsTotal;
    const nameOf = (id: string) => w.clubs[id]?.name ?? "(unknown)";

    return schedule
      .filter((fx) => fx.homeId === clubId || fx.awayId === clubId)
      .map((fx) => {
        const isHome = fx.homeId === clubId;
        const oppId = isHome ? fx.awayId : fx.homeId;
        const weekOfRound = seasonStartWeek + fx.round;
        return {
          round: fx.round,
          week: weekOfRound,
          opponentId: oppId,
          opponentName: nameOf(oppId),
          home: isHome,
          pitch: fx.pitch,
          status: fx.round < currentRound ? "played" : fx.round === currentRound ? "next" : "upcoming",
        };
      })
      .sort((a, b) => a.round - b.round);
  }

  /** Tick scheduling info for the UI countdown. */
  schedule() {
    return {
      week: this.world?.week ?? 0,
      tickIntervalMs: TICK_INTERVAL_MS,
      nextTickAt: this.nextTickAt,
      autoTick: AUTO_TICK,
    };
  }

  /* ----------------------- player identity ----------------------- */

  async clubForUser(userId: string): Promise<string | null> {
    const w = await this.ready();
    return findClubByUser(w, userId)?.id ?? null;
  }

  async createClubForUser(userId: string, name: string, crest?: import("../../src/world/state.js").ClubCrest): Promise<string> {
    const w = await this.ready();
    const existing = findClubByUser(w, userId);
    if (existing) return existing.id;
    const { club } = createHumanClub(w, { userId, clubName: name, crest });
    await this.save();
    return club.id;
  }

  /* ----------------------- mutating actions ----------------------- */
  /** Every action verifies the user owns the club before applying. */

  private async ownedClub(userId: string, clubId: string): Promise<Club> {
    const w = await this.ready();
    const club = w.clubs[clubId];
    if (!club) throw new HttpError(404, "Club not found");
    if (club.ownerUserId !== userId) throw new HttpError(403, "Not your club");
    return club;
  }

  async setTraining(userId: string, clubId: string, focus: Club["trainingFocus"]) {
    const club = await this.ownedClub(userId, clubId);
    club.trainingFocus = focus;
    await this.save();
  }

  async setPitch(userId: string, clubId: string, pitch: Club["pitchType"]) {
    const club = await this.ownedClub(userId, clubId);
    club.pitchType = pitch;
    await this.save();
  }

  async saveLineup(userId: string, clubId: string, orders: MatchOrders) {
    const club = await this.ownedClub(userId, clubId);
    club.savedOrders = orders;
    await this.save();
  }

  async autoLineup(userId: string, clubId: string): Promise<MatchOrders> {
    const club = await this.ownedClub(userId, clubId);
    const w = this.world!;
    const players = club.squadPlayerIds.map((id) => w.players[id]).filter((p): p is Player => !!p);
    return selectOrders(players, { personality: derivePersonality(clubId), matchSeed: Math.floor(Math.random() * 1e9) });
  }

  async scoutDecision(userId: string, clubId: string, sign: boolean) {
    const club = await this.ownedClub(userId, clubId);
    const w = this.world!;
    if (!club.pendingScoutPlayerId) return;
    const youth = w.players[club.pendingScoutPlayerId];
    if (!youth) { club.pendingScoutPlayerId = null; await this.save(); return; }
    if (sign) {
      const fee = Math.round(80_000 * (1 + (20 - youth.age) * 0.15));
      if (club.balance >= fee) {
        club.balance -= fee;
        club.squadPlayerIds.push(youth.id);
        club.reputationPoints += 3;
      }
    } else {
      delete w.players[youth.id];
    }
    club.pendingScoutPlayerId = null;
    await this.save();
  }

  async listPlayer(userId: string, clubId: string, playerId: string, askingPrice: number) {
    const club = await this.ownedClub(userId, clubId);
    const w = this.world!;
    if (!club.squadPlayerIds.includes(playerId)) throw new HttpError(400, "Player not in squad");
    const already = Object.values(w.auctions).some((a) => a.status === "open" && a.playerId === playerId);
    if (already) return;
    const player = w.players[playerId]!;
    const acq = player as Player & { _acqWeek?: number; _acqPrice?: number };
    const id = `au_h${w.week}_${Math.random().toString(36).slice(2, 7)}`;
    w.auctions[id] = {
      id, playerId, sellerClubId: clubId, askingPrice,
      currentBid: 0, currentBidderClubId: null, closesOnWeek: w.week + 1,
      sellerAcquiredWeek: acq._acqWeek ?? 0,
      sellerAcquiredPrice: acq._acqPrice ?? Math.round(askingPrice * 0.5),
      status: "open",
    };
    await this.save();
  }

  async placeBid(userId: string, clubId: string, auctionId: string, amount: number) {
    const club = await this.ownedClub(userId, clubId);
    const w = this.world!;
    const listing = w.auctions[auctionId];
    if (!listing || listing.status !== "open") throw new HttpError(400, "Listing closed");
    if (listing.sellerClubId === clubId) throw new HttpError(400, "Can't bid on your own listing");
    const minBid = Math.max(listing.askingPrice, listing.currentBid + 10_000);
    if (amount < minBid) throw new HttpError(400, "Bid too low");
    if (club.balance < amount) throw new HttpError(400, "Insufficient funds");
    listing.currentBid = amount;
    listing.currentBidderClubId = clubId;
    listing.closesOnWeek = Math.max(listing.closesOnWeek, w.week + 1);
    await this.save();
  }

  async firePlayer(userId: string, clubId: string, playerId: string) {
    const club = await this.ownedClub(userId, clubId);
    const w = this.world!;
    if (club.squadPlayerIds.length <= 11) throw new HttpError(400, "Need at least 11 players");
    club.squadPlayerIds = club.squadPlayerIds.filter((id) => id !== playerId);
    if (club.savedOrders) {
      const inUse = club.savedOrders.battingOrder.includes(playerId) || club.savedOrders.bowlingOrder.includes(playerId);
      if (inUse) club.savedOrders = null;
    }
    delete w.players[playerId];
    await this.save();
  }

  async upgradeStadium(userId: string, clubId: string, seats: number) {
    const club = await this.ownedClub(userId, clubId);
    const cost = Math.abs(seats) * 50;
    if (seats > 0 && club.balance < cost) throw new HttpError(400, "Insufficient funds");
    club.balance -= cost;
    club.stadiumSeats = Math.max(2000, club.stadiumSeats + seats);
    await this.save();
  }

  async upgradeFacility(userId: string, clubId: string) {
    const club = await this.ownedClub(userId, clubId);
    if (club.trainingFacilityLevel >= 10) return;
    const cost = club.trainingFacilityLevel * 500_000;
    if (club.balance < cost) throw new HttpError(400, "Insufficient funds");
    club.balance -= cost;
    club.trainingFacilityLevel += 1;
    club.reputationPoints += 8;
    await this.save();
  }

  /* ----------------------- the world tick ----------------------- */
  /** Most recent match per human club, for the live viewer. */
  private lastMatchByClub = new Map<string, MatchResult>();
  /** When each match started (wall clock) for time-synced playback. */
  private matchStartAt = new Map<string, number>();

  /** Advances the shared world one (or more) weeks. Server-only. */
  async runTick(weeks = 1): Promise<{ week: number; results: MatchResult[] }> {
    const w = await this.ready();
    let last: MatchResult[] = [];
    for (let i = 0; i < weeks; i++) last = tick(w).results;

    // Capture each human club's latest match + start time for the live viewer.
    const startedAt = Date.now();
    for (const result of last) {
      for (const teamId of [result.innings[0].battingTeamId, result.innings[0].bowlingTeamId]) {
        const club = w.clubs[teamId];
        if (club?.managerType === "human") {
          this.lastMatchByClub.set(teamId, result);
          this.matchStartAt.set(teamId, startedAt);
        }
      }
    }

    await this.save();
    return { week: w.week, results: last };
  }

  /** The viewable latest match for a club + when it started (for live sync). */
  liveMatch(clubId: string): { match: MatchResult; startedAt: number } | null {
    const match = this.lastMatchByClub.get(clubId);
    const startedAt = this.matchStartAt.get(clubId);
    if (!match || startedAt === undefined) return null;
    return { match, startedAt };
  }

  /** Return the human club's most recent match (for the live viewer). */
  async lastMatchFor(clubId: string, results: MatchResult[]): Promise<MatchResult | null> {
    return (
      results.find(
        (r) => r.innings[0].battingTeamId === clubId || r.innings[0].bowlingTeamId === clubId,
      ) ?? null
    );
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function publicClub(c: Club) {
  return {
    id: c.id, name: c.name, managerType: c.managerType, ownerUserId: c.ownerUserId,
    balance: c.balance, stadiumSeats: c.stadiumSeats, pitchType: c.pitchType,
    fanClub: c.fanClub, divisionTier: c.divisionTier, leagueId: c.leagueId,
    reputationPoints: c.reputationPoints, trainingFocus: c.trainingFocus,
    trainingFacilityLevel: c.trainingFacilityLevel, scoutCountry: c.scoutCountry,
    seasonWon: c.seasonWon, seasonLost: c.seasonLost, seasonTied: c.seasonTied,
    seasonPoints: c.seasonPoints, seasonRunsFor: c.seasonRunsFor,
    seasonBallsFor: c.seasonBallsFor, seasonRunsAgainst: c.seasonRunsAgainst,
    seasonBallsAgainst: c.seasonBallsAgainst,
    savedOrders: c.savedOrders, squadPlayerIds: c.squadPlayerIds,
    pendingScoutPlayerId: c.pendingScoutPlayerId, crest: c.crest,
  };
}
