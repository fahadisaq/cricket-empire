/**
 * Supabase ops script:
 *   tsx src/scripts/supabase.ts check   — verify connection + tables exist
 *   tsx src/scripts/supabase.ts seed    — create a fresh world and save it
 *   tsx src/scripts/supabase.ts tick N  — load world, run N ticks, save
 *
 * Loads .env.local automatically.
 */
import { readFileSync } from "node:fs";
import { requireSupabaseConfig } from "../world/config.js";
import { SupabaseStore } from "../world/supabaseStore.js";
import { createWorld } from "../world/createWorld.js";
import { runWeeks } from "../world/tick.js";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no dependency).
function loadEnv(): void {
  try {
    const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on real env */
  }
}

async function main(): Promise<void> {
  loadEnv();
  const cmd = process.argv[2] ?? "check";

  if (cmd === "check") {
    const cfg = requireSupabaseConfig();
    const db = createClient(cfg.url, cfg.serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { error } = await db.from("ce_world").select("id").limit(1);
    if (error) {
      console.error(`\n❌ Connected to ${cfg.url} but query failed:`);
      console.error(`   ${error.message}`);
      console.error(`   → Did you run supabase/schema.sql in the SQL editor?\n`);
      process.exit(1);
    }
    console.log(`\n✅ Supabase reachable and ce_ tables exist at ${cfg.url}\n`);
    return;
  }

  const store = new SupabaseStore(requireSupabaseConfig());

  if (cmd === "reseed") {
    // DANGER: wipes all ce_ game data and recreates a fresh pyramid world.
    const seed = process.argv[3] ? Number(process.argv[3]) : 2025;
    const cfg = requireSupabaseConfig();
    const db = createClient(cfg.url, cfg.serviceRoleKey, { auth: { persistSession: false } });
    console.log("\n🧹 Wiping existing world...");
    // Delete in FK-safe order.
    await db.from("ce_auctions").delete().neq("id", "");
    await db.from("ce_players").delete().neq("id", "");
    await db.from("ce_clubs").delete().neq("id", "");
    await db.from("ce_leagues").delete().neq("id", "");
    await db.from("ce_world_log").delete().neq("id", 0);
    await db.from("ce_world").delete().eq("id", 1);

    console.log(`🌱 Seeding pyramid world (seed ${seed}, 3 divisions)...`);
    const world = createWorld({ seed, clubsPerLeague: 10, divisions: 3 });
    await store.save(world);
    console.log(
      `✅ Saved ${Object.keys(world.leagues).length} leagues, ${Object.keys(world.clubs).length} clubs, ${Object.keys(world.players).length} players.\n`,
    );
    return;
  }

  if (cmd === "seed") {
    const seed = process.argv[3] ? Number(process.argv[3]) : 2025;
    const existing = await store.load();
    if (existing) {
      console.log(`\n⚠️  World already exists (week ${existing.week}). Seed aborted.`);
      console.log(`   Delete ce_ rows first if you want a fresh world.\n`);
      return;
    }
    console.log(`\n🌱 Seeding fresh world (seed ${seed})...`);
    const world = createWorld({ seed, clubsPerLeague: 10, divisions: 3 });
    await store.save(world);
    console.log(
      `✅ Saved ${Object.keys(world.clubs).length} clubs, ${Object.keys(world.players).length} players to Supabase.\n`,
    );
    return;
  }

  if (cmd === "tick") {
    const n = process.argv[3] ? Number(process.argv[3]) : 1;
    const world = await store.load();
    if (!world) {
      console.error("\n❌ No world found. Run `seed` first.\n");
      process.exit(1);
    }
    console.log(`\n⏱️  Ticking world ${n} week(s) from week ${world.week}...`);
    runWeeks(world, n);
    await store.save(world);
    console.log(`✅ Now at week ${world.week}. Saved.\n`);
    return;
  }

  console.log(`Unknown command "${cmd}". Use: check | seed | tick [n]`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
