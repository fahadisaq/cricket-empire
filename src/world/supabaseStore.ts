/**
 * SupabaseStore — persists the whole GameWorld to Postgres via Supabase.
 * Implements the same `WorldStore` interface as JsonFileStore, so swapping it
 * in requires ZERO changes to engine / tick / AI logic.
 *
 * Strategy: load() reconstructs the world from the ce_ tables; save() upserts
 * the full state. For large worlds this is a bulk upsert per table inside the
 * service-role context (server only). Match history & logs are append-only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WorldStore } from "./store.js";
import type { GameWorld, Club, League, AuctionListing } from "./state.js";
import type { Player } from "../engine/types.js";
import type { SupabaseConfig } from "./config.js";

function isClient(arg: SupabaseConfig | SupabaseClient): arg is SupabaseClient {
  return typeof (arg as SupabaseClient).from === "function";
}

export class SupabaseStore implements WorldStore {
  private db: SupabaseClient;

  /** Accept either a config (server, service-role) or a ready client (browser). */
  constructor(arg: SupabaseConfig | SupabaseClient) {
    if (isClient(arg)) {
      this.db = arg;
    } else {
      // Service-role client: server-side only, bypasses RLS for the tick.
      this.db = createClient(arg.url, arg.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  async load(): Promise<GameWorld | null> {
    const { data: worldRow, error: wErr } = await this.db
      .from("ce_world")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!worldRow) return null;

    const [clubs, players, leagues, auctions, hof] = await Promise.all([
      fetchAll(this.db, "ce_clubs"),
      fetchAll(this.db, "ce_players"),
      fetchAll(this.db, "ce_leagues"),
      this.db.from("ce_auctions").select("*").eq("status", "open").then((r) => r.data ?? []),
      fetchAll(this.db, "ce_hall_of_fame"),
    ]);

    const world: GameWorld = {
      seed: Number(worldRow.seed),
      week: worldRow.week,
      players: {},
      clubs: {},
      leagues: {},
      auctions: {},
      hallOfFame: [],
      log: [],
    };

    for (const r of hof ?? []) {
      world.hallOfFame.push({
        id: r.id, name: r.name, role: r.role, bowlerType: r.bowler_type,
        battingHand: r.batting_hand, retiredAge: r.retired_age, retiredWeek: r.retired_week,
        debutWeek: r.debut_week, lastClubId: r.last_club_id, lastClubName: r.last_club_name,
        peakSkillIndex: r.peak_skill_index, career: r.career,
      });
    }

    for (const r of players ?? []) world.players[r.id] = rowToPlayer(r);
    for (const r of leagues ?? []) world.leagues[r.id] = rowToLeague(r);
    for (const r of clubs ?? []) {
      const club = rowToClub(r);
      // Rebuild squad list from player.club_id ownership.
      club.squadPlayerIds = (players ?? [])
        .filter((p) => p.club_id === r.id)
        .map((p) => p.id);
      world.clubs[r.id] = club;
      // Attach club to its league's clubIds.
      if (club.leagueId && world.leagues[club.leagueId]) {
        world.leagues[club.leagueId]!.clubIds.push(r.id);
      }
    }
    for (const r of auctions ?? []) world.auctions[r.id] = rowToAuction(r);

    return world;
  }

  async save(world: GameWorld): Promise<void> {
    // World meta.
    await this.db.from("ce_world").upsert({
      id: 1,
      seed: world.seed,
      week: world.week,
      updated_at: new Date().toISOString(),
    });

    // Leagues.
    const leagueRows = Object.values(world.leagues).map((l) => ({
      id: l.id,
      name: l.name,
      division_tier: l.divisionTier,
    }));
    if (leagueRows.length) await this.db.from("ce_leagues").upsert(leagueRows);

    // Clubs.
    const clubRows = Object.values(world.clubs).map(clubToRow);
    if (clubRows.length) await chunkedUpsert(this.db, "ce_clubs", clubRows);

    // Players (with club ownership).
    const playerRows: Record<string, unknown>[] = [];
    for (const club of Object.values(world.clubs)) {
      for (const pid of club.squadPlayerIds) {
        const p = world.players[pid];
        if (p) playerRows.push(playerToRow(p, club.id));
      }
    }
    // Free agents / listed players not on any squad.
    const owned = new Set(playerRows.map((r) => r.id));
    for (const p of Object.values(world.players)) {
      if (!owned.has(p.id)) playerRows.push(playerToRow(p, null));
    }
    if (playerRows.length) await chunkedUpsert(this.db, "ce_players", playerRows);

    // Open auctions.
    const auctionRows = Object.values(world.auctions)
      .filter((a) => a.status === "open")
      .map(auctionToRow);
    if (auctionRows.length) await chunkedUpsert(this.db, "ce_auctions", auctionRows);

    // Hall of Fame (append-only; upsert by id).
    if (world.hallOfFame.length) {
      const hofRows = world.hallOfFame.map((h) => ({
        id: h.id, name: h.name, role: h.role, bowler_type: h.bowlerType,
        batting_hand: h.battingHand, retired_age: h.retiredAge, retired_week: h.retiredWeek,
        debut_week: h.debutWeek, last_club_id: h.lastClubId, last_club_name: h.lastClubName,
        peak_skill_index: h.peakSkillIndex, career: h.career,
      }));
      await chunkedUpsert(this.db, "ce_hall_of_fame", hofRows);
    }

    // Append new world-log entries (best-effort feed).
    if (world.log.length) {
      const logRows = world.log.slice(-200).map((e) => ({
        week: e.week,
        type: e.type,
        club_id: e.clubId ?? null,
        message: e.message,
      }));
      await this.db.from("ce_world_log").insert(logRows);
      world.log = []; // flushed to DB
    }
  }
}

/** Fetch ALL rows from a table, paginating past Supabase's 1000-row cap. */
async function fetchAll(db: SupabaseClient, table: string): Promise<Record<string, any>[]> {
  const PAGE = 1000;
  const out: Record<string, any>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

async function chunkedUpsert(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + size));
    if (error) throw error;
  }
}

