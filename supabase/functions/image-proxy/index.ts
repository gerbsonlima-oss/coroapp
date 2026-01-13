const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = { url?: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const allowedHost = new URL(supabaseUrl).host;

const isAllowedPublicStorageUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.host === allowedHost &&
      u.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
};

const uint8ToBase64 = (bytes: Uint8Array): string => {
  // Evita stack overflow em arrays maiores
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const url = body?.url;

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Campo 'url' é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAllowedPublicStorageUrl(url)) {
      return new Response(JSON.stringify({ error: "URL não permitida" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Falha ao baixar imagem (${res.status})` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentTypeRaw = res.headers.get("content-type") || "image/jpeg";
    const contentType = contentTypeRaw.split(";")[0];

    const bytes = new Uint8Array(await res.arrayBuffer());
    const base64 = uint8ToBase64(bytes);
    const dataUrl = `data:${contentType};base64,${base64}`;

    return new Response(JSON.stringify({ dataUrl, contentType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
