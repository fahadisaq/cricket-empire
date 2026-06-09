/**
 * CLI entry point. Commands:
 *   season           — simulate a full AI league season and print the table
 *   match            — simulate one match with full ball-by-ball commentary
 *   balance [n]      — run the balance harness over n matches (default 400)
 */
import { generateLeague } from "./data/generate.js";
import { playSeason } from "./league/season.js";
import { runBalance } from "./league/balance.js";
import { simulateMatch, combineSeeds } from "./engine/index.js";
import type { MatchConfig, Pitch } from "./engine/index.js";
import { selectOrders, derivePersonality, squadStrength } from "./ai/manager.js";
import { createWorld } from "./world/createWorld.js";
import { runWeeks } from "./world/tick.js";
import { JsonFileStore } from "./world/store.js";
import { skillIndex } from "./engine/ability.js";

const cmd = process.argv[2] ?? "season";
const arg = process.argv[3];

function pad(s: string | number, n: number): string {
  return String(s).padEnd(n);
}
function padl(s: string | number, n: number): string {
  return String(s).padStart(n);
}

if (cmd === "season") {
  const seed = arg ? Number(arg) : 2025;
  const teams = generateLeague(seed, 10);
  console.log(`\n🏏  CRICKET EMPIRE — AI League Season (seed ${seed})\n`);
  console.log("Clubs:");
  for (const t of teams) {
    console.log(
      `  ${pad(t.name, 22)} strength ${padl(squadStrength(t.squad), 6)}  [${derivePersonality(t.id)}]`,
    );
  }

  const season = playSeason(teams, seed);

  console.log(`\nPlayed ${season.results.length} matches.\n`);
  console.log("FINAL TABLE");
  console.log(
    `${pad("#", 3)}${pad("Club", 22)}${padl("P", 4)}${padl("W", 4)}${padl("L", 4)}${padl("T", 4)}${padl("Pts", 5)}${padl("NRR", 9)}`,
  );
  season.standings.forEach((s, i) => {
    const marker = i === 0 ? "🏆" : i >= season.standings.length - 4 ? "▼" : " ";
    console.log(
      `${pad(i + 1, 3)}${pad(s.name, 22)}${padl(s.played, 4)}${padl(s.won, 4)}${padl(s.lost, 4)}${padl(s.tied, 4)}${padl(s.points, 5)}${padl(s.nrr.toFixed(3), 9)} ${marker}`,
    );
  });

  const champ = season.standings[0]!;
  console.log(`\n🏆  Champions: ${champ.name} (${champ.points} pts)\n`);
} else if (cmd === "match") {
  const seed = arg ? Number(arg) : 777;
  const teams = generateLeague(seed, 10);
  const a = teams[0]!;
  const b = teams[1]!;
  const matchSeed = combineSeeds(seed, 42);
  const pitch: Pitch = { type: "sporting" };
  const cfg: MatchConfig = {
    oversPerInnings: 20,
    maxOversPerBowler: 4,
    pitch,
    seed: matchSeed,
  };
  const res = simulateMatch(
    {
      teamId: a.id,
      teamName: a.name,
      players: a.squad,
      orders: selectOrders(a.squad, { personality: derivePersonality(a.id), matchSeed: combineSeeds(matchSeed, 1) }),
    },
    {
      teamId: b.id,
      teamName: b.name,
      players: b.squad,
      orders: selectOrders(b.squad, { personality: derivePersonality(b.id), matchSeed: combineSeeds(matchSeed, 2) }),
    },
    cfg,
  );

  console.log(`\n🏏  ${a.name} vs ${b.name}  —  ${pitch.type} pitch\n`);
  const nameOf = (id: string) => (id === a.id ? a.name : b.name);

  res.innings.forEach((inn, idx) => {
    console.log(`\n===== Innings ${idx + 1}: ${nameOf(inn.battingTeamId)} =====`);
    console.log(`${inn.runs}/${inn.wickets}  (${(inn.balls / 6).toFixed(1)} overs)\n`);
    console.log("Batting:");
    for (const bt of inn.batting) {
      if (bt.balls === 0 && !bt.out) continue;
      console.log(
        `  ${pad(bt.name, 20)} ${padl(bt.runs, 4)} (${bt.balls})  4s:${bt.fours} 6s:${bt.sixes}  ${bt.out ? bt.dismissal ?? "out" : "not out"}`,
      );
    }
    console.log("Bowling:");
    for (const bw of inn.bowling) {
      console.log(
        `  ${pad(bw.name, 20)} ${(bw.ballsBowled / 6).toFixed(1)}-${padl(bw.runsConceded, 3)}-${bw.wickets}`,
      );
    }
  });

  console.log(`\nResult: ${res.winnerTeamId ? nameOf(res.winnerTeamId) + " won " + res.margin : "Match " + res.margin}`);
  console.log(`Player of the Match: ${res.manOfTheMatch.name} (${nameOf(res.manOfTheMatch.teamId)})`);

  console.log(`\n--- Final-over commentary (innings 2) ---`);
  const inn2Events = res.events.filter((e) => e.inning === 2);
  for (const e of inn2Events.slice(-8)) {
    console.log("  " + e.commentary + `   [${e.teamScore}/${e.teamWickets}]`);
  }
  console.log();
} else if (cmd === "world") {
  // Simulate a persistent living world over N weeks, then save it.
  const weeks = arg ? Number(arg) : 30;
  const seed = process.argv[4] ? Number(process.argv[4]) : 2025;
  const savePath = "./save/world.json";

  (async () => {
    const store = new JsonFileStore(savePath);
    let world = await store.load();
    if (!world || world.seed !== seed) {
      console.log(`\n🌍  Creating new world (seed ${seed})...`);
      world = createWorld({ seed, clubsPerLeague: 10 });
    } else {
      console.log(`\n🌍  Resuming world from week ${world.week} (seed ${seed})...`);
    }

    const startWeek = world.week;
    runWeeks(world, weeks);
    await store.save(world);

    console.log(`Simulated weeks ${startWeek} → ${world.week}.\n`);

    // Snapshot: club balances, squad sizes, reputation.
    const clubs = Object.values(world.clubs).sort((a, b) => b.reputationPoints - a.reputationPoints);
    console.log(
      `${pad("Club", 22)}${padl("Bal", 12)}${padl("Squad", 7)}${padl("Rep", 7)}${padl("Fans", 8)}  Focus`,
    );
    for (const c of clubs) {
      console.log(
        `${pad(c.name, 22)}${padl(c.balance.toLocaleString(), 12)}${padl(c.squadPlayerIds.length, 7)}${padl(c.reputationPoints, 7)}${padl(c.fanClub, 8)}  ${c.trainingFocus}`,
      );
    }

    // Show a few player development highlights (top SI players).
    const players = Object.values(world.players)
      .sort((a, b) => skillIndex(b.skills) - skillIndex(a.skills))
      .slice(0, 8);
    console.log(`\nTop players in the world by Skill Index:`);
    for (const p of players) {
      console.log(
        `  ${pad(p.name, 20)} age ${padl(p.age, 2)}  ${pad(p.role, 12)} SI ${padl(skillIndex(p.skills), 7)}  form ${Math.round(p.form)} fit ${Math.round(p.fitness)}`,
      );
    }

    // Recent world log.
    console.log(`\nRecent events:`);
    for (const e of world.log.slice(-12)) {
      console.log(`  [w${e.week}] ${e.message}`);
    }
    console.log(`\n💾  Saved to ${savePath}\n`);
  })();
} else if (cmd === "balance") {
  const n = arg ? Number(arg) : 400;
  console.log(`\nRunning balance harness over ${n} matches...\n`);
  const r = runBalance(n);
  console.log(`Matches:            ${r.matches}`);
  console.log(`Avg 1st innings:    ${r.avgInn1}  (wkts ${r.avgWicketsInn1})`);
  console.log(`Avg 2nd innings:    ${r.avgInn2}  (wkts ${r.avgWicketsInn2})`);
  console.log(`Score range:        ${r.minScore} – ${r.maxScore}`);
  console.log(`Chase win %:        ${r.chaseWinPct}%`);
  console.log(`Tie %:              ${r.tiePct}%`);
  console.log(`\n1st-innings score distribution:`);
  const buckets = Object.keys(r.scoreHistogram).sort(
    (a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]),
  );
  for (const bkt of buckets) {
    const count = r.scoreHistogram[bkt]!;
    const bar = "█".repeat(Math.round((count / r.matches) * 100));
    console.log(`  ${pad(bkt, 9)} ${bar} ${count}`);
  }
  console.log();
} else {
  console.log(`Unknown command "${cmd}". Use: season | match | balance`);
}
