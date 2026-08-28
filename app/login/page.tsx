"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "forgot" | "forgot-sent";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMode("forgot-sent");
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.85fr_1fr]">
      {/* Poster panel — the one place red runs as a field */}
      <aside
        className="flex flex-col justify-between gap-12 border-b-2 border-[var(--color-divider)] px-6 py-8 lg:min-h-screen lg:border-b-0 lg:border-r-2 lg:px-11 lg:py-10"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-[17px] font-black uppercase tracking-tight">ProLine</span>
          <span className="inline-block h-[15px] w-px bg-current opacity-40" />
          <span className="m-eyebrow opacity-85">ITP Tracker</span>
        </div>

        <div>
          <div className="m-eyebrow tracking-[0.18em] opacity-80">Site evidence, on the record</div>
          <h2 className="m-display mt-4 max-w-[14ch] text-[34px] lg:text-[46px]" style={{ textWrap: "pretty" }}>
            Every hold point, photographed and filed the same day.
          </h2>
        </div>

        <div className="hidden grid-cols-3 gap-0 border-t-2 border-current pt-5 lg:grid">
          {[
            ["44", "Active sites"],
            ["12", "Slack channels"],
            ["1,284", "Submissions"],
          ].map(([value, label]) => (
            <div key={label} className="pr-4">
              <div className="text-[26px] font-black leading-none">{value}</div>
              <div className="m-eyebrow mt-1.5 tracking-[0.12em] opacity-80">{label}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Form — flush left, never centered */}
      <main className="flex flex-col justify-center px-6 py-12 lg:px-16 lg:py-14">
        <div className="w-full max-w-[460px]">
          {mode === "forgot-sent" ? (
            <div>
              <div className="m-kicker">Check your inbox</div>
              <h1 className="m-display mt-3.5">Link sent.</h1>
              <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-[var(--color-neutral-700)]">
                We emailed a password reset link to{" "}
                <strong className="text-[var(--color-text)]">{email}</strong>. It expires in 15 minutes.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-5 border-t-2 border-[var(--color-divider)] pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-in");
                    setError(null);
                  }}
                  className="border-b-2 border-[var(--color-accent)] text-[13px] font-bold uppercase tracking-[0.08em]"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          ) : mode === "forgot" ? (
            <form onSubmit={handleForgot}>
              <div className="m-kicker">Reset password</div>
              <h1 className="m-display mt-3.5">Forgot it happens.</h1>
              <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-[var(--color-neutral-700)]">
                Enter your work email and we&apos;ll send you a link to set a new password.
              </p>

              <div className="mt-8 flex flex-col gap-4">
                <div>
                  <label htmlFor="forgot-email" className="m-label mb-2 block">
                    Work email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@prolinegroup.au"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="m-input m-input--lg"
                  />
                </div>

                {error && (
                  <div
                    className="border-l-4 px-3.5 py-3 text-[13px] font-semibold leading-snug"
                    style={{
                      background: "var(--color-accent-200)",
                      borderColor: "var(--color-accent)",
                      color: "var(--color-accent-800)",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="m-btn m-btn--primary m-btn--lg m-btn--block">
                  <span>{loading ? "Sending…" : "Send reset link"}</span>
                  <span className="text-[17px]">→</span>
                </button>
              </div>

              <div className="mt-7 border-t-2 border-[var(--color-divider)] pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-in");
                    setError(null);
                  }}
                  className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--color-neutral-700)]"
                >
                  ← Back to sign in
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignIn}>
              <div className="m-kicker">Sign in</div>
              <h1 className="m-display mt-3.5">Welcome back.</h1>
              <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-[var(--color-neutral-700)]">
                Sign in to your sites, checklists and today&apos;s checkpoints.
              </p>

              <div className="mt-8 flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className="m-label mb-2 block">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@prolinegroup.au"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="m-input m-input--lg"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <label htmlFor="password" className="m-label">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                      }}
                      className="m-label text-[var(--color-accent)]"
                    >
                      Forgot?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="m-input m-input--lg"
                  />
                </div>

                {error && (
                  <div
                    className="border-l-4 px-3.5 py-3 text-[13px] font-semibold leading-snug"
                    style={{
                      background: "var(--color-accent-200)",
                      borderColor: "var(--color-accent)",
                      color: "var(--color-accent-800)",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="m-btn m-btn--primary m-btn--lg m-btn--block">
                  <span>{loading ? "Signing in…" : "Sign in"}</span>
                  <span className="text-[17px]">→</span>
                </button>
              </div>

              <div className="mt-7 flex items-baseline justify-between border-t-2 border-[var(--color-divider)] pt-5">
                <span className="text-[13px] text-[var(--color-neutral-700)]">No account yet?</span>
                <Link
                  href="/signup"
                  className="border-b-2 border-[var(--color-accent)] text-[13px] font-bold uppercase tracking-[0.08em]"
                >
                  Create one
                </Link>
              </div>

              <p className="mt-9 max-w-[46ch] text-[11px] leading-relaxed text-[var(--color-neutral-600)]">
                Access is limited to prolinegroup.au addresses and invited subcontractors. Submissions are
                logged against your name and pushed to Visibuild.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
