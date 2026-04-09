import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, full_name, tenant_id, tenant_slug, role, naipe, phone, birth_date, parish } = await req.json();

    if (!email || !password || !tenant_id) {
      return new Response(JSON.stringify({ error: "Email, senha e tenant são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin of this tenant
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await adminClient.rpc("is_tenant_admin", {
      _user_id: caller.id,
      _tenant_id: tenant_id,
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        tenant_slug,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with additional fields
    const profileUpdates: Record<string, unknown> = {};
    if (naipe) profileUpdates.naipe = naipe;
    if (phone) profileUpdates.phone = phone;
    if (birth_date) profileUpdates.birth_date = birth_date;
    if (parish) profileUpdates.parish = parish;
    profileUpdates.approval_status = "approved";
    profileUpdates.approved_by = caller.id;
    profileUpdates.approved_at = new Date().toISOString();

    await adminClient
      .from("profiles")
      .update(profileUpdates)
      .eq("id", newUser.user!.id);

    // Update role if admin
    if (role === "admin") {
      await adminClient
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", newUser.user!.id)
        .eq("tenant_id", tenant_id);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user!.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
