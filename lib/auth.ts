import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "coordinator" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  return profile as Profile;
}
