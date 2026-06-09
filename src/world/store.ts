/**
 * Storage abstraction. The game logic only ever talks to `WorldStore`, so we
 * can persist to a local JSON file now and swap in Supabase/Postgres later
 * with zero changes to the tick systems.
 *
 * Design note: we persist the ENTIRE world (every player, AI or human, every
 * stat) so the game is a continuous, resumable simulation — exactly the
 * "save every detail every day" requirement.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { GameWorld } from "./state.js";

export interface WorldStore {
  load(): Promise<GameWorld | null>;
  save(world: GameWorld): Promise<void>;
}

/** Simple, robust JSON-file store with atomic writes. */
export class JsonFileStore implements WorldStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<GameWorld | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as GameWorld;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async save(world: GameWorld): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(world), "utf8");
    // Atomic rename so a crash mid-write never corrupts the save.
    await fs.rename(tmp, this.filePath);
  }
}

/**
 * In-memory store for tests and fast simulations (no disk I/O).
 */
export class MemoryStore implements WorldStore {
  private snapshot: string | null = null;
  async load(): Promise<GameWorld | null> {
    return this.snapshot ? (JSON.parse(this.snapshot) as GameWorld) : null;
  }
  async save(world: GameWorld): Promise<void> {
    this.snapshot = JSON.stringify(world);
  }
}
