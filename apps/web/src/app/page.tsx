import { phase1Modules } from "@elate/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "./login/actions";
import { canAccessStaffPortal, canAccessSuperAdmin, staffPortalRoles } from "../roles";
import { createClient, hasSupabaseServerEnv } from "../utils/supabase/server";

const adminStats = [
  ["Setup", "Branch, academic year, classes"],
  ["Students", "Profiles, parent links, custom fields"],
  ["Daily Ops", "Attendance, timetable, announcements"],
  ["Fees", "Structures, installments, Pay Now"]
] as const;

export default async function AdminHome() {
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

  const adminModules = phase1Modules.filter((module) => module.role !== "parent");
  const isPlatformAdmin = canAccessSuperAdmin(user.app_metadata.role);

  return (
    <main>
      <section className="shell">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Elate Admin</p>
            <h1>Phase 1 operations console</h1>
          </div>
          <form action={signOut} className="session-form">
            <span className="session">{user.email}</span>
            <button type="submit">Sign out</button>
          </form>
        </div>

        <div className="summary-grid">
          {adminStats.map(([label, value]) => (
            <div className="panel metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Active roles</p>
              <h2>{staffPortalRoles.join(" / ")}</h2>
            </div>
            <div className="link-row">
              {isPlatformAdmin ? <a href="/super-admin/onboarding">School onboarding</a> : null}
              <a href="/setup">School setup</a>
              <a href="/staff">Staff setup</a>
              <a href="/students">Student setup</a>
              <a href="/supabase">Connection checks</a>
            </div>
          </div>

          <div className="module-grid">
            {adminModules.map((module) => (
              <article className="module" key={module.id}>
                <div>
                  <span>{module.role.replace("_", " ")}</span>
                  <h3>{module.label}</h3>
                </div>
                <p>{module.description}</p>
                <small>{module.status}</small>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
