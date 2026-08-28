import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Self-heals a missing profiles row for a signed-in user. This should be
// rare in steady state - profiles are normally created by /api/auth/callback
// on first sign-in - but that only runs if Supabase's email-confirmation
// redirect actually reaches it (it can skip the server entirely depending on
// the project's auth flow settings), so a confirmed user can otherwise be
// stuck forever with no profile row, no role, and a 406 on every lookup.
// The "profiles: self insert" RLS policy (see migration 0006) permits this.
async function createMissingProfile(supabase: SupabaseClient, user: User): Promise<Profile | null> {
  const coordinatorEmails = (process.env.COORDINATOR_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const role = coordinatorEmails.includes(user.email!.toLowerCase()) ? "coordinator" : "site_worker";
  const fullName =
    (user.user_metadata?.full_name as string | undefined)?.trim() || user.email!.split("@")[0];

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email!, full_name: fullName, role }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) {
    console.error("Failed to self-heal missing profile row:", error);
    return null;
  }
  return data as Profile;
}

export async function getProfile(supabase: SupabaseClient, user: User): Promise<Profile | null> {
  // maybeSingle() (not single()) so a missing row returns null instead of
  // erroring - that's the expected first-request state we self-heal below.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profile) return profile as Profile;
  return createMissingProfile(supabase, user);
}

export async function requireCoordinator(): Promise<Profile> {
  const supabase = await createClient();
  // getSession() reads the cookie locally instead of round-tripping to
  // Supabase Auth - safe here because the proxy middleware already called
  // getUser() (which does hit the network) to validate/refresh it for
  // every request that reaches this page.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user);

  if (!profile || (profile.role !== "coordinator" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  return profile;
}
