import { useState, useEffect } from 'react';
import { toast } from 'sonner';


const CACHE_NAME = 'media-cache-v1';

// Normaliza a URL removendo query params
const normalizeBase = (rawUrl: string) => {
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

  useEffect(() => {
    loadCachedAudios();
  }, []);

  const loadCachedAudios = async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();
      const urls = requests.map(req => {
        // Normaliza a URL removendo query params para comparação
        const url = new URL(req.url);
        return url.origin + url.pathname;
      });
      setCachedAudios(new Set(urls));
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
    }
  };

  const getCachedUrl = async (url: string): Promise<string> => {
    try {
      const cache = await caches.open(CACHE_NAME);
      
      // Tenta buscar com a URL exata primeiro
      let response = await cache.match(url);
      
      // Se não encontrar, tenta buscar ignorando query params
      if (!response) {
        const normalizedUrl = new URL(url);
        const baseUrl = normalizedUrl.origin + normalizedUrl.pathname;
        response = await cache.match(baseUrl);
      }
      
      if (response) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
    } catch (error) {
      console.error('Erro ao buscar áudio em cache:', error);
    }
    return url;
  };

  const cacheAudio = async (url: string): Promise<boolean> => {
    try {
      const cache = await caches.open(CACHE_NAME);
      
      // Normaliza a URL para salvar sem query params
      const urlObj = new URL(url);
      const baseUrl = urlObj.origin + urlObj.pathname;
      
      // Busca o arquivo (pode ser áudio ou PDF)
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });

      // Detecta o tipo de conteúdo (áudio ou PDF)
      const contentType = response.headers.get('Content-Type') || 
                         (url.toLowerCase().includes('.pdf') ? 'application/pdf' : 'audio/mpeg');

      let responseToCache: Response;
      try {
        if (response.status === 200) {
          responseToCache = response.clone();
        } else {
          // Constrói uma resposta 200 a partir do blob para evitar problemas com 206
          const blob = await response.blob();
          responseToCache = new Response(blob, {
            status: 200,
            headers: { 'Content-Type': contentType }
          });
        }
      } catch (e) {
        // Fallback para blob caso o clone falhe
        const blob = await response.blob();
        responseToCache = new Response(blob, {
          status: 200,
          headers: { 'Content-Type': contentType }
        });
      }

      // Armazena no cache usando a URL base normalizada
      await cache.put(baseUrl, responseToCache);

      // Atualiza o estado
      setCachedAudios(prev => new Set([...prev, baseUrl]));

      console.log('Arquivo cacheado com sucesso:', baseUrl);
      return true;
    } catch (error) {
      console.error('Erro ao cachear áudio:', error);
      return false;
    }
  };

  const cacheMultipleAudios = async (urls: string[]): Promise<void> => {
    setIsLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const url of urls) {
      const base = normalizeBase(url);
      if (cachedAudios.has(base)) {
        successCount++;
        continue;
      }

      const success = await cacheAudio(url);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsLoading(false);

    if (failCount === 0) {
      toast.success(`${successCount} arquivos disponíveis offline!`);
    } else {
      toast.warning(`${successCount} arquivos salvos, ${failCount} falharam`);
    }
  };

  const removeFromCache = async (url: string): Promise<void> => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const base = normalizeBase(url);
      await cache.delete(base);
      setCachedAudios(prev => {
        const newSet = new Set(prev);
        newSet.delete(base);
        return newSet;
      });
      toast.success('Áudio removido do cache');
    } catch (error) {
      console.error('Erro ao remover do cache:', error);
      toast.error('Erro ao remover áudio');
    }
  };

  const clearAllCache = async (): Promise<void> => {
    try {
      await caches.delete(CACHE_NAME);
      setCachedAudios(new Set());
      toast.success('Cache limpo com sucesso');
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      toast.error('Erro ao limpar cache');
    }
  };

  const isCached = (url: string): boolean => {
    // Normaliza a URL para comparação
    try {
      const urlObj = new URL(url);
      const baseUrl = urlObj.origin + urlObj.pathname;
      return cachedAudios.has(baseUrl);
    } catch {
      return cachedAudios.has(url);
    }
  };

  const getCacheSize = async (): Promise<number> => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }
    } catch (error) {
      console.error('Erro ao obter tamanho do cache:', error);
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
    getCacheSize,
  };
};
