import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { canAccessStaffPortal } from "../../roles";
import { createClient, hasSupabaseServerEnv } from "../../utils/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const supabase = hasSupabaseServerEnv() ? createClient(cookieStore) : null;
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (user && canAccessStaffPortal(user.app_metadata.role)) {
    redirect("/");
  }

  if (user) {
    redirect("/forbidden");
  }

  const { error } = await searchParams;

  return (
    <main className="auth-main">
      <section className="login-shell">
        <div>
          <p className="eyebrow">School Zone Admin</p>
          <h1>Sign in</h1>
          <p className="auth-copy">Use your Supabase email and password account to access Phase 1 admin tools.</p>
        </div>

        <div className="panel login-panel">
          {supabase ? (
            <LoginForm error={error} />
          ) : (
            <p className="form-error">
              Missing Supabase public environment variables. Start the web app with `bun run dev:web` from the repo root
              after setting `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
