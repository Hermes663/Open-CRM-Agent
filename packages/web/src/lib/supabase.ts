import { createClient as _createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Singleton client used across components */
export const supabase = _createClient(supabaseUrl, supabaseAnonKey);

/** Factory re-export for api.ts backward compatibility */
export function createClient() {
  return supabase;
}
