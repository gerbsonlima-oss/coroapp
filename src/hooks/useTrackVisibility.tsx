import { useEffect, useRef, useCallback } from 'react';

export const useTrackVisibility = () => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleTracksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: '100px',  // ✅ Carrega 100px antes de entrar na viewport
      threshold: 0,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleTracksRef.current.add(entry.target.id);
        } else {
          visibleTracksRef.current.delete(entry.target.id);
        }
      });
    }, options);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const registerTrack = useCallback((trackId: string, element: HTMLElement | null) => {
    if (!element || !observerRef.current) return;

    element.id = trackId;
    observerRef.current.observe(element);

    return () => {
      observerRef.current?.unobserve(element);
      visibleTracksRef.current.delete(trackId);
    };
  }, []);

  const isTrackVisible = useCallback((trackId: string) => {
    return visibleTracksRef.current.has(trackId);
  }, []);

  return {
    registerTrack,
    isTrackVisible,
    visibleTracks: Array.from(visibleTracksRef.current),
  };
};
