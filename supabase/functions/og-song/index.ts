import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const typeLabels: Record<string, string> = {
  canto_entrada: 'Entrada',
  entrada: 'Entrada',
  ato_penitencial: 'Ato Penitencial',
  perdao: 'Ato Penitencial',
  gloria: 'Glória',
  salmo: 'Salmo',
  aclamacao: 'Aclamação',
  oferendas: 'Ofertório',
  ofertorio: 'Ofertório',
  santo: 'Santo',
  cordeiro: 'Cordeiro',
  comunhao: 'Comunhão',
  acao_gracas: 'Ação de Graças',
  final: 'Final',
  outro: 'Outro',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const songId = url.searchParams.get('id');

    if (!songId) {
      return new Response('Song ID is required', { status: 400, headers: corsHeaders });
    }

    const userAgent = req.headers.get('user-agent') || '';
    const isCrawler = /WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Pinterest|bot|crawler|spider/i.test(userAgent);

    if (!isCrawler) {
      const appUrl = Deno.env.get('APP_URL') || 'https://coroapp.lovable.app';
      return Response.redirect(`${appUrl}/s/${songId}`, 302);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: song, error } = await supabase
      .from('songs')
      .select('id, name, type, notes, lyrics')
      .eq('id', songId)
      .single();

    if (error || !song) {
      return new Response('Song not found', { status: 404, headers: corsHeaders });
    }

    // Count audios
    const { count } = await supabase
      .from('song_audios')
      .select('id', { count: 'exact', head: true })
      .eq('song_id', songId);

    const appUrl = Deno.env.get('APP_URL') || 'https://coroapp.lovable.app';
    const ogImage = `${appUrl}/icon-512.png`;
    const pageUrl = `${appUrl}/s/${songId}`;
    const typeName = typeLabels[song.type] || song.type;
    const description = `${typeName}${count ? ` • ${count} áudio${count > 1 ? 's' : ''}` : ''}${song.notes ? ` • ${song.notes.substring(0, 80)}` : ''}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(song.name)} - CoroApp</title>
  
  <meta property="og:type" content="music.song">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="🎵 ${escapeHtml(song.name)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta property="og:site_name" content="CoroApp">
  
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="🎵 ${escapeHtml(song.name)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImage}">
  
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>
  <h1>${escapeHtml(song.name)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>Redirecionando para <a href="${pageUrl}">CoroApp</a>...</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in og-song function:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
