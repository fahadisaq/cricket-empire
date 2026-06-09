/**
 * The persistent game-world state. This is the single source of truth that the
 * tick systems mutate and the store saves. AI and human clubs are identical
 * here — only `managerType` differs — so everything persists the same way.
 */
import type { Player } from "../engine/types.js";
import type { Personality } from "../ai/manager.js";
import type { MatchOrders, CareerStats } from "../engine/types.js";

export type ManagerType = "ai" | "human";

/** Club visual identity: a shield shape, two colors, an emblem, and a hue. */
export interface ClubCrest {
  shape: "shield" | "circle" | "diamond" | "banner";
  emblem: "bats" | "ball" | "stumps" | "lion" | "star" | "crown";
  primaryHue: number; // 0..359
  secondaryHue: number; // 0..359
}

export interface Club {
  id: string;
  name: string;
  managerType: ManagerType;
  /** Set when a human owns the club; null for AI. */
  ownerUserId: string | null;
  personality: Personality; // AI uses it; humans keep it as a default style
  squadPlayerIds: string[];

  /** Visual identity — chosen at onboarding by humans, auto for AI. */
  crest: ClubCrest;

  /* Finances */
  balance: number;

  /* Stadium */
  stadiumSeats: number;
  pitchType: "sporting" | "crumbling" | "green" | "flat";
  fanClub: number;

  /* Progression */
  divisionTier: number; // 1 = top
  leagueId: string | null;
  reputationPoints: number;

  /* Season record (current season) */
  seasonWon: number;
  seasonLost: number;
  seasonTied: number;
  seasonPoints: number;
  seasonRunsFor: number;
  seasonBallsFor: number;
  seasonRunsAgainst: number;
  seasonBallsAgainst: number;

  /* Training */
  trainingFocus: TrainingFocus;
  trainingFacilityLevel: number; // 1..10, speeds up training

  /* Scouting */
  scoutCountry: string;
  pendingScoutPlayerId: string | null; // youth offered this week

  /**
   * Human-set match orders (XI, order, captain, keeper, powerplay).
   * When present (human managers), the tick uses these instead of the AI.
   * null = let the AI pick (default for AI clubs and brand-new humans).
   */
  savedOrders: MatchOrders | null;
}

export type TrainingFocus =
  | "fitness"
  | "keeping"
  | "fielding"
  | "batting"
  | "battingSeam"
  | "battingSpin"
  | "bowlingSeam"
  | "bowlingSpin"
  | "bowlingVariation";

export interface League {
  id: string;
  name: string; // e.g. "III.6"
  divisionTier: number;
  clubIds: string[];
}

export interface AuctionListing {
  id: string;
  playerId: string;
  sellerClubId: string | null; // null = free-agent / youth pool
  askingPrice: number;
  currentBid: number;
  currentBidderClubId: string | null;
  /** Tick (week) number when the listing closes. */
  closesOnWeek: number;
  /** For PTF: when seller acquired the player and at what price. */
  sellerAcquiredWeek: number;
  sellerAcquiredPrice: number;
  status: "open" | "sold" | "unsold";
}

export interface GameWorld {
  /** Master seed for all world randomness. */
  seed: number;
  /** Current week number (the tick counter). Increments each tick. */
  week: number;

  players: Record<string, Player>;
  clubs: Record<string, Club>;
  leagues: Record<string, League>;
  auctions: Record<string, AuctionListing>;

  /** Hall of Fame — players who have retired, with their final career record. */
  hallOfFame: RetiredPlayer[];

  /** Append-only log of notable events for feeds / history. */
  log: WorldLogEntry[];
}

/** A retired player preserved in the Hall of Fame. */
export interface RetiredPlayer {
  id: string;
  name: string;
  role: string;
  bowlerType: string;
  battingHand: string;
  retiredAge: number;
  retiredWeek: number;
  debutWeek: number;
  lastClubId: string | null;
  lastClubName: string;
  peakSkillIndex: number;
  career: CareerStats;
}

export interface WorldLogEntry {
  week: number;
  type:
    | "match"
    | "training"
    | "finance"
    | "scout"
    | "auction"
    | "promotion"
    | "relegation"
    | "transfer"
    | "info";
  clubId?: string;
  message: string;
}

export function pushLog(
  world: GameWorld,
  type: WorldLogEntry["type"],
  message: string,
  clubId?: string,
): void {
  world.log.push({ week: world.week, type, message, clubId });
  // Keep the log bounded in memory; full history lives in the DB.
  if (world.log.length > 5000) world.log.splice(0, world.log.length - 5000);
}
