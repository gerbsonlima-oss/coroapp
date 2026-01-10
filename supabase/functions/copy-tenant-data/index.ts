import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface CopyRequest {
  sourceTenantId: string;
  targetTenantId: string;
  dataType: "songTypes" | "songs" | "events";
  itemIds: string[];
}

interface CopyResponse {
  success: boolean;
  copied: number;
  mapping: Record<string, string>;
  error?: string;
}

const generateId = () => crypto.randomUUID();

async function copySongType(
  sourceTenantId: string,
  targetTenantId: string,
  songTypeId: string,
  mapping: Record<string, string>
): Promise<string> {
  const { data: sourceType, error: fetchError } = await supabase
    .from("song_types")
    .select("*")
    .eq("id", songTypeId)
    .eq("tenant_id", sourceTenantId)
    .single();

  if (fetchError || !sourceType) {
    throw new Error(`Falha ao buscar tipo de música: ${songTypeId}`);
  }

  const newId = generateId();

  const { error: insertError } = await supabase
    .from("song_types")
    .insert({
      id: newId,
      tenant_id: targetTenantId,
      name: sourceType.name,
      slug: sourceType.slug,
      description: sourceType.description,
      order_index: sourceType.order_index,
    });

  if (insertError) {
    throw new Error(`Falha ao inserir tipo de música: ${insertError.message}`);
  }

  mapping[songTypeId] = newId;
  return newId;
}

async function copySong(
  sourceTenantId: string,
  targetTenantId: string,
  songId: string,
  songTypeMapping: Record<string, string>,
  songMapping: Record<string, string>
): Promise<string> {
  const { data: sourceSong, error: fetchError } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .eq("tenant_id", sourceTenantId)
    .single();

  if (fetchError || !sourceSong) {
    throw new Error(`Falha ao buscar música: ${songId}`);
  }

  const newSongId = generateId();
  const newTypeId = songTypeMapping[sourceSong.type] || sourceSong.type;

  const { error: insertError } = await supabase
    .from("songs")
    .insert({
      id: newSongId,
      tenant_id: targetTenantId,
      name: sourceSong.name,
      type: newTypeId,
      notes: sourceSong.notes,
      sheet_music_url: sourceSong.sheet_music_url,
      sheet_music_pdf_url: sourceSong.sheet_music_pdf_url,
    });

  if (insertError) {
    throw new Error(`Falha ao inserir música: ${insertError.message}`);
  }

  const { data: audios } = await supabase
    .from("song_audios")
    .select("*")
    .eq("song_id", songId)
    .eq("tenant_id", sourceTenantId);

  if (audios && audios.length > 0) {
    const audioInserts = audios.map((audio: any) => ({
      id: generateId(),
      song_id: newSongId,
      tenant_id: targetTenantId,
      naipe: audio.naipe,
      name: audio.name,
      audio_url: audio.audio_url,
    }));

    const { error: audioError } = await supabase
      .from("song_audios")
      .insert(audioInserts);

    if (audioError) {
      console.error("Aviso: Falha ao copiar alguns áudios", audioError);
    }
  }

  songMapping[songId] = newSongId;
  return newSongId;
}

async function copyEvent(
  sourceTenantId: string,
  targetTenantId: string,
  eventId: string,
  eventMapping: Record<string, string>
): Promise<string> {
  const { data: sourceEvent, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("tenant_id", sourceTenantId)
    .single();

  if (fetchError || !sourceEvent) {
    throw new Error(`Falha ao buscar evento: ${eventId}`);
  }

  const newEventId = generateId();

  const { error: insertError } = await supabase
    .from("events")
    .insert({
      id: newEventId,
      tenant_id: targetTenantId,
      name: sourceEvent.name,
      date: sourceEvent.date,
      location: sourceEvent.location,
      notes: sourceEvent.notes,
      pdf_theme: sourceEvent.pdf_theme,
      cover_image_url: sourceEvent.cover_image_url,
    });

  if (insertError) {
    throw new Error(`Falha ao inserir evento: ${insertError.message}`);
  }

  eventMapping[eventId] = newEventId;
  return newEventId;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response("Não autenticado", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response("Não autenticado", { status: 401 });
    }

    const { data: isSuperAdmin, error: roleError } = await supabase
      .rpc("is_super_admin", { _user_id: user.id });

    if (roleError || !isSuperAdmin) {
      return new Response("Proibido: Deve ser super admin", { status: 403 });
    }

    const body: CopyRequest = await req.json();
    const { sourceTenantId, targetTenantId, dataType, itemIds } = body;

    if (!sourceTenantId || !targetTenantId || !dataType || !itemIds?.length) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400 }
      );
    }

    const songTypeMapping: Record<string, string> = {};
    const songMapping: Record<string, string> = {};
    const eventMapping: Record<string, string> = {};
    let copiedCount = 0;

    if (dataType === "songTypes") {
      for (const typeId of itemIds) {
        await copySongType(sourceTenantId, targetTenantId, typeId, songTypeMapping);
        copiedCount++;
      }
    } else if (dataType === "songs") {
      const { data: sourceTypes } = await supabase
        .from("song_types")
        .select("*")
        .eq("tenant_id", sourceTenantId);

      if (sourceTypes) {
        for (const type of sourceTypes) {
          const { data: existingType } = await supabase
            .from("song_types")
            .select("id")
            .eq("tenant_id", targetTenantId)
            .eq("slug", type.slug)
            .single();

          if (existingType) {
            songTypeMapping[type.id] = existingType.id;
          } else {
            await copySongType(sourceTenantId, targetTenantId, type.id, songTypeMapping);
          }
        }
      }

      for (const songId of itemIds) {
        await copySong(
          sourceTenantId,
          targetTenantId,
          songId,
          songTypeMapping,
          songMapping
        );
        copiedCount++;
      }
    } else if (dataType === "events") {
      for (const eventId of itemIds) {
        await copyEvent(sourceTenantId, targetTenantId, eventId, eventMapping);
        copiedCount++;
      }
    }

    await supabase
      .from("audit_logs")
      .insert({
        user_id: user.id,
        tenant_id: sourceTenantId,
        action: "copy_to_tenant",
        entity_type: dataType,
        description: `Copiado ${copiedCount} ${dataType} para tenant ${targetTenantId}`,
        ip_address: req.headers.get("x-forwarded-for") || undefined,
        user_agent: req.headers.get("user-agent") || undefined,
      });

    const response: CopyResponse = {
      success: true,
      copied: copiedCount,
      mapping: { ...songTypeMapping, ...songMapping, ...eventMapping },
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const response: CopyResponse = {
      success: false,
      copied: 0,
      mapping: {},
      error: error.message,
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});