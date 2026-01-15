import { supabase } from "@/integrations/supabase/client";

// Generate a random short code (6 characters)
function generateShortCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export type UrlType = 'audio' | 'sheet';

/**
 * Get or create a short URL for a given full URL
 */
export async function getShortUrl(
  fullUrl: string, 
  urlType: UrlType
): Promise<string> {
  // First, check if we already have a short URL for this full URL
  const { data: existing } = await supabase
    .from('short_urls')
    .select('short_code')
    .eq('full_url', fullUrl)
    .maybeSingle();

  if (existing) {
    return buildShortUrl(existing.short_code);
  }

  // Generate a new short code (with retry for uniqueness)
  let shortCode = generateShortCode();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const { error } = await supabase
      .from('short_urls')
      .insert({
        short_code: shortCode,
        full_url: fullUrl,
        url_type: urlType,
      });

    if (!error) {
      return buildShortUrl(shortCode);
    }

    // If duplicate, generate a new code
    if (error.code === '23505') { // unique_violation
      shortCode = generateShortCode();
      attempts++;
    } else {
      console.error('Error creating short URL:', error);
      // Fallback to original URL if we can't create a short one
      return fullUrl;
    }
  }

  // Fallback to original URL after max attempts
  return fullUrl;
}

/**
 * Build the full short URL from a short code
 */
function buildShortUrl(shortCode: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'wxagqywobyzntrlkhfao';
  return `https://${projectId}.supabase.co/functions/v1/redirect/${shortCode}`;
}

/**
 * Get short URLs for both audio and sheet if they exist
 */
export async function getShortUrls(
  audioUrl?: string,
  sheetUrl?: string
): Promise<{ audioShortUrl?: string; sheetShortUrl?: string }> {
  const result: { audioShortUrl?: string; sheetShortUrl?: string } = {};

  const promises: Promise<void>[] = [];

  if (audioUrl) {
    promises.push(
      getShortUrl(audioUrl, 'audio').then(url => {
        result.audioShortUrl = url;
      })
    );
  }

  if (sheetUrl) {
    promises.push(
      getShortUrl(sheetUrl, 'sheet').then(url => {
        result.sheetShortUrl = url;
      })
    );
  }

  await Promise.all(promises);
  return result;
}
