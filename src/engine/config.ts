/**
 * All engine tuning lives here so balancing never touches logic.
 * Tweak these coefficients, re-run the balance harness, repeat.
 */
export const ENGINE_CONFIG = {
  /* How much each dynamic attribute modulates a player's effective ability.
     Values are multipliers applied around a neutral baseline of 50/100. */
  formWeight: 0.18, // form swing impact
  fitnessWeight: 0.16, // fitness impact (seamers get extra, see below)
  experienceWeight: 0.12, // experience impact
  fitnessSeamBonus: 0.10, // additional fitness weight for seam bowlers

  /* Bowling: variation counts more than main (per the original design). */
  bowlMainWeight: 0.4,
  bowlVariationWeight: 0.6,

  /* New-ball / phase effects (applied to bowling ability). */
  seamNewBallBoost: 8, // ability points for seamers in overs 0-5
  spinNewBallPenalty: 4, // ability penalty for spinners in overs 0-5
  newBallPhaseOvers: 6,

  /* Pitch effects: % of the player's own ability added/removed.
     Reward already-skilled players more (matches original "%-of-ability"). */
  pitchSeamBoostPct: 0.12, // green wicket -> seamers
  pitchSpinBoostPct: 0.12, // crumbling -> spinners
  pitchBatBoostPct: 0.10, // flat -> batsmen

  /* Strike-rotation: a change of strike makes the bowler lose line for 1 ball. */
  strikeChangeBowlerPenalty: 6,

  /* The logistic curve mapping (battingAbility - bowlingAbility) to outcomes.
     Larger 'spread' => closer to 50/50; smaller => skill dominates. */
  abilitySpread: 22,

  /* Base per-ball wicket probability before ability/aggression adjustments. */
  baseWicketProb: 0.045,

  /* Aggression multipliers per phase. >1 = more boundaries AND more risk. */
  aggression: {
    powerplayBoundary: 1.45,
    powerplayWicket: 1.25,
    deathBoundary: 1.6, // last 4 overs slogging
    deathWicket: 1.5,
    deathOversStart: 16,
    middleBoundary: 1.0,
    middleWicket: 1.0,
  },

  /* Chase pressure: as required run rate climbs above par, risk rises. */
  chase: {
    rrrParPerBall: 1.5, // ~9/over is "par"
    boundaryPerRRR: 0.18, // boundary appetite per run of RRR over par
    wicketPerRRR: 0.16, // extra wicket risk per run of RRR over par
    cruisePassiveBoundary: 0.7, // needing <1/ball -> fewer big shots
  },

  /* Fielding: team fielding rating shifts catch-conversion + run saving. */
  fielding: {
    catchBaseConversion: 0.86, // chance a catchable chance is taken at avg fielding
    catchSwingPerPoint: 0.0016, // per fielding-rating point away from 50
    byesPerKeepingDeficit: 0.0009, // chance of byes when keeper is weak
  },

  /* Probability that a dismissal becomes a caught-behind, scaled by keeper. */
  caughtBehindBaseProb: 0.10,
} as const;

export type EngineConfig = typeof ENGINE_CONFIG;
