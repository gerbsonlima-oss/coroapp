import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/auth' && location.pathname !== '/') {
      localStorage.setItem('lastPath', location.pathname);
    }
  }, [location.pathname]);

  return null;
};
