/**
 * Shared helpers for the FIFA-style player cards and club identity.
 */
import type { Player } from "@engine/engine/types.ts";

/** A single 0-99 "overall" rating, role-weighted (like FIFA's OVR). */
export function overall(p: Player): number {
  const bat = (p.skills.batVsSeam + p.skills.batVsSpin) / 2;
  const bowl = p.skills.bowlMain * 0.4 + p.skills.bowlVariation * 0.6;
  const field = p.skills.fielding;
  const keep = p.skills.wicketkeeping;
  let core: number;
  switch (p.role) {
    case "batsman": core = bat * 0.82 + field * 0.18; break;
    case "bowler": core = bowl * 0.82 + field * 0.18; break;
    case "wicketkeeper": core = bat * 0.5 + keep * 0.4 + field * 0.1; break;
    default: core = bat * 0.42 + bowl * 0.42 + field * 0.16; // allrounder
  }
  // Form & fitness nudge it slightly, like match-readiness.
  const adj = core * (0.92 + (p.form / 100) * 0.05 + (p.fitness / 100) * 0.05);
  return Math.max(40, Math.min(99, Math.round(adj)));
}

/** Card tier by overall — drives the card's color/foil. */
export function cardTier(ovr: number): "icon" | "gold" | "silver" | "bronze" {
  if (ovr >= 85) return "icon";
  if (ovr >= 72) return "gold";
  if (ovr >= 60) return "silver";
  return "bronze";
}

export const TIER_STYLE: Record<string, { bg: string; ring: string; text: string; label: string }> = {
  icon:   { bg: "linear-gradient(160deg,#1f2a44,#0b1020)", ring: "#a78bfa", text: "#c4b5fd", label: "ICON" },
  gold:   { bg: "linear-gradient(160deg,#3a2f12,#171206)", ring: "#fbbf24", text: "#fcd34d", label: "GOLD" },
  silver: { bg: "linear-gradient(160deg,#2a2f36,#12151a)", ring: "#cbd5e1", text: "#e2e8f0", label: "SILVER" },
  bronze: { bg: "linear-gradient(160deg,#33231a,#15100b)", ring: "#d6915b", text: "#e7a877", label: "BRONZE" },
};

export function roleShort(role: string): string {
  switch (role) {
    case "batsman": return "BAT";
    case "bowler": return "BWL";
    case "allrounder": return "AR";
    case "wicketkeeper": return "WK";
    default: return "—";
  }
}

/** Deterministic two-color kit from a club id/name. */
export function clubColors(seed: string): { primary: string; secondary: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 150 + (h % 60)) % 360;
  return {
    primary: `hsl(${hue1} 65% 45%)`,
    secondary: `hsl(${hue2} 60% 40%)`,
  };
}

/** Initials for a crest. */
export function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
