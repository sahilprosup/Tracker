import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

      const fullName =
        (data.user.user_metadata?.full_name as string | undefined)?.trim() ||
        data.user.email!.split("@")[0];

      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: data.user.email!,
          full_name: fullName,
          role,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
