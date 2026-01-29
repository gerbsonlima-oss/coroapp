import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupManifest {
  version: string;
  exportedAt: string;
  sourceTenantId: string | null;
  sourceTenantSlug: string | null;
  stats: {
    tenants: number;
    songTypes: number;
    songs: number;
    songAudios: number;
    events: number;
    eventSongs: number;
    eventSongTypes: number;
    choirMembers: number;
    rehearsals: number;
    files: number;
  };
  files: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with user's auth
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is super_admin using service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: isSuperAdmin, error: roleError } = await supabaseAdmin
      .rpc('is_super_admin', { _user_id: user.id });

    if (roleError || !isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Only super_admin can export backups' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body for optional tenant filter
    let tenantId: string | null = null;
    try {
      const body = await req.json();
      tenantId = body.tenantId || null;
    } catch {
      // No body or invalid JSON, export all
    }

    // Fetch all data from tables
    const [
      tenantsRes,
      songTypesRes,
      songsRes,
      songAudiosRes,
      eventsRes,
      eventSongsRes,
      eventSongTypesRes,
      choirMembersRes,
      rehearsalsRes,
    ] = await Promise.all([
      supabaseAdmin.from('tenants').select('*'),
      tenantId 
        ? supabaseAdmin.from('song_types').select('*').eq('tenant_id', tenantId)
        : supabaseAdmin.from('song_types').select('*'),
      tenantId
        ? supabaseAdmin.from('songs').select('*').eq('tenant_id', tenantId)
        : supabaseAdmin.from('songs').select('*'),
      tenantId
        ? supabaseAdmin.from('song_audios').select('*').eq('tenant_id', tenantId)
        : supabaseAdmin.from('song_audios').select('*'),
      tenantId
        ? supabaseAdmin.from('events').select('*').eq('tenant_id', tenantId)
        : supabaseAdmin.from('events').select('*'),
      supabaseAdmin.from('event_songs').select('*'),
      supabaseAdmin.from('event_song_types').select('*'),
      tenantId
        ? supabaseAdmin.from('choir_members').select('*').eq('tenant_id', tenantId)
        : supabaseAdmin.from('choir_members').select('*'),
      tenantId
        ? supabaseAdmin.from('rehearsals').select('*').eq('tenant_id', tenantId)
        : supabaseAdmin.from('rehearsals').select('*'),
    ]);

    // Check for errors
    const errors = [
      tenantsRes.error,
      songTypesRes.error,
      songsRes.error,
      songAudiosRes.error,
      eventsRes.error,
      eventSongsRes.error,
      eventSongTypesRes.error,
      choirMembersRes.error,
      rehearsalsRes.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error('Database errors:', errors);
      return new Response(JSON.stringify({ error: 'Failed to fetch data', details: errors }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenants = tenantsRes.data || [];
    const songTypes = songTypesRes.data || [];
    const songs = songsRes.data || [];
    const songAudios = songAudiosRes.data || [];
    const events = eventsRes.data || [];
    const eventSongs = eventSongsRes.data || [];
    const eventSongTypes = eventSongTypesRes.data || [];
    const choirMembers = choirMembersRes.data || [];
    const rehearsals = rehearsalsRes.data || [];

    // Filter event_songs and event_song_types to only include those from exported events
    const eventIds = new Set(events.map(e => e.id));
    const filteredEventSongs = eventSongs.filter(es => eventIds.has(es.event_id));
    const filteredEventSongTypes = eventSongTypes.filter(est => eventIds.has(est.event_id));

    // Collect all file URLs
    const files: string[] = [];

    // Extract audio URLs
    for (const audio of songAudios) {
      if (audio.audio_url) {
        files.push(audio.audio_url);
      }
    }

    // Extract sheet music URLs
    for (const song of songs) {
      if (song.sheet_music_url) {
        files.push(song.sheet_music_url);
      }
      if (song.sheet_music_pdf_url) {
        files.push(song.sheet_music_pdf_url);
      }
    }

    // Extract event cover URLs
    for (const event of events) {
      if (event.cover_image_url) {
        files.push(event.cover_image_url);
      }
    }

    // Extract tenant logo URLs
    for (const tenant of tenants) {
      if (tenant.logo_url) {
        files.push(tenant.logo_url);
      }
    }

    // Extract choir member photo URLs
    for (const member of choirMembers) {
      if (member.photo_url) {
        files.push(member.photo_url);
      }
    }

    // Get tenant info for manifest
    let sourceTenant = null;
    if (tenantId) {
      sourceTenant = tenants.find(t => t.id === tenantId);
    }

    const manifest: BackupManifest = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sourceTenantId: tenantId,
      sourceTenantSlug: sourceTenant?.slug || null,
      stats: {
        tenants: tenants.length,
        songTypes: songTypes.length,
        songs: songs.length,
        songAudios: songAudios.length,
        events: events.length,
        eventSongs: filteredEventSongs.length,
        eventSongTypes: filteredEventSongTypes.length,
        choirMembers: choirMembers.length,
        rehearsals: rehearsals.length,
        files: files.length,
      },
      files,
    };

    return new Response(JSON.stringify({
      manifest,
      data: {
        tenants,
        songTypes,
        songs,
        songAudios,
        events,
        eventSongs: filteredEventSongs,
        eventSongTypes: filteredEventSongTypes,
        choirMembers,
        rehearsals,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Export backup error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
