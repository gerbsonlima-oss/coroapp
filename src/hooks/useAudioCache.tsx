/**
 * Simplified audio cache hook - no offline caching.
 * Just returns URLs directly without any cache layer.
 */
export const useAudioCache = () => {
  const getCachedUrl = async (url: string): Promise<string> => url;
  const cacheAudio = async (_url: string): Promise<boolean> => true;
  const isCached = (_url: string): boolean => false;
  const isCachedAsync = async (_url: string): Promise<boolean> => false;
  const removeFromCache = async (_url: string): Promise<void> => {};
  const clearAllCache = async (): Promise<void> => {};
  const cacheMultipleAudios = async (_urls: string[]): Promise<void> => {};
  const getCacheSize = async (): Promise<number> => 0;

  return {
    cachedAudios: new Set<string>(),
    isLoading: false,
    getCachedUrl,
    cacheAudio,
    cacheMultipleAudios,
    removeFromCache,
    clearAllCache,
    isCached,
    isCachedAsync,
    getCacheSize,
    progress: { current: 0, total: 0 },
  };
};
