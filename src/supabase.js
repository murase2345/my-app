import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[supabase] URL または KEY が未設定です (.env.local を確認)"
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");


