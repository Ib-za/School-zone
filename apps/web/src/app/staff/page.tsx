import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StaffClient } from "./staff-client";
import { canAccessStaffPortal } from "../../roles";
import { createClient, hasSupabaseServerEnv } from "../../utils/supabase/server";

export default async function StaffPage() {
  const cookieStore = await cookies();
  const supabase = hasSupabaseServerEnv() ? createClient(cookieStore) : null;
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    redirect("/login");
  }

  if (!canAccessStaffPortal(user.app_metadata.role)) {
    redirect("/forbidden");
  }

  return (
    <main>
      <section className="shell">
        <div className="toolbar">
          <div>
            <p className="eyebrow">School Admin</p>
            <h1>Staff setup</h1>
          </div>
          <a href="/">Admin home</a>
        </div>

        <StaffClient role={String(user.app_metadata.role ?? "")} />
      </section>
    </main>
  );
}
