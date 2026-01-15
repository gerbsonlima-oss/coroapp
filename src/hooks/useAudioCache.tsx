import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

const CACHE_NAME = 'media-cache-v1';

// Map para gerenciar blob URLs e evitar memory leaks
const blobUrlMap = new Map<string, string>();

// Normaliza a URL removendo query params
const normalizeUrl = (rawUrl: string): string => {
  try {
    const u = new URL(rawUrl);
    return u.origin + u.pathname;
  } catch {
    return rawUrl;
  }
};

export interface CachedAudio {
  url: string;
  songId: string;
  naipe: string;
  cached: boolean;
}

export const useAudioCache = () => {
  const [cachedAudios, setCachedAudios] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const activeBlobUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadCachedAudios();

    // Cleanup: revoke blob URLs when component unmounts
    return () => {
      activeBlobUrls.current.forEach(blobUrl => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (e) {
          console.error('Error revoking blob URL:', e);
        }
      });
      activeBlobUrls.current.clear();
      blobUrlMap.clear();
    };
  }, []);

  const loadCachedAudios = async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();
      const urls = requests.map(req => normalizeUrl(req.url));
      setCachedAudios(new Set(urls));
      console.log(`[Cache] Loaded ${urls.length} cached files`);
    } catch (error) {
      console.error('[Cache] Error loading cache:', error);
    }
  };

  const getCachedUrl = async (url: string): Promise<string> => {
    const normalizedUrl = normalizeUrl(url);
    
    // Se já temos um blob URL ativo para esta URL, reutilize
    if (blobUrlMap.has(normalizedUrl)) {
      const existingBlob = blobUrlMap.get(normalizedUrl)!;
      console.log(`[Cache] Reusing existing blob URL for:`, normalizedUrl);
      return existingBlob;
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      
      // Tenta buscar com a URL normalizada
      let response = await cache.match(normalizedUrl);
      
      // Se não encontrar, tenta com a URL original
      if (!response && url !== normalizedUrl) {
        response = await cache.match(url);
      }
      
      if (response) {
        console.log(`[Cache] HIT - Found in cache:`, normalizedUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Armazena o blob URL para reutilização
        blobUrlMap.set(normalizedUrl, blobUrl);
        activeBlobUrls.current.add(blobUrl);
        
        return blobUrl;
      } else {
        console.log(`[Cache] MISS - Not in cache, using original URL:`, normalizedUrl);
      }
    } catch (error) {
      console.error('[Cache] Error fetching from cache:', error);
    }
    
    // Retorna a URL original se não estiver em cache
    return url;
  };

  const cacheAudio = async (url: string): Promise<boolean> => {
    const normalizedUrl = normalizeUrl(url);
    
    try {
      console.log(`[Cache] Caching file:`, normalizedUrl);
      const cache = await caches.open(CACHE_NAME);
      
      // Verifica se já está em cache
      const existingResponse = await cache.match(normalizedUrl);
      if (existingResponse) {
        console.log(`[Cache] Already cached:`, normalizedUrl);
        setCachedAudios(prev => new Set([...prev, normalizedUrl]));
        return true;
      }

      // Try fetching with CORS first
      let response: Response;
      try {
        response = await fetch(url, { 
          mode: 'cors', 
          credentials: 'omit',
          cache: 'no-store'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (corsError) {
        console.warn(`[Cache] CORS fetch failed, trying with no-cors:`, corsError);
        
        // If CORS fails, try fetching through a proxy approach using XMLHttpRequest
        // which sometimes handles CORS differently
        try {
          const blob = await fetchAsBlob(url);
          if (blob) {
            const contentType = blob.type || 
              (url.toLowerCase().includes('.pdf') ? 'application/pdf' : 
               url.toLowerCase().includes('.webp') ? 'image/webp' :
               url.toLowerCase().includes('.png') ? 'image/png' :
               url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg') ? 'image/jpeg' :
               'audio/mpeg');
            
            const responseToCache = new Response(blob, {
              status: 200,
              statusText: 'OK',
              headers: { 
                'Content-Type': contentType,
                'Content-Length': blob.size.toString()
              }
            });
            
            await cache.put(normalizedUrl, responseToCache);
            setCachedAudios(prev => new Set([...prev, normalizedUrl]));
            console.log(`[Cache] Successfully cached (via blob):`, normalizedUrl);
            return true;
          }
        } catch (blobError) {
          console.error(`[Cache] Blob fetch also failed:`, blobError);
        }
        
        return false;
      }

      // Detecta o tipo de conteúdo
      const contentType = response.headers.get('Content-Type') || 
                         (url.toLowerCase().includes('.pdf') ? 'application/pdf' : 
                          url.toLowerCase().includes('.webp') ? 'image/webp' :
                          url.toLowerCase().includes('.png') ? 'image/png' :
                          url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg') ? 'image/jpeg' :
                          'audio/mpeg');

      // Cria uma resposta válida para o cache
      const blob = await response.blob();
      const responseToCache = new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers: { 
          'Content-Type': contentType,
          'Content-Length': blob.size.toString()
        }
      });

      // Armazena no cache usando a URL normalizada
      await cache.put(normalizedUrl, responseToCache);

      // Atualiza o estado
      setCachedAudios(prev => new Set([...prev, normalizedUrl]));

      console.log(`[Cache] Successfully cached:`, normalizedUrl);
      return true;
    } catch (error) {
      console.error(`[Cache] Error caching file:`, normalizedUrl, error);
      return false;
    }
  };

  // Helper function to fetch as blob using XMLHttpRequest (better CORS handling in some cases)
  const fetchAsBlob = (url: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      xhr.send();
    });
  };

  const cacheMultipleAudios = async (urls: string[]): Promise<void> => {
    setIsLoading(true);
    setProgress({ current: 0, total: urls.length });
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const normalizedUrl = normalizeUrl(url);
      
      setProgress({ current: i + 1, total: urls.length });
      
      // Verifica se já está em cache antes de tentar cachear
      if (cachedAudios.has(normalizedUrl)) {
        console.log(`[Cache] Skipping already cached:`, normalizedUrl);
        successCount++;
        continue;
      }

      const success = await cacheAudio(url);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Pequeno delay para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsLoading(false);
    setProgress({ current: 0, total: 0 });

    if (failCount === 0) {
      toast.success(`${successCount} ${successCount === 1 ? 'arquivo disponível' : 'arquivos disponíveis'} offline!`);
    } else {
      toast.warning(`${successCount} salvos, ${failCount} falharam`);
    }
  };

  const removeFromCache = async (url: string): Promise<void> => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const normalizedUrl = normalizeUrl(url);
      
      await cache.delete(normalizedUrl);
      
      // Remove do mapa de blob URLs
      const blobUrl = blobUrlMap.get(normalizedUrl);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrlMap.delete(normalizedUrl);
        activeBlobUrls.current.delete(blobUrl);
      }
      
      setCachedAudios(prev => {
        const newSet = new Set(prev);
        newSet.delete(normalizedUrl);
        return newSet;
      });
      
      console.log(`[Cache] Removed from cache:`, normalizedUrl);
      toast.success('Áudio removido do cache');
    } catch (error) {
      console.error('[Cache] Error removing from cache:', error);
      toast.error('Erro ao remover áudio');
    }
  };

  const clearAllCache = async (): Promise<void> => {
    try {
      await caches.delete(CACHE_NAME);
      
      // Revoga todos os blob URLs ativos
      activeBlobUrls.current.forEach(blobUrl => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (e) {
          console.error('Error revoking blob URL:', e);
        }
      });
      activeBlobUrls.current.clear();
      blobUrlMap.clear();
      
      setCachedAudios(new Set());
      console.log('[Cache] Cache cleared');
      toast.success('Cache limpo com sucesso');
    } catch (error) {
      console.error('[Cache] Error clearing cache:', error);
      toast.error('Erro ao limpar cache');
    }
  };

  const isCached = (url: string): boolean => {
    const normalizedUrl = normalizeUrl(url);
    return cachedAudios.has(normalizedUrl);
  };

  // Async version that checks the actual cache
  const isCachedAsync = async (url: string): Promise<boolean> => {
    const normalizedUrl = normalizeUrl(url);
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(normalizedUrl);
      return response !== undefined;
    } catch {
      return false;
    }
  };

  const getCacheSize = async (): Promise<number> => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }
    } catch (error) {
      console.error('[Cache] Error getting cache size:', error);
    }
    return 0;
  };

  return {
    cachedAudios,
    isLoading,
    getCachedUrl,
    cacheAudio,
    cacheMultipleAudios,
    removeFromCache,
    clearAllCache,
    isCached,
    isCachedAsync,
    getCacheSize,
    progress,
  };
};