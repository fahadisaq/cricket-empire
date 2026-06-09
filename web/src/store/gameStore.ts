/**
 * Game store — a THIN CLIENT. It holds no engine and never writes the DB.
 * It calls the authoritative server API, which runs all logic against Supabase.
 * State here is just a cache of what the server returned, for rendering.
 */
import { create } from "zustand";
import { api } from "../lib/api";
import type { Club, TrainingFocus } from "@engine/world/state.ts";
import type { Player, MatchOrders } from "@engine/engine/types.ts";

interface ClubView {
  club: Club;
  players: Player[];
  pendingScout: Player | null;
}

interface WorldSnapshot {
  week: number;
  clubs: Club[];
  leagues: { id: string; name: string; divisionTier: number }[];
}

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

interface GameState {
  myClubId: string | null;
  view: ClubView | null;
  world: WorldSnapshot | null;
  loading: boolean;
  busy: boolean;
  error: string | null;

  /** Load identity + club after auth. Returns whether a club exists. */
  loadMe: () => Promise<boolean>;
  createClub: (name: string, crest?: import("@engine/world/state.ts").ClubCrest) => Promise<void>;
  refreshClub: () => Promise<void>;
  refreshWorld: () => Promise<void>;

  setTrainingFocus: (focus: TrainingFocus) => Promise<void>;
  setPitch: (pitch: Club["pitchType"]) => Promise<void>;
  saveLineup: (orders: MatchOrders) => Promise<void>;
  autoLineup: () => Promise<MatchOrders | null>;
  scout: (sign: boolean) => Promise<void>;
  listPlayer: (playerId: string, askingPrice: number) => Promise<void>;
  bid: (auctionId: string, amount: number) => Promise<void>;
  firePlayer: (playerId: string) => Promise<void>;
  upgradeStadium: (seats: number) => Promise<void>;
  upgradeFacility: () => Promise<void>;
  fetchAuctions: () => Promise<AuctionView[]>;
  fetchLeague: (leagueId: string) => Promise<Club[]>;
  fetchLog: () => Promise<{ week: number; message: string }[]>;
  fetchFixtures: () => Promise<FixtureView[]>;
  fetchSchedule: () => Promise<ScheduleInfo>;
  fetchHallOfFame: () => Promise<RetiredView[]>;
  fetchRecords: () => Promise<RecordsView>;
  fetchMatch: () => Promise<{ match: MatchResultView | null; startedAt?: number }>;
}

export type CareerStatsView = NonNullable<import("@engine/engine/types.ts").Player["career"]>;
export interface RetiredView {
  id: string; name: string; role: string; bowlerType: string; battingHand: string;
  retiredAge: number; retiredWeek: number; debutWeek: number;
  lastClubName: string; peakSkillIndex: number; career: CareerStatsView;
}
export interface PlayerRecordView { id: string; name: string; age: number; career: CareerStatsView }
export interface RecordsView {
  runs: PlayerRecordView[]; wickets: PlayerRecordView[];
  titles: PlayerRecordView[]; mom: PlayerRecordView[];
}

/** The match result shape returned by the engine (subset we render). */
export type MatchResultView = import("@engine/engine/types.ts").MatchResult;

export interface FixtureView {
  round: number;
  week: number;
  opponentId: string;
  opponentName: string;
  home: boolean;
  pitch: string;
  status: "played" | "next" | "upcoming";
}

export interface ScheduleInfo {
  week: number;
  tickIntervalMs: number;
  nextTickAt: number | null;
  autoTick: boolean;
}

export const useGame = create<GameState>((set, get) => ({
  myClubId: null,
  view: null,
  world: null,
  loading: false,
  busy: false,
  error: null,

  loadMe: async () => {
    set({ loading: true, error: null });
    try {
      const me = await api.get<{ userId: string; clubId: string | null }>("/api/me");
      set({ myClubId: me.clubId, loading: false });
      if (me.clubId) await get().refreshClub();
      return me.clubId !== null;
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      return false;
    }
  },

  createClub: async (name, crest) => {
    set({ busy: true, error: null });
    try {
      const { clubId } = await api.post<{ clubId: string }>("/api/club", { name, crest });
      set({ myClubId: clubId, busy: false });
      await get().refreshClub();
    } catch (e) {
      set({ busy: false, error: (e as Error).message });
    }
  },

  refreshClub: async () => {
    const id = get().myClubId;
    if (!id) return;
    const view = await api.get<ClubView>(`/api/club/${id}`);
    set({ view });
  },

  refreshWorld: async () => {
    const world = await api.get<WorldSnapshot>("/api/world");
    set({ world });
  },

  setTrainingFocus: async (focus) => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/training`, { focus });
    await get().refreshClub();
  },

  setPitch: async (pitch) => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/pitch`, { pitch });
    await get().refreshClub();
  },

  saveLineup: async (orders) => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/lineup`, { orders });
    await get().refreshClub();
  },

  autoLineup: async () => {
    const id = get().myClubId;
    if (!id) return null;
    const { orders } = await api.get<{ orders: MatchOrders }>(`/api/club/${id}/autolineup`);
    return orders;
  },

  scout: async (sign) => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/scout`, { sign });
    await get().refreshClub();
  },

  listPlayer: async (playerId, askingPrice) => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/list`, { playerId, askingPrice });
    await get().refreshClub();
  },

  bid: async (auctionId, amount) => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/bid`, { auctionId, amount });
    await get().refreshClub();
  },

  firePlayer: async (playerId) => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/fire`, { playerId });
    await get().refreshClub();
  },

  upgradeStadium: async (seats) => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/stadium`, { seats });
    await get().refreshClub();
  },

  upgradeFacility: async () => {
    const id = get().myClubId;
    if (!id) return;
    await api.post(`/api/club/${id}/facility`, {});
    await get().refreshClub();
  },

  fetchAuctions: () => api.get<AuctionView[]>("/api/auctions"),
  fetchLeague: (leagueId) => api.get<Club[]>(`/api/league/${leagueId}`),
  fetchLog: () => api.get<{ week: number; message: string }[]>("/api/log"),
  fetchFixtures: () => {
    const id = get().myClubId;
    return id ? api.get<FixtureView[]>(`/api/club/${id}/fixtures`) : Promise.resolve([]);
  },
  fetchSchedule: () => api.get<ScheduleInfo>("/api/schedule"),
  fetchHallOfFame: () => api.get<RetiredView[]>("/api/hall-of-fame"),
  fetchRecords: () => api.get<RecordsView>("/api/records"),
  fetchMatch: () => {
    const id = get().myClubId;
    return id
      ? api.get<{ match: MatchResultView | null; startedAt?: number }>(`/api/club/${id}/match`)
      : Promise.resolve({ match: null });
  },
}));
