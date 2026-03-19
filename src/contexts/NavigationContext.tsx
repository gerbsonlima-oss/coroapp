import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenant } from './TenantContext';

interface NavigationContextType {
  lastEventsRoute: string;
  lastSongsRoute: string;
  setLastEventsRoute: (route: string) => void;
  setLastSongsRoute: (route: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [lastEventsRoute, setLastEventsRoute] = useState<string>(() => {
    return localStorage.getItem('lastEventsRoute') || '/events';
  });
  const [lastSongsRoute, setLastSongsRoute] = useState<string>(() => {
    return localStorage.getItem('lastSongsRoute') || '/songs';
  });
  const location = useLocation();
  const { tenantSlug } = useTenant();

  useEffect(() => {
    const normalizedPath = tenantSlug && location.pathname.startsWith(`/${tenantSlug}`)
      ? location.pathname.slice(tenantSlug.length + 1) || '/'
      : location.pathname;

    if (normalizedPath.startsWith('/events')) {
      const newRoute = location.pathname + location.search;
      if (newRoute !== lastEventsRoute) {
        setLastEventsRoute(newRoute);
        localStorage.setItem('lastEventsRoute', newRoute);
      }
    } else if (normalizedPath.startsWith('/songs')) {
      const newRoute = location.pathname + location.search;
      if (newRoute !== lastSongsRoute) {
        setLastSongsRoute(newRoute);
        localStorage.setItem('lastSongsRoute', newRoute);
      }
    }
  }, [location.pathname, location.search, lastEventsRoute, lastSongsRoute, tenantSlug]);

  return (
    <NavigationContext.Provider
      value={{
        lastEventsRoute,
        lastSongsRoute,
        setLastEventsRoute,
        setLastSongsRoute,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
