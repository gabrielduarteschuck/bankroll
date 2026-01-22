import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Scheduled Edge Function:
// - Apaga TODAS as linhas de public.ai_suggestions
// - (ai_suggestions_votes apaga junto via ON DELETE CASCADE)
//
// Requer secrets no Supabase:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

Deno.serve(async () => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Supabase exige filtro em delete
    const { error, count } = await supabase
      .from("ai_suggestions")
      .delete({ count: "exact" })
      .gte("created_at", "1970-01-01T00:00:00Z");

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, deleted: count ?? null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});

