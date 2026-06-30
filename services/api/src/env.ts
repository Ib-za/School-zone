export type ApiEnv = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseAdminKey?: string;
};

export function getApiEnv(): ApiEnv {
  return {
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    supabaseAdminKey: process.env.SUPABASE_SECRET_KEY
  };
}

export function getMissingSupabaseEnv(env = getApiEnv()) {
  return [
    ["SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", env.supabaseUrl],
    ["SUPABASE_PUBLISHABLE_KEY", env.supabaseAnonKey]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}
