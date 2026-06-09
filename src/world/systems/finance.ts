/**
 * Weekly finance system: sponsor income (by division), ticket sales (driven by
 * fan club + form), stadium maintenance, and player salaries.
 */
import type { GameWorld, Club } from "../state.js";
import { pushLog } from "../state.js";
import type { Player } from "../../engine/types.js";

const SPONSOR_BY_TIER: Record<number, number> = {
  1: 700_000, 2: 550_000, 3: 400_000, 4: 300_000, 5: 250_000, 6: 200_000, 7: 200_000,
};

const TICKET_PRICE = 70;
const SEAT_MAINTENANCE = 7; // per seat per week

export function runFinance(world: GameWorld, formByClub: Map<string, number>): void {
  for (const club of Object.values(world.clubs)) {
    const sponsor = SPONSOR_BY_TIER[club.divisionTier] ?? 200_000;

    // Attendance: fan club + recent form factor, capped by seats.
    const form = formByClub.get(club.id) ?? 0.5; // 0..1 recent win ratio
    const wantToAttend = Math.round(club.fanClub * (0.6 + form * 0.8));
    const attendance = Math.min(club.stadiumSeats, wantToAttend);
    const tickets = attendance * TICKET_PRICE;

    const maintenance = club.stadiumSeats * SEAT_MAINTENANCE;

    const salaries = club.squadPlayerIds
      .map((id) => world.players[id])
      .filter((p): p is Player => !!p)
      .reduce((s, p) => s + p.salary, 0);

    const net = sponsor + tickets - maintenance - salaries;
    club.balance += net;

    pushLog(
      world,
      "finance",
      `${club.name}: +${sponsor + tickets} income, -${maintenance + salaries} costs (net ${net >= 0 ? "+" : ""}${net}). Balance ${club.balance}.`,
      club.id,
    );
  }
}
