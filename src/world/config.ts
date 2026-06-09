/**
 * Environment config loader. Reads Supabase credentials from process.env
 * (Node) so the same .env.local powers both the tick server and scripts.
 */

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !serviceRoleKey || !anonKey) return null;
  return { url, serviceRoleKey, anonKey };
}

export function requireSupabaseConfig(): SupabaseConfig {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error(
      "Supabase not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, " +
        "and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  return cfg;
}
