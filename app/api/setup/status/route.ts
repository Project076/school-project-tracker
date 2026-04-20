import { NextResponse } from "next/server";
import { isSupabaseServerConfigured, getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({
        ok: true,
        configured: false,
        needsBootstrap: false
      });
    }

    const supabase = getSupabaseAdminClient();
    const { count, error } = await supabase
      .from("app_profiles")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      needsBootstrap: (count ?? 0) === 0
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Setup status could not be checked."
      },
      { status: 500 }
    );
  }
}
