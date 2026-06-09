/**
 * Vercel serverless entry — serves the whole Cricket Empire API.
 * Reuses the shared Express app; Vercel routes all /api/* requests here.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildApp } from "../server/src/app.js";

const { app } = buildApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  return (app as unknown as (rq: VercelRequest, rs: VercelResponse) => void)(req, res);
}
