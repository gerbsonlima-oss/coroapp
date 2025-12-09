import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

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

  useEffect(() => {
    if (location.pathname.startsWith('/events')) {
      const newRoute = location.pathname + location.search;
      if (newRoute !== lastEventsRoute) {
        setLastEventsRoute(newRoute);
        localStorage.setItem('lastEventsRoute', newRoute);
      }
    } else if (location.pathname.startsWith('/songs')) {
      const newRoute = location.pathname + location.search;
      if (newRoute !== lastSongsRoute) {
        setLastSongsRoute(newRoute);
        localStorage.setItem('lastSongsRoute', newRoute);
      }
    }
  }, [location.pathname, location.search, lastEventsRoute, lastSongsRoute]);

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
