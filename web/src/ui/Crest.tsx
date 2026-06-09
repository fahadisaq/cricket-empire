import type { ClubCrest } from "@engine/world/state.ts";
import { initials } from "./ratings";

/** Renders a club crest from its config (shape + emblem + colors). */
export function Crest({ crest, name, size = 44 }: { crest?: ClubCrest; name: string; size?: number }) {
  const c = crest ?? { shape: "shield", emblem: "bats", primaryHue: 150, secondaryHue: 280 } as ClubCrest;
  const primary = `hsl(${c.primaryHue} 65% 46%)`;
  const secondary = `hsl(${c.secondaryHue} 60% 40%)`;
  const uid = `${c.primaryHue}-${c.secondaryHue}-${c.shape}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 72">
      <defs>
        <linearGradient id={`cg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
      </defs>
      <Shape shape={c.shape} fill={`url(#cg-${uid})`} />
      <Emblem emblem={c.emblem} name={name} />
    </svg>
  );
}

function Shape({ shape, fill }: { shape: ClubCrest["shape"]; fill: string }) {
  const stroke = "rgba(255,255,255,0.4)";
  switch (shape) {
    case "circle":
      return <circle cx="32" cy="36" r="30" fill={fill} stroke={stroke} strokeWidth="2" />;
    case "diamond":
      return <path d="M32 4 L60 36 L32 68 L4 36 Z" fill={fill} stroke={stroke} strokeWidth="2" />;
    case "banner":
      return <path d="M8 6 H56 V52 L32 66 L8 52 Z" fill={fill} stroke={stroke} strokeWidth="2" />;
    default:
      return <path d="M32 2 L60 12 V38 C60 54 47 66 32 70 C17 66 4 54 4 38 V12 Z" fill={fill} stroke={stroke} strokeWidth="2" />;
  }
}

function Emblem({ emblem, name }: { emblem: ClubCrest["emblem"]; name: string }) {
  const w = "rgba(255,255,255,0.92)";
  switch (emblem) {
    case "ball":
      return <><circle cx="32" cy="34" r="11" fill={w} /><path d="M24 34 H40" stroke="#b91c1c" strokeWidth="1.5" /></>;
    case "stumps":
      return <g stroke={w} strokeWidth="3" strokeLinecap="round"><line x1="26" y1="22" x2="26" y2="46" /><line x1="32" y1="22" x2="32" y2="46" /><line x1="38" y1="22" x2="38" y2="46" /></g>;
    case "lion":
      return <text x="32" y="44" textAnchor="middle" fontSize="26">🦁</text>;
    case "star":
      return <text x="32" y="44" textAnchor="middle" fontSize="24" fill={w}>★</text>;
    case "crown":
      return <text x="32" y="44" textAnchor="middle" fontSize="22">👑</text>;
    default: // bats
      return <g stroke={w} strokeWidth="3" strokeLinecap="round"><line x1="24" y1="48" x2="40" y2="24" /><line x1="40" y1="48" x2="24" y2="24" /></g>;
  }
}

/** Small text-initials crest fallback (kept for compatibility). */
export function CrestInitials({ name }: { name: string }) {
  return <span>{initials(name)}</span>;
}
