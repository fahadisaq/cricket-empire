export function money(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

export function tierLabel(v: number): string {
  const tiers = [
    "Hopeless", "Poor", "Unreliable", "Decent", "Good",
    "Reliable", "Accomplished", "Remarkable", "Exemplary", "Superb",
  ];
  return tiers[Math.min(9, Math.max(0, Math.floor(v / 10)))]!;
}

export function skillColor(v: number): string {
  if (v >= 80) return "#22c55e";
  if (v >= 65) return "#84cc16";
  if (v >= 50) return "#eab308";
  if (v >= 35) return "#f97316";
  return "#ef4444";
}

export function roleEmoji(role: string): string {
  switch (role) {
    case "batsman": return "🏏";
    case "bowler": return "🎯";
    case "allrounder": return "⭐";
    case "wicketkeeper": return "🧤";
    default: return "•";
  }
}
