import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "../login/actions";
import { createClient, hasSupabaseServerEnv } from "../../utils/supabase/server";

export default async function ForbiddenPage() {
  const cookieStore = await cookies();
  const supabase = hasSupabaseServerEnv() ? createClient(cookieStore) : null;
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="auth-main">
      <section className="login-shell">
        <div>
          <p className="eyebrow">Access blocked</p>
          <h1>Staff role required</h1>
          <p className="auth-copy">
            Your Supabase account is signed in, but it does not have a staff portal role claim yet.
          </p>
        </div>

        <div className="panel login-panel">
          <p className="form-error">
            Ask an administrator to set `app_metadata.role` to `platform_admin`, `school_admin`, `branch_admin`, or `teacher`.
          </p>
          <form action={signOut} className="login-form">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </section>
    </main>
  );
}
