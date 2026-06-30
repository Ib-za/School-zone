import { phase1TableNames } from "@elate/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessStaffPortal } from "../../roles";
import { createClient, hasSupabaseServerEnv } from "../../utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupabaseConnectionPage() {
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

  const checks = supabase
    ? await Promise.all(
        phase1TableNames.map(async (table) => {
          const { count, error } = await supabase.from(table).select("*", {
            count: "exact",
            head: true
          });

          return {
            table,
            ok: !error,
            count,
            message: error?.message ?? "reachable"
          };
        })
      )
    : [];

  return (
    <main>
      <section className="shell">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Supabase</p>
            <h1>Connection checks</h1>
          </div>
          <a href="/">Admin home</a>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Environment</p>
              <h2>{supabase ? "Public client configured" : "Missing public Supabase env"}</h2>
            </div>
            <span className="status-pill">{supabase ? "configured" : "not configured"}</span>
          </div>

          <div className="check-grid">
            {checks.map((check) => (
              <article className="check" key={check.table}>
                <span>{check.ok ? "reachable" : "blocked"}</span>
                <h3>{check.table}</h3>
                <p>{check.message}</p>
                <strong>{check.count ?? 0} rows visible</strong>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