/* ─────────────────────────── row mappers ─────────────────────────── */

function rowToPlayer(r: Record<string, any>): Player {
  return {
    id: r.id,
    name: r.name,
    age: r.age,
    role: r.role,
    battingHand: r.batting_hand,
    bowlerType: r.bowler_type,
    skills: {
      batVsSeam: r.bat_vs_seam,
      batVsSpin: r.bat_vs_spin,
      bowlMain: r.bowl_main,
      bowlVariation: r.bowl_variation,
      fielding: r.fielding,
      wicketkeeping: r.wicketkeeping,
    },
    fitness: r.fitness,
    form: r.form,
    experience: r.experience,
    potential: r.potential,
    salary: r.salary,
    career: r.career ?? undefined,
    debutWeek: r.debut_week ?? undefined,
  };
}

function playerToRow(p: Player, clubId: string | null): Record<string, unknown> {
  const acq = p as Player & { _acqWeek?: number; _acqPrice?: number };
  return {
    id: p.id,
    club_id: clubId,
    name: p.name,
    age: p.age,
    role: p.role,
    batting_hand: p.battingHand,
    bowler_type: p.bowlerType,
    bat_vs_seam: p.skills.batVsSeam,
    bat_vs_spin: p.skills.batVsSpin,
    bowl_main: p.skills.bowlMain,
    bowl_variation: p.skills.bowlVariation,
    fielding: p.skills.fielding,
    wicketkeeping: p.skills.wicketkeeping,
    fitness: p.fitness,
    form: p.form,
    experience: p.experience,
    potential: p.potential,
    salary: p.salary,
    career: p.career ?? null,
    debut_week: p.debutWeek ?? null,
    acq_week: acq._acqWeek ?? null,
    acq_price: acq._acqPrice ?? null,
  };
}

function rowToClub(r: Record<string, any>): Club {
  return {
    id: r.id,
    name: r.name,
    managerType: r.manager_type,
    ownerUserId: r.owner_user_id,
    personality: r.personality,
    squadPlayerIds: [],
    balance: Number(r.balance),
    stadiumSeats: r.stadium_seats,
    pitchType: r.pitch_type,
    fanClub: r.fan_club,
    divisionTier: r.division_tier,
    leagueId: r.league_id,
    reputationPoints: r.reputation_points,
    seasonWon: r.season_won ?? 0,
    seasonLost: r.season_lost ?? 0,
    seasonTied: r.season_tied ?? 0,
    seasonPoints: r.season_points ?? 0,
    seasonRunsFor: r.season_runs_for ?? 0,
    seasonBallsFor: r.season_balls_for ?? 0,
    seasonRunsAgainst: r.season_runs_against ?? 0,
    seasonBallsAgainst: r.season_balls_against ?? 0,
    trainingFocus: r.training_focus,
    trainingFacilityLevel: r.training_facility_level,
    scoutCountry: r.scout_country,
    pendingScoutPlayerId: r.pending_scout_player_id,
    savedOrders: r.match_orders ?? null,
    crest: r.crest ?? { shape: "shield", emblem: "bats", primaryHue: 150, secondaryHue: 280 },
  };
}

function clubToRow(c: Club): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    manager_type: c.managerType,
    owner_user_id: c.ownerUserId,
    personality: c.personality,
    balance: c.balance,
    stadium_seats: c.stadiumSeats,
    pitch_type: c.pitchType,
    fan_club: c.fanClub,
    division_tier: c.divisionTier,
    league_id: c.leagueId,
    reputation_points: c.reputationPoints,
    season_won: c.seasonWon,
    season_lost: c.seasonLost,
    season_tied: c.seasonTied,
    season_points: c.seasonPoints,
    season_runs_for: c.seasonRunsFor,
    season_balls_for: c.seasonBallsFor,
    season_runs_against: c.seasonRunsAgainst,
    season_balls_against: c.seasonBallsAgainst,
    training_focus: c.trainingFocus,
    training_facility_level: c.trainingFacilityLevel,
    scout_country: c.scoutCountry,
    pending_scout_player_id: c.pendingScoutPlayerId,
    match_orders: c.savedOrders,
    crest: c.crest,
  };
}

function rowToLeague(r: Record<string, any>): League {
  return { id: r.id, name: r.name, divisionTier: r.division_tier, clubIds: [] };
}

function rowToAuction(r: Record<string, any>): AuctionListing {
  return {
    id: r.id,
    playerId: r.player_id,
    sellerClubId: r.seller_club_id,
    askingPrice: Number(r.asking_price),
    currentBid: Number(r.current_bid),
    currentBidderClubId: r.current_bidder_club_id,
    closesOnWeek: r.closes_on_week,
    sellerAcquiredWeek: r.seller_acquired_week,
    sellerAcquiredPrice: Number(r.seller_acquired_price),
    status: r.status,
  };
}

function auctionToRow(a: AuctionListing): Record<string, unknown> {
  return {
    id: a.id,
    player_id: a.playerId,
    seller_club_id: a.sellerClubId,
    asking_price: a.askingPrice,
    current_bid: a.currentBid,
    current_bidder_club_id: a.currentBidderClubId,
    closes_on_week: a.closesOnWeek,
    seller_acquired_week: a.sellerAcquiredWeek,
    seller_acquired_price: a.sellerAcquiredPrice,
    status: a.status,
  };
}
