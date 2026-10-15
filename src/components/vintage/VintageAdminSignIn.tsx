"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import "./editor.css";

/** Dedicated admin sign-in: no Sheets configuration or old site chrome. */
export default function VintageAdminSignIn({
  denied = false,
}: {
  denied?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    denied
      ? "This account does not have homepage administrator access. Sign in with the administrator account."
      : "",
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/vintage/admin",
      });
      if (!result || result.error || !result.ok) {
        setError(
          "Unable to sign in. Check your administrator email and password.",
        );
        setBusy(false);
        return;
      }
      // A full navigation refreshes both the server role check and session context.
      window.location.assign("/vintage/admin");
    } catch {
      setError("Sign-in is unavailable. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="vintage-editor ve-signin">
      <header className="ve-header">
        <div>
          <Link href="/vintage" className="ve-back">
            ← Back to the newspaper
          </Link>
          <p className="ve-eyebrow">WARREN’S MARCH MADNESS · ADMIN</p>
          <h1>The editor’s desk.</h1>
          <p>Sign in with your administrator account to manage the homepage.</p>
        </div>
      </header>
      <form
        onSubmit={submit}
        className="ve-signin-form"
        data-testid="vintage-admin-signin"
      >
        <label className="ve-field" htmlFor="vintage-admin-email">
          <span>Email</span>
          <input
            id="vintage-admin-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="ve-field" htmlFor="vintage-admin-password">
          <span>Password</span>
          <input
            id="vintage-admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </label>
        {error && (
          <p className="ve-notice ve-error" role="alert">
            {error}
          </p>
        )}
        <button className="ve-button primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in to admin"}
        </button>
        <p className="ve-help">
          Only the configured homepage administrator can open this editor.
        </p>
      </form>
    </main>
  );
}
