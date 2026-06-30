"use client";

import { useActionState } from "react";
import { signInWithEmail } from "./actions";

type LoginFormProps = {
  error?: string;
};

export function LoginForm({ error }: LoginFormProps) {
  const [, action, pending] = useActionState(signInWithEmail, null);

  return (
    <form action={action} className="login-form">
      <label>
        <span>Email</span>
        <input autoComplete="email" inputMode="email" name="email" placeholder="admin@school.edu" required type="email" />
      </label>

      <label>
        <span>Password</span>
        <input autoComplete="current-password" name="password" placeholder="Password" required type="password" />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button disabled={pending} type="submit">
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
