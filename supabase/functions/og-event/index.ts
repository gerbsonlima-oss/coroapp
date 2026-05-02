import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { format } from 'https://esm.sh/date-fns@3';
import { ptBR } from 'https://esm.sh/date-fns@3/locale/pt-BR';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Support both ?id=... and trailing path segment (/og-event/<id>) and ?slug=...
    let eventId = url.searchParams.get('id');
    const slug = url.searchParams.get('slug');
    if (!eventId) {
      const parts = url.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== 'og-event') eventId = last;
    }

    if (!eventId) {
      return new Response('Event ID is required', { status: 400, headers: corsHeaders });
    }

    // Check if request is from a bot/crawler
    const userAgent = req.headers.get('user-agent') || '';
    const isCrawler = /WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Pinterest|bot|crawler|spider/i.test(userAgent);

    // If not a crawler, redirect to the app (use slug-aware URL when provided)
    if (!isCrawler) {
      const appUrl = Deno.env.get('APP_URL') || 'https://coroapp.lovable.app';
      const target = slug
        ? `${appUrl}/${slug}/public/events/${eventId}`
        : `${appUrl}/e/${eventId}`;
      return Response.redirect(target, 302);
    }

    // For crawlers, fetch event data and return HTML with OG tags
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: event, error } = await supabase
      .from('events')
      .select('id, name, date, location, cover_image_url')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return new Response('Event not found', { status: 404, headers: corsHeaders });
    }

    // Format date
    let formattedDate = '';
    try {
      const date = new Date(event.date + 'T12:00:00');
      formattedDate = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
    } catch {
      formattedDate = event.date;
    }

    // Build OG image URL - use event cover or fallback
    const appUrl = Deno.env.get('APP_URL') || 'https://coroapp.lovable.app';
    const ogImage = event.cover_image_url || `${appUrl}/icon-512.png`;
    const pageUrl = slug
      ? `${appUrl}/${slug}/public/events/${eventId}`
      : `${appUrl}/e/${eventId}`;

    // Build description
    const description = `${formattedDate}${event.location ? ` • ${event.location}` : ''}`;

    // Return HTML with OG meta tags
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.name)} - CoroApp</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(event.name)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="CoroApp">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${escapeHtml(event.name)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImage}">
  
  <!-- WhatsApp specific -->
  <meta property="og:image:type" content="image/jpeg">
  
  <!-- Redirect for browsers -->
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
  
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; text-align: center; }
    h1 { color: #333; }
    p { color: #666; }
    a { color: #3b82f6; }
  </style>
</head>
<body>
  <h1>${escapeHtml(event.name)}</h1>
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
    console.error('Error in og-event function:', error);
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
