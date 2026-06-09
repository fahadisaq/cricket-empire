/**
 * Express app builder — used by BOTH the local dev server (index.ts) and the
 * Vercel serverless function (web/api). It does NOT auto-listen and does NOT
 * start the setInterval scheduler (serverless can't keep timers). The daily
 * tick is driven externally by a cron hitting POST /api/tick.
 */
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "../../src/world/config.js";
import { WorldService, HttpError } from "./worldService.js";

export function buildApp(): { app: express.Express; world: WorldService } {
  const cfg = requireSupabaseConfig();
  const authClient = createClient(cfg.url, cfg.serviceRoleKey, { auth: { persistSession: false } });
  const world = new WorldService();

  const app = express();
  app.use(cors());
  app.use(express.json());

  async function getUser(req: express.Request): Promise<{ id: string; name: string } | null> {
    const auth = req.header("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const { data, error } = await authClient.auth.getUser(token);
      if (!error && data.user) return { id: data.user.id, name: data.user.email ?? "Manager" };
    }
    const anon = req.header("x-anon-id");
    if (anon) return { id: Array.isArray(anon) ? anon[0]! : anon, name: "Manager" };
    return null;
  }

  function wrap(fn: (req: express.Request, res: express.Response) => Promise<unknown>) {
    return (req: express.Request, res: express.Response) => {
      fn(req, res)
        .then((out) => { if (!res.headersSent) res.json(out ?? { ok: true }); })
        .catch((err) => {
          const status = err instanceof HttpError ? err.status : 500;
          if (status === 500) console.error(err);
          res.status(status).json({ error: err.message ?? "Server error" });
        });
    };
  }

  async function requireUser(req: express.Request) {
    const user = await getUser(req);
    if (!user) throw new HttpError(401, "Not authenticated");
    return user;
  }

  const pid = (req: express.Request) => String(req.params.id);

  // READ
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/world", wrap(async () => world.snapshot()));
  app.get("/api/league/:id", wrap(async (req) => world.leagueTable(pid(req))));
  app.get("/api/auctions", wrap(async () => world.auctions()));
  app.get("/api/log", wrap(async () => world.log(60)));
  app.get("/api/hall-of-fame", wrap(async () => world.hallOfFame(100)));
  app.get("/api/records", wrap(async () => world.records()));
  app.get("/api/schedule", wrap(async () => world.schedule()));
  app.get("/api/club/:id/fixtures", wrap(async (req) => world.clubFixtures(pid(req))));
  app.get("/api/club/:id/match", wrap(async (req) => {
    const live = world.liveMatch(pid(req));
    return live ?? { match: null };
  }));
  app.get("/api/club/:id", wrap(async (req) => {
    const view = await world.clubView(pid(req));
    if (!view) throw new HttpError(404, "Club not found");
    return view;
  }));
  app.get("/api/me", wrap(async (req) => {
    const user = await requireUser(req);
    return { userId: user.id, clubId: await world.clubForUser(user.id) };
  }));

  // WRITE
  app.post("/api/club", wrap(async (req) => {
    const user = await requireUser(req);
    const name = String(req.body?.name ?? "").slice(0, 24);
    return { clubId: await world.createClubForUser(user.id, name, req.body?.crest) };
  }));
  app.post("/api/club/:id/training", wrap(async (req) => {
    const user = await requireUser(req); await world.setTraining(user.id, pid(req), req.body.focus);
  }));
  app.post("/api/club/:id/pitch", wrap(async (req) => {
    const user = await requireUser(req); await world.setPitch(user.id, pid(req), req.body.pitch);
  }));
  app.post("/api/club/:id/lineup", wrap(async (req) => {
    const user = await requireUser(req); await world.saveLineup(user.id, pid(req), req.body.orders);
  }));
  app.get("/api/club/:id/autolineup", wrap(async (req) => {
    const user = await requireUser(req); return { orders: await world.autoLineup(user.id, pid(req)) };
  }));
  app.post("/api/club/:id/scout", wrap(async (req) => {
    const user = await requireUser(req); await world.scoutDecision(user.id, pid(req), Boolean(req.body.sign));
  }));
  app.post("/api/club/:id/list", wrap(async (req) => {
    const user = await requireUser(req); await world.listPlayer(user.id, pid(req), req.body.playerId, Number(req.body.askingPrice));
  }));
  app.post("/api/club/:id/bid", wrap(async (req) => {
    const user = await requireUser(req); await world.placeBid(user.id, pid(req), req.body.auctionId, Number(req.body.amount));
  }));
  app.post("/api/club/:id/fire", wrap(async (req) => {
    const user = await requireUser(req); await world.firePlayer(user.id, pid(req), req.body.playerId);
  }));
  app.post("/api/club/:id/stadium", wrap(async (req) => {
    const user = await requireUser(req); await world.upgradeStadium(user.id, pid(req), Number(req.body.seats));
  }));
  app.post("/api/club/:id/facility", wrap(async (req) => {
    const user = await requireUser(req); await world.upgradeFacility(user.id, pid(req));
  }));

  // TICK (cron-protected)
  app.post("/api/tick", wrap(async (req) => {
    const secret = req.header("x-cron-secret") ?? req.query.secret;
    if (secret !== process.env.CRON_SECRET) throw new HttpError(403, "Forbidden");
    const weeks = Math.min(10, Math.max(1, Number(req.body?.weeks ?? 1)));
    return world.runTick(weeks);
  }));

  // CRON entry for Vercel scheduled jobs (GET). Vercel adds the
  // `x-vercel-cron` header on its scheduled invocations; we also accept a
  // matching ?secret= for manual triggering.
  app.get("/api/cron-tick", wrap(async (req) => {
    const isVercelCron = !!req.header("x-vercel-cron");
    const secret = req.query.secret;
    if (!isVercelCron && secret !== process.env.CRON_SECRET) throw new HttpError(403, "Forbidden");
    return world.runTick(1);
  }));

  return { app, world };
}
