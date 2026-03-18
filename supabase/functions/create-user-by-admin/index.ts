import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  tenantId: string;
  naipe?: string;
  birthDate?: string;
  phone?: string;
  parish?: string;
  active?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing environment configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authUserData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUserData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const caller = authUserData.user;
    const payload = (await req.json()) as CreateUserPayload;

    if (!payload.email || !payload.password || !payload.fullName || !payload.tenantId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const [{ data: isSuperAdmin }, { data: isTenantAdmin }] = await Promise.all([
      supabaseAdmin.rpc("is_super_admin", { _user_id: caller.id }),
      supabaseAdmin.rpc("is_tenant_admin", { _user_id: caller.id, _tenant_id: payload.tenantId }),
    ]);

    if (!isSuperAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = payload.email.trim().toLowerCase();

    const { data: createdUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName.trim(),
        tenant_id: payload.tenantId,
      },
    });

    if (createUserError || !createdUserData.user) {
      return new Response(JSON.stringify({ error: createUserError?.message || "Failed to create user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = createdUserData.user.id;
    const nowIso = new Date().toISOString();

    const profileUpsert = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          email: normalizedEmail,
          full_name: payload.fullName.trim(),
          naipe: payload.naipe || null,
          birth_date: payload.birthDate || null,
          phone: payload.phone || null,
          parish: payload.parish || null,
          tenant_id: payload.tenantId,
          active: payload.active ?? true,
          approval_status: "approved",
          approved_at: nowIso,
          approved_by: caller.id,
        },
        { onConflict: "id" },
      );

    if (profileUpsert.error) {
      return new Response(JSON.stringify({ error: profileUpsert.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: newUserId,
          tenant_id: payload.tenantId,
          role: "user",
        },
        { onConflict: "user_id,tenant_id" },
      );

    const { data: existingMember } = await supabaseAdmin
      .from("choir_members")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("tenant_id", payload.tenantId)
      .maybeSingle();

    if (!existingMember) {
      await supabaseAdmin.from("choir_members").insert({
        tenant_id: payload.tenantId,
        name: payload.fullName.trim(),
        email: normalizedEmail,
        naipe: payload.naipe || null,
        birth_date: payload.birthDate || null,
        phone: payload.phone || null,
        parish: payload.parish || null,
        active: payload.active ?? true,
      });
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
