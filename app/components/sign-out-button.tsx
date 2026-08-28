"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button type="button" onClick={signOut} className="m-navlink" style={{ color: "var(--color-neutral-700)" }}>
      Sign out
    </button>
  );
}
