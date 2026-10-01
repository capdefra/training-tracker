import { useEffect, useState } from 'react';

export type RouteName = 'today' | 'log' | 'plans' | 'progress' | 'data';

export interface Route {
  name: RouteName;
  id?: string;
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean);
  const head = parts[0] ?? 'today';
  if (head === 'log') return { name: 'log', id: parts[1] };
  if (head === 'plans') return { name: 'plans', id: parts[1] };
  if (head === 'progress') return { name: 'progress' };
  if (head === 'data') return { name: 'data' };
  return { name: 'today' };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
