import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // First sign-in for this email: create their profile row. Coordinators
      // are recognised by email so they land with elevated access immediately
      // instead of needing a manual role change after signup.
      const coordinatorEmails = (process.env.COORDINATOR_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const role = coordinatorEmails.includes(data.user.email!.toLowerCase())
        ? "coordinator"
        : "site_worker";

      // Runs as service role, not the user's own RLS-bound session: creating
      // a profile row is internal bookkeeping the user isn't "doing"
      // themselves, and depending on getting an INSERT policy exactly right
      // for it is fragile - a missing/wrong policy here silently blocks
      // every first-time sign-in from ever getting a profile row, with the
      // symptom only showing up much later as "why aren't I a coordinator".
      const serviceClient = createServiceClient();
      const { error: profileError } = await serviceClient.from("profiles").upsert(
        {
          id: data.user.id,
          email: data.user.email!,
          full_name: data.user.email!.split("@")[0],
          role,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (profileError) {
        console.error("Failed to create/update profile on sign-in:", profileError);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
