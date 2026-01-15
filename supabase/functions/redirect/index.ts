import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Get the short code from the path (e.g., /redirect/abc123)
    const shortCode = pathParts[pathParts.length - 1];
    
    if (!shortCode || shortCode === 'redirect') {
      return new Response(
        JSON.stringify({ error: 'Short code is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up the short code
    const { data, error } = await supabase
      .from('short_urls')
      .select('full_url')
      .eq('short_code', shortCode)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: 'Short URL not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Redirect to the full URL
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': data.full_url,
      },
    });
  } catch (error) {
    console.error('Redirect error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
