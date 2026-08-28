"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
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
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.85fr_1fr]">
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
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 lg:px-16 lg:py-14">
        <div className="w-full max-w-[460px]">
          {done ? (
            <div>
              <div className="m-kicker">Password updated</div>
              <h1 className="m-display mt-3.5">You&apos;re all set.</h1>
              <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-[var(--color-neutral-700)]">
                Taking you to your dashboard…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="m-kicker">Reset password</div>
              <h1 className="m-display mt-3.5">Set a new password.</h1>
              <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-[var(--color-neutral-700)]">
                Choose a password you haven&apos;t used before.
              </p>

              <div className="mt-8 flex flex-col gap-4">
                <div>
                  <label htmlFor="password" className="m-label mb-2 block">
                    New password
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
                  <span>{loading ? "Updating…" : "Update password"}</span>
                  <span className="text-[17px]">→</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
