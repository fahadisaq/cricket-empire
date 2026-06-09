/**
 * Deterministic ball-by-ball commentary. Because outcomes are seeded, the same
 * match always narrates identically — replayable highlights for free.
 */
import type { BallResolution } from "./ballEngine.js";

export function commentate(
  res: BallResolution,
  striker: string,
  bowler: string,
  over: number,
  ball: number,
): string {
  const ov = `${over}.${ball}`;
  if (res.wicket) {
    switch (res.wicketType) {
      case "bowled":
        return `${ov} ${bowler} to ${striker} — BOWLED him! Timber!`;
      case "lbw":
        return `${ov} ${bowler} to ${striker} — given LBW! Big appeal, up goes the finger.`;
      case "caughtBehind":
        return `${ov} ${bowler} to ${striker} — edged and taken behind! Keeper does the rest.`;
      case "caught":
        return `${ov} ${bowler} to ${striker} — caught in the field! Skied it and gone.`;
      case "stumped":
        return `${ov} ${bowler} to ${striker} — stumped! Quick work by the keeper.`;
      default:
        return `${ov} ${bowler} to ${striker} — run out! Mix-up in the middle.`;
    }
  }
  switch (res.runs) {
    case 0:
      return `${ov} ${bowler} to ${striker} — no run, solid defence.`;
    case 1:
      return `${ov} ${bowler} to ${striker} — single, rotates the strike.`;
    case 2:
      return `${ov} ${bowler} to ${striker} — two runs, good running.`;
    case 3:
      return `${ov} ${bowler} to ${striker} — three! they scamper back.`;
    case 4:
      return `${ov} ${bowler} to ${striker} — FOUR! pierces the gap.`;
    case 6:
      return `${ov} ${bowler} to ${striker} — SIX! that's gone all the way!`;
    default:
      return `${ov} ${bowler} to ${striker}.`;
  }
}
