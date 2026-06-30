import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./super-admin-client";
import { canAccessSuperAdmin } from "../../../roles";
import { createClient, hasSupabaseServerEnv } from "../../../utils/supabase/server";

export default async function SuperAdminOnboardingPage() {
  const cookieStore = await cookies();
  const supabase = hasSupabaseServerEnv() ? createClient(cookieStore) : null;
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    redirect("/login");
  }

  if (!canAccessSuperAdmin(user.app_metadata.role)) {
    redirect("/forbidden");
  }

  return (
    <main>
      <section className="shell">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Super Admin</p>
            <h1>School onboarding</h1>
          </div>
          <a href="/">Admin home</a>
        </div>

        <OnboardingClient />
      </section>
    </main>
  );
}
