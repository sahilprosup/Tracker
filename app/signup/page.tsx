"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
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
          {sent ? (
            <div>
              <div className="m-kicker">Check your inbox</div>
              <h1 className="m-display mt-3.5">Almost there.</h1>
              <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-[var(--color-neutral-700)]">
                We emailed a verification link to{" "}
                <strong className="text-[var(--color-text)]">{email}</strong>. Confirm it to activate
                your account, then sign in.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-5 border-t-2 border-[var(--color-divider)] pt-5">
                <Link
                  href="/login"
                  className="border-b-2 border-[var(--color-accent)] text-[13px] font-bold uppercase tracking-[0.08em]"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="m-kicker">Create account</div>
              <h1 className="m-display mt-3.5">Join the site.</h1>
              <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-[var(--color-neutral-700)]">
                Set up your account with your work email and a password.
              </p>

              <div className="mt-8 flex flex-col gap-4">
                <div>
                  <label htmlFor="fullName" className="m-label mb-2 block">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="m-input m-input--lg"
                  />
                </div>

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
                  <label htmlFor="password" className="m-label mb-2 block">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="m-input m-input--lg"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="m-label mb-2 block">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  <span>{loading ? "Creating account…" : "Create account"}</span>
                  <span className="text-[17px]">→</span>
                </button>
              </div>

              <div className="mt-7 flex items-baseline justify-between border-t-2 border-[var(--color-divider)] pt-5">
                <span className="text-[13px] text-[var(--color-neutral-700)]">Already have an account?</span>
                <Link
                  href="/login"
                  className="border-b-2 border-[var(--color-accent)] text-[13px] font-bold uppercase tracking-[0.08em]"
                >
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
