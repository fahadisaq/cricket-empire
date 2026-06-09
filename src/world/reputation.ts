/**
 * Manager Reputation ladder — gates advanced features, exactly like Hitwicket.
 * Points are earned via training pops, match wins, transfers, scouting, etc.
 * (those are already awarded across the tick systems).
 */

export const REPUTATION_LEVELS = [
  "Mediocre", "Average", "Reliable", "Accomplished", "Remarkable",
  "Brilliant", "Exemplary", "Prodigious", "Fantastic", "Magnificent",
  "Masterful", "Supreme", "Magical", "Legendary", "Wonderous",
  "Demigod", "Titan",
] as const;

export type ReputationLevel = (typeof REPUTATION_LEVELS)[number];

/** Points required to REACH each level index (cumulative, escalating). */
export function pointsForLevel(levelIndex: number): number {
  if (levelIndex <= 0) return 0;
  // Escalating curve: each level costs progressively more.
  return Math.round(120 * levelIndex * levelIndex + 80 * levelIndex);
}

export interface ReputationStatus {
  levelIndex: number;
  level: ReputationLevel;
  points: number;
  nextLevel: ReputationLevel | null;
  pointsIntoLevel: number;
  pointsForNext: number; // points needed to span current->next
  progress: number; // 0..1 toward next level
}

export function reputationStatus(points: number): ReputationStatus {
  let levelIndex = 0;
  for (let i = 0; i < REPUTATION_LEVELS.length; i++) {
    if (points >= pointsForLevel(i)) levelIndex = i;
    else break;
  }
  const atMax = levelIndex >= REPUTATION_LEVELS.length - 1;
  const base = pointsForLevel(levelIndex);
  const next = atMax ? base : pointsForLevel(levelIndex + 1);
  return {
    levelIndex,
    level: REPUTATION_LEVELS[levelIndex]!,
    points,
    nextLevel: atMax ? null : REPUTATION_LEVELS[levelIndex + 1]!,
    pointsIntoLevel: points - base,
    pointsForNext: next - base,
    progress: atMax ? 1 : (points - base) / Math.max(1, next - base),
  };
}

/** Feature gates keyed by the minimum level index required. */
export interface FeatureUnlocks {
  battingSeamSpinTraining: boolean; // Average
  pitchRelay: boolean; // Average
  stadiumUpgrade: boolean; // Reliable
  bowlingVariationTraining: boolean; // Reliable
  internationalScout: boolean; // Accomplished
  individualBattingTraining: boolean; // Remarkable
  aimForTarget: boolean; // Brilliant
  doubleLineups: boolean; // Prodigious
}

export function featureUnlocks(points: number): FeatureUnlocks {
  const { levelIndex } = reputationStatus(points);
  const lvl = (name: ReputationLevel) => REPUTATION_LEVELS.indexOf(name);
  return {
    battingSeamSpinTraining: levelIndex >= lvl("Average"),
    pitchRelay: levelIndex >= lvl("Average"),
    stadiumUpgrade: levelIndex >= lvl("Reliable"),
    bowlingVariationTraining: levelIndex >= lvl("Reliable"),
    internationalScout: levelIndex >= lvl("Accomplished"),
    individualBattingTraining: levelIndex >= lvl("Remarkable"),
    aimForTarget: levelIndex >= lvl("Brilliant"),
    doubleLineups: levelIndex >= lvl("Prodigious"),
  };
}
