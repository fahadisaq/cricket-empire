/**
 * Natural match timeline. Turns the deterministic ball events into a realistic,
 * *varying* real-time schedule so a live match feels organic — not a robotic
 * fixed-interval ticker.
 *
 * Rhythm modelled on real cricket:
 *  - a normal delivery takes a few seconds
 *  - dot balls are a touch quicker, scoring shots a touch slower
 *  - boundaries get a celebration beat
 *  - WICKETS pause noticeably (new batter walks out)
 *  - end of each over has a short break (field changes, drinks)
 *  - the innings break is the longest pause
 *
 * Because it's seeded off the match, every viewer computes the exact same
 * timeline, so a live match is perfectly synced across everyone watching.
 */
import { RNG, combineSeeds } from "./rng.js";
import type { MatchResult, BallEvent } from "./types.js";

export interface TimedBall {
  /** Index into result.events. */
  index: number;
  /** Milliseconds from match start when this ball is revealed. */
  offsetMs: number;
  event: BallEvent;
}

export interface MatchTimeline {
  balls: TimedBall[];
  /** Total match duration in ms (last ball offset + a short tail). */
  durationMs: number;
}

export interface TimelineOptions {
  /** Base seconds per normal delivery. Default ~3.2s → ~full match in 20-30 min. */
  baseSecondsPerBall?: number;
  /** Scale everything (e.g. 0.25 for a faster "quick" mode). Default 1. */
  speedScale?: number;
}

/** Build a natural, varying, deterministic timeline for a match. */
export function buildTimeline(result: MatchResult, opts: TimelineOptions = {}): MatchTimeline {
  const base = (opts.baseSecondsPerBall ?? 3.2) * 1000;
  const scale = opts.speedScale ?? 1;
  const rng = new RNG(combineSeeds(result.config.seed, 4242));

  const balls: TimedBall[] = [];
  let t = 0;
  let prevOver = -1;
  let prevInning = 0;

  for (let i = 0; i < result.events.length; i++) {
    const ev = result.events[i]!;

    // Innings break (longest pause) when the inning number changes after the 1st.
    if (prevInning !== 0 && ev.inning !== prevInning) {
      t += jitter(rng, 28_000, 6_000); // ~22-34s innings break
    }
    // Over break (field changes) when the over advances within an inning.
    else if (prevOver !== -1 && ev.over !== prevOver) {
      t += jitter(rng, 6_500, 2_000); // ~5-9s between overs
    }

    // Time for THIS delivery (before the next reveal): natural variation.
    let ballMs = jitter(rng, base, base * 0.28);

    // Outcome-based rhythm.
    if (ev.outcome === "W") {
      ballMs += jitter(rng, 9_000, 2_500); // wicket: new batter walks in
    } else if (ev.outcome === 6) {
      ballMs += jitter(rng, 3_500, 1_200); // six: celebration
    } else if (ev.outcome === 4) {
      ballMs += jitter(rng, 2_500, 900); // four: applause
    } else if (ev.outcome === 0) {
      ballMs -= base * 0.2; // dot: a bit quicker
    }

    balls.push({ index: i, offsetMs: Math.round(t * scale), event: ev });
    t += Math.max(800, ballMs);

    prevOver = ev.over;
    prevInning = ev.inning;
  }

  // Short tail before the result card.
  const durationMs = Math.round((t + 4000) * scale);
  return { balls, durationMs };
}

function jitter(rng: RNG, mean: number, spread: number): number {
  return mean + rng.float(-spread, spread);
}

/** How many balls should be revealed at a given elapsed time (ms). */
export function ballsRevealedAt(timeline: MatchTimeline, elapsedMs: number): number {
  // Binary search for the last ball whose offset <= elapsed.
  const b = timeline.balls;
  let lo = 0, hi = b.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (b[mid]!.offsetMs <= elapsedMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
