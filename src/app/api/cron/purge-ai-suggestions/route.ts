import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const cronSecret = process.env.CRON_SECRET || "";

function requireEnv(name: string, value: string) {
  if (!value) throw new Error(`Missing env: ${name}`);
}

function isAuthorized(req: Request): boolean {
  // Vercel Cron Jobs envia automaticamente:
  // Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  try {
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceKey);
    requireEnv("CRON_SECRET", cronSecret);

    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Supabase exige filtro no delete; este gte cobre todas as linhas.
    const { error, count } = await admin
      .from("ai_suggestions")
      .delete({ count: "exact" })
      .gte("created_at", "1970-01-01T00:00:00Z");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      deleted: count ?? null,
      ranAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cron error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

