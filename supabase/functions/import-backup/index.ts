import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportData {
  tenants: any[];
  songTypes: any[];
  songs: any[];
  songAudios: any[];
  events: any[];
  eventSongs: any[];
  eventSongTypes: any[];
  eventMembers: any[];
  choirMembers: any[];
  rehearsals: any[];
  rehearsalAttendance: any[];
  idMapping: {
    tenants: Record<string, string>;
    songTypes: Record<string, string>;
    songs: Record<string, string>;
    events: Record<string, string>;
    choirMembers: Record<string, string>;
    rehearsals: Record<string, string>;
  };
  urlMapping: Record<string, string>;
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
      return new Response(JSON.stringify({ error: 'Only super_admin can import backups' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const importData: ImportData = await req.json();
    const { tenants, songTypes, songs, songAudios, events, eventSongs, eventSongTypes, eventMembers, choirMembers, rehearsals, rehearsalAttendance, idMapping, urlMapping } = importData;

    const stats = {
      tenants: 0,
      songTypes: 0,
      songs: 0,
      songAudios: 0,
      events: 0,
      eventSongs: 0,
      eventSongTypes: 0,
      eventMembers: 0,
      choirMembers: 0,
      rehearsals: 0,
      rehearsalAttendance: 0,
      errors: [] as string[],
    };

    // Helper to replace old URL with new URL
    const replaceUrl = (url: string | null): string | null => {
      if (!url) return null;
      return urlMapping[url] || url;
    };

    // 1. Insert tenants
    for (const tenant of tenants) {
      const newId = idMapping.tenants[tenant.id];
      if (!newId) continue;

      const { error } = await supabaseAdmin.from('tenants').insert({
        id: newId,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: replaceUrl(tenant.logo_url),
        created_at: tenant.created_at,
        updated_at: tenant.updated_at,
      });

      if (error) {
        if (error.code === '23505') {
          // Duplicate key, try to update instead
          await supabaseAdmin.from('tenants').update({
            name: tenant.name,
            logo_url: replaceUrl(tenant.logo_url),
            updated_at: new Date().toISOString(),
          }).eq('slug', tenant.slug);
        } else {
          stats.errors.push(`Tenant ${tenant.name}: ${error.message}`);
        }
      } else {
        stats.tenants++;
      }
    }

    // 2. Insert song_types
    for (const songType of songTypes) {
      const newId = idMapping.songTypes[songType.id];
      const newTenantId = songType.tenant_id ? idMapping.tenants[songType.tenant_id] : null;
      if (!newId) continue;

      const { error } = await supabaseAdmin.from('song_types').insert({
        id: newId,
        name: songType.name,
        slug: songType.slug,
        description: songType.description,
        order_index: songType.order_index,
        tenant_id: newTenantId,
        created_at: songType.created_at,
      });

      if (error) {
        if (error.code !== '23505') {
          stats.errors.push(`Song type ${songType.name}: ${error.message}`);
        }
      } else {
        stats.songTypes++;
      }
    }

    // 3. Insert songs
    for (const song of songs) {
      const newId = idMapping.songs[song.id];
      const newTenantId = song.tenant_id ? idMapping.tenants[song.tenant_id] : null;
      if (!newId) continue;

      const { error } = await supabaseAdmin.from('songs').insert({
        id: newId,
        name: song.name,
        type: song.type,
        lyrics: song.lyrics,
        chords: song.chords,
        notes: song.notes,
        sheet_music_url: replaceUrl(song.sheet_music_url),
        sheet_music_pdf_url: replaceUrl(song.sheet_music_pdf_url),
        tenant_id: newTenantId,
        user_id: song.user_id, // Keep original user_id
        created_at: song.created_at,
        updated_at: song.updated_at,
      });

      if (error) {
        stats.errors.push(`Song ${song.name}: ${error.message}`);
      } else {
        stats.songs++;
      }
    }

    // 4. Insert song_audios
    for (const audio of songAudios) {
      const newSongId = idMapping.songs[audio.song_id];
      const newTenantId = audio.tenant_id ? idMapping.tenants[audio.tenant_id] : null;
      if (!newSongId) continue;

      const { error } = await supabaseAdmin.from('song_audios').insert({
        id: crypto.randomUUID(),
        song_id: newSongId,
        name: audio.name,
        naipe: audio.naipe,
        audio_url: replaceUrl(audio.audio_url),
        tenant_id: newTenantId,
        created_at: audio.created_at,
      });

      if (error) {
        stats.errors.push(`Audio ${audio.name}: ${error.message}`);
      } else {
        stats.songAudios++;
      }
    }

    // 5. Insert events
    for (const event of events) {
      const newId = idMapping.events[event.id];
      const newTenantId = event.tenant_id ? idMapping.tenants[event.tenant_id] : null;
      if (!newId) continue;

      const { error } = await supabaseAdmin.from('events').insert({
        id: newId,
        name: event.name,
        date: event.date,
        location: event.location,
        notes: event.notes,
        cover_image_url: replaceUrl(event.cover_image_url),
        song_sheet_url: replaceUrl(event.song_sheet_url),
        pdf_theme: event.pdf_theme,
        tenant_id: newTenantId,
        user_id: event.user_id,
        created_at: event.created_at,
        updated_at: event.updated_at,
      });

      if (error) {
        stats.errors.push(`Event ${event.name}: ${error.message}`);
      } else {
        stats.events++;
      }
    }

    // 6. Insert event_songs
    for (const eventSong of eventSongs) {
      const newEventId = idMapping.events[eventSong.event_id];
      const newSongId = idMapping.songs[eventSong.song_id];
      if (!newEventId || !newSongId) continue;

      const { error } = await supabaseAdmin.from('event_songs').insert({
        id: crypto.randomUUID(),
        event_id: newEventId,
        song_id: newSongId,
        type: eventSong.type,
        order_index: eventSong.order_index,
        created_at: eventSong.created_at,
      });

      if (error) {
        stats.errors.push(`Event song: ${error.message}`);
      } else {
        stats.eventSongs++;
      }
    }

    // 7. Insert event_song_types
    for (const est of eventSongTypes) {
      const newEventId = idMapping.events[est.event_id];
      const newSongTypeId = idMapping.songTypes[est.song_type_id];
      if (!newEventId || !newSongTypeId) continue;

      const { error } = await supabaseAdmin.from('event_song_types').insert({
        id: crypto.randomUUID(),
        event_id: newEventId,
        song_type_id: newSongTypeId,
        order_index: est.order_index,
        created_at: est.created_at,
      });

      if (error) {
        stats.errors.push(`Event song type: ${error.message}`);
      } else {
        stats.eventSongTypes++;
      }
    }

    // 8. Insert choir_members
    for (const member of choirMembers) {
      const newId = idMapping.choirMembers[member.id];
      const newTenantId = member.tenant_id ? idMapping.tenants[member.tenant_id] : null;
      if (!newId || !newTenantId) continue;

      const { error } = await supabaseAdmin.from('choir_members').insert({
        id: newId,
        name: member.name,
        email: member.email,
        phone: member.phone,
        naipe: member.naipe,
        birth_date: member.birth_date,
        parish: member.parish,
        photo_url: replaceUrl(member.photo_url),
        active: member.active,
        tenant_id: newTenantId,
        created_at: member.created_at,
        updated_at: member.updated_at,
      });

      if (error) {
        stats.errors.push(`Choir member ${member.name}: ${error.message}`);
      } else {
        stats.choirMembers++;
      }
    }

    // 9. Insert rehearsals (with ID mapping for attendance)
    const rehearsalIdMapping: Record<string, string> = {};
    for (const rehearsal of rehearsals) {
      const newId = crypto.randomUUID();
      rehearsalIdMapping[rehearsal.id] = newId;
      
      const newEventId = rehearsal.event_id ? idMapping.events[rehearsal.event_id] : null;
      const newTenantId = rehearsal.tenant_id ? idMapping.tenants[rehearsal.tenant_id] : null;

      const { error } = await supabaseAdmin.from('rehearsals').insert({
        id: newId,
        date: rehearsal.date,
        location: rehearsal.location,
        notes: rehearsal.notes,
        event_id: newEventId,
        tenant_id: newTenantId,
        created_at: rehearsal.created_at,
        updated_at: rehearsal.updated_at,
      });

      if (error) {
        stats.errors.push(`Rehearsal: ${error.message}`);
      } else {
        stats.rehearsals++;
      }
    }

    // 10. Insert event_members
    for (const em of eventMembers || []) {
      const newEventId = idMapping.events[em.event_id];
      const newMemberId = idMapping.choirMembers[em.member_id];
      if (!newEventId || !newMemberId) continue;

      const { error } = await supabaseAdmin.from('event_members').insert({
        id: crypto.randomUUID(),
        event_id: newEventId,
        member_id: newMemberId,
        created_at: em.created_at,
      });

      if (error) {
        stats.errors.push(`Event member: ${error.message}`);
      } else {
        stats.eventMembers++;
      }
    }

    // 11. Insert rehearsal_attendance
    for (const ra of rehearsalAttendance || []) {
      const newRehearsalId = rehearsalIdMapping[ra.rehearsal_id];
      const newMemberId = ra.member_id ? idMapping.choirMembers[ra.member_id] : null;
      if (!newRehearsalId) continue;

      const { error } = await supabaseAdmin.from('rehearsal_attendance').insert({
        id: crypto.randomUUID(),
        rehearsal_id: newRehearsalId,
        user_id: ra.user_id, // Keep original user_id
        member_id: newMemberId,
        attended: ra.attended,
        created_at: ra.created_at,
      });

      if (error) {
        stats.errors.push(`Rehearsal attendance: ${error.message}`);
      } else {
        stats.rehearsalAttendance++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      stats,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import backup error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
