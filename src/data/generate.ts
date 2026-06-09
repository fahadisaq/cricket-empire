/**
 * Procedural generation of players and teams. Fully seeded so a given seed
 * always yields the same league — reproducible test worlds.
 */
import { RNG } from "../engine/rng.js";
import { skillIndex } from "../engine/ability.js";
import type {
  Player,
  PlayerRole,
  PlayerSkills,
  BowlerType,
  BattingHand,
} from "../engine/types.js";
import {
  FIRST_NAMES,
  LAST_NAMES,
  TEAM_PREFIXES,
  TEAM_NOUNS,
} from "./names.js";

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${(idCounter++).toString(36)}`;
}

/** Reset the id counter so a given seed always yields identical ids. */
export function resetIds(): void {
  idCounter = 0;
}

function clamp(v: number, lo = 1, hi = 99): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Weekly salary derived from skill index — higher skills cost much more.
 *  Centralized so every system (generation, training, scouting) agrees. */
export function computeSalary(skills: PlayerSkills): number {
  const si = skillIndex(skills);
  return Math.round(180 + Math.pow(si / 1000, 1.55) * 112);
}

function genSkills(rng: RNG, role: PlayerRole, quality: number): PlayerSkills {
  // quality 0..1 controls overall strength; role shapes the distribution.
  const base = () => clamp(rng.normal(20 + quality * 55, 12));
  const strong = () => clamp(rng.normal(35 + quality * 55, 12));

  let s: PlayerSkills = {
    batVsSeam: base(),
    batVsSpin: base(),
    bowlMain: base(),
    bowlVariation: base(),
    fielding: clamp(rng.normal(40 + quality * 35, 14)),
    wicketkeeping: clamp(rng.normal(15, 10)),
  };

  switch (role) {
    case "batsman":
      s.batVsSeam = strong();
      s.batVsSpin = strong();
      break;
    case "bowler":
      s.bowlMain = strong();
      s.bowlVariation = strong();
      break;
    case "allrounder":
      s.batVsSeam = clamp(rng.normal(30 + quality * 45, 12));
      s.batVsSpin = clamp(rng.normal(30 + quality * 45, 12));
      s.bowlMain = clamp(rng.normal(30 + quality * 45, 12));
      s.bowlVariation = clamp(rng.normal(30 + quality * 45, 12));
      break;
    case "wicketkeeper":
      s.batVsSeam = clamp(rng.normal(30 + quality * 45, 12));
      s.batVsSpin = clamp(rng.normal(30 + quality * 45, 12));
      s.wicketkeeping = strong();
      s.fielding = clamp(s.fielding + 10);
      break;
  }
  return s;
}

export function generatePlayer(
  rng: RNG,
  role: PlayerRole,
  quality: number,
  ageRange: [number, number] = [18, 33],
): Player {
  const skills = genSkills(rng, role, quality);
  const age = rng.int(ageRange[0], ageRange[1]);
  const bowlerType: BowlerType = rng.chance(0.62) ? "seam" : "spin";
  const battingHand: BattingHand = rng.chance(0.7) ? "RHB" : "LHB";

  // Younger players: lower experience, higher potential headroom.
  const experience = clamp(rng.normal((age - 16) * 3.2, 8), 1, 99);
  const potential = clamp(
    Math.max(
      (skills.batVsSeam + skills.batVsSpin + skills.bowlMain) / 3 +
        rng.normal(15, 8),
      quality * 100,
    ),
  );

  const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;

  return {
    id: nextId("p"),
    name,
    age,
    role,
    battingHand,
    bowlerType,
    skills,
    fitness: clamp(rng.normal(62, 14)),
    form: clamp(rng.normal(50, 16)),
    experience,
    potential,
    salary: computeSalary(skills),
  };
}

export interface GeneratedTeam {
  id: string;
  name: string;
  isAI: boolean;
  squad: Player[];
}

/** Generate a balanced squad of ~16 players. */
export function generateSquad(rng: RNG, teamQuality: number): Player[] {
  const squad: Player[] = [];
  const plan: PlayerRole[] = [
    "batsman", "batsman", "batsman", "batsman", "batsman",
    "allrounder", "allrounder", "allrounder",
    "bowler", "bowler", "bowler", "bowler", "bowler",
    "wicketkeeper", "wicketkeeper",
    "batsman",
  ];
  for (const role of plan) {
    // Per-player quality jitters around team quality.
    const q = Math.max(0, Math.min(1, teamQuality + rng.normal(0, 0.12)));
    squad.push(generatePlayer(rng, role, q));
  }
  return squad;
}

export function generateTeam(
  rng: RNG,
  index: number,
  teamQuality: number,
  isAI: boolean,
): GeneratedTeam {
  const name = `${TEAM_PREFIXES[index % TEAM_PREFIXES.length]} ${
    TEAM_NOUNS[index % TEAM_NOUNS.length]
  }`;
  return {
    id: nextId("t"),
    name,
    isAI,
    squad: generateSquad(rng, teamQuality),
  };
}

/** Generate a full league of N teams with varied quality. */
export function generateLeague(seed: number, teamCount: number): GeneratedTeam[] {
  resetIds();
  const rng = new RNG(seed);
  const teams: GeneratedTeam[] = [];
  for (let i = 0; i < teamCount; i++) {
    // Spread quality so the league has favourites and minnows.
    const quality = 0.35 + (i / teamCount) * 0.4 + rng.float(-0.08, 0.08);
    teams.push(generateTeam(rng, i, Math.max(0.2, Math.min(0.9, quality)), true));
  }
  return teams;
}
