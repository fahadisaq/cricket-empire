/**
 * Local dev server. Uses the shared Express app + starts the auto-tick
 * scheduler (which serverless can't do). In production on Vercel, the app is
 * served by web/api/[...path].ts and the tick is driven by a cron.
 */
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch { /* rely on real env */ }
}
loadEnv();

const { buildApp } = await import("./app.js");
const { app, world } = buildApp();

const PORT = Number(process.env.PORT ?? 8787);
world.ready().then(() => {
  world.startScheduler();
  app.listen(PORT, () => console.log(`🏏 Cricket Empire API on http://localhost:${PORT}`));
});
