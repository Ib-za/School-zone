import { createClient } from "@supabase/supabase-js";
import { getApiEnv, getMissingSupabaseEnv } from "./env";

export type VerifiedApiUser = {
  id: string;
  email: string | null;
  role: string | null;
  schoolId: string | null;
  branchId: string | null;
  staffId: string | null;
};

export function createSupabasePublicClient(accessToken?: string) {
  const env = getApiEnv();
  const missing = getMissingSupabaseEnv(env);

  if (missing.length > 0) {
    throw new Error(`Missing Supabase environment: ${missing.join(", ")}`);
  }

  return createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined
  });
}

export async function verifySupabaseAccessToken(accessToken?: string): Promise<VerifiedApiUser | null> {
  if (!accessToken) {
    return null;
  }

  const supabase = createSupabasePublicClient(accessToken);
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    role: typeof user.app_metadata.role === "string" ? user.app_metadata.role : null,
    schoolId: typeof user.app_metadata.school_id === "string" ? user.app_metadata.school_id : null,
    branchId: typeof user.app_metadata.branch_id === "string" ? user.app_metadata.branch_id : null,
    staffId: typeof user.app_metadata.staff_id === "string" ? user.app_metadata.staff_id : null
  };
}

export function createSupabaseAdminClient() {
  const env = getApiEnv();

  if (!env.supabaseUrl || !env.supabaseAdminKey) {
    return null;
  }

  return createClient(env.supabaseUrl, env.supabaseAdminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
